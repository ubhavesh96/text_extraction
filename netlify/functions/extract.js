const { GoogleGenAI } = require('@google/genai');

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json'
};

const SUPPORTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const SUPPORTED_PDF_TYPE = 'application/pdf';
const MAX_FILE_BYTES = 4 * 1024 * 1024; // ~4MB original file, stays under Netlify's sync body limit once base64-encoded
const MODEL = 'gemini-2.5-flash';

const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    document_type: {
      type: 'string',
      description:
        'Best short label for what kind of document this is, e.g. "invoice", "receipt", "ID card", "business card", "letter", "form", "resume", "contract", "screenshot", "handwritten note", "other".'
    },
    title: {
      type: 'string',
      description: 'A short, human-readable title for this document (e.g. "Invoice #4521 - Acme Corp").'
    },
    summary: {
      type: 'string',
      description: 'A 1-3 sentence plain-language summary of what this document is and its key content.'
    },
    language: {
      type: 'string',
      description: 'The primary language the document is written in.'
    },
    fields: {
      type: 'array',
      description:
        'The key facts in the document as label/value pairs (e.g. Invoice Number, Total, Date, Name, Address, Email). Extract every distinct fact worth surfacing.',
      items: {
        type: 'object',
        properties: {
          label: { type: 'string' },
          value: { type: 'string' }
        },
        required: ['label', 'value']
      }
    },
    tables: {
      type: 'array',
      description: 'Any tabular data in the document, such as line items on an invoice or rows in a form.',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'What this table represents, e.g. "Line items".' },
          columns: { type: 'array', items: { type: 'string' } },
          rows: { type: 'array', items: { type: 'array', items: { type: 'string' } } }
        },
        required: ['columns', 'rows']
      }
    },
    raw_text: {
      type: 'string',
      description: 'A full, accurate transcription of every piece of visible text in the document, in reading order.'
    },
    confidence: {
      type: 'number',
      description: 'Your confidence in the accuracy of this extraction, from 0 to 1.'
    }
  },
  required: ['document_type', 'title', 'summary', 'fields', 'raw_text', 'confidence']
};

const PROMPT =
  'You are a meticulous document-understanding assistant. Given this uploaded image or PDF, transcribe all visible text accurately, identify what kind of document it is, and extract its key information into structured fields and tables. Never fabricate information that is not present in the document - if something is illegible or absent, omit it rather than guessing. Respond with only the JSON object described by the response schema.';

function jsonResponse(statusCode, body) {
  return { statusCode, headers: CORS_HEADERS, body: JSON.stringify(body) };
}

function extractResponseText(response) {
  if (typeof response.text === 'string') return response.text;
  if (typeof response.text === 'function') return response.text();
  const candidate = response.candidates && response.candidates[0];
  const parts = candidate && candidate.content && candidate.content.parts;
  if (parts) return parts.map((p) => p.text || '').join('');
  return '';
}

exports.handler = async function (event) {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: CORS_HEADERS, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return jsonResponse(405, { error: 'Method not allowed' });
  }

  let payload;
  try {
    payload = JSON.parse(event.body || '{}');
  } catch (err) {
    return jsonResponse(400, { error: 'Invalid JSON request body' });
  }

  const { fileBase64, mimeType, fileName } = payload;

  if (!fileBase64 || !mimeType) {
    return jsonResponse(400, { error: 'fileBase64 and mimeType are required' });
  }

  const isImage = SUPPORTED_IMAGE_TYPES.includes(mimeType);
  const isPdf = mimeType === SUPPORTED_PDF_TYPE;

  if (!isImage && !isPdf) {
    return jsonResponse(400, {
      error: `Unsupported file type "${mimeType}". Supported types: JPG, PNG, WEBP, GIF, PDF.`
    });
  }

  const approxBytes = Math.floor((fileBase64.length * 3) / 4);
  if (approxBytes > MAX_FILE_BYTES) {
    return jsonResponse(413, { error: 'File is too large. Please upload a file under 4MB.' });
  }

  if (!process.env.GEMINI_API_KEY) {
    return jsonResponse(500, { error: 'Server is not configured: missing GEMINI_API_KEY.' });
  }

  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

  let extracted;
  try {
    const response = await ai.models.generateContent({
      model: MODEL,
      contents: [
        {
          role: 'user',
          parts: [{ text: PROMPT }, { inlineData: { mimeType, data: fileBase64 } }]
        }
      ],
      config: {
        responseMimeType: 'application/json',
        responseSchema: RESPONSE_SCHEMA
      }
    });

    const text = extractResponseText(response);
    if (!text) {
      return jsonResponse(502, { error: 'The model did not return any data. Please try again.' });
    }
    try {
      extracted = JSON.parse(text);
    } catch (parseErr) {
      return jsonResponse(502, { error: 'The model returned malformed data. Please try again.' });
    }
  } catch (err) {
    const status = err && (err.status || err.httpStatus);
    if (status === 429) {
      return jsonResponse(429, { error: 'Rate limited by the AI provider (free tier quota). Please wait a bit and try again.' });
    }
    if (status === 400) {
      const message = String(err.message || '');
      if (/input_tokens_exceeded|exceeds the allowed limit/i.test(message)) {
        return jsonResponse(400, {
          error: isPdf
            ? 'This PDF is too large or has too many pages to process. Please try a shorter document.'
            : 'This image is too large or detailed to process. Please try a smaller or lower-resolution image.'
        });
      }
      return jsonResponse(400, { error: `Could not process this file: ${message}` });
    }
    return jsonResponse(502, { error: `AI extraction failed: ${err.message || err}` });
  }

  return jsonResponse(200, {
    document: {
      file_name: fileName || null,
      mime_type: mimeType,
      document_type: extracted.document_type || null,
      title: extracted.title || null,
      summary: extracted.summary || null,
      language: extracted.language || null,
      fields: extracted.fields || [],
      tables: extracted.tables || [],
      raw_text: extracted.raw_text || null,
      confidence: typeof extracted.confidence === 'number' ? extracted.confidence : null
    }
  });
};
