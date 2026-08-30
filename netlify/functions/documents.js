const { createClient } = require('@supabase/supabase-js');

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Content-Type': 'application/json'
};

const LIST_COLUMNS = 'id, created_at, file_name, document_type, title, summary, confidence';
const RECENT_LIMIT = 50;

function jsonResponse(statusCode, body) {
  return { statusCode, headers: CORS_HEADERS, body: JSON.stringify(body) };
}

async function getAuthedUser(event, supabase) {
  const authHeader = event.headers.authorization || event.headers.Authorization || '';
  const match = authHeader.match(/^Bearer (.+)$/);
  if (!match) return null;
  const { data, error } = await supabase.auth.getUser(match[1]);
  if (error || !data.user) return null;
  return data.user;
}

exports.handler = async function (event) {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: CORS_HEADERS, body: '' };
  }

  if (event.httpMethod !== 'GET') {
    return jsonResponse(405, { error: 'Method not allowed' });
  }

  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return jsonResponse(500, { error: 'Server is not configured: missing Supabase credentials.' });
  }

  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const user = await getAuthedUser(event, supabase);
  if (!user) {
    return jsonResponse(401, { error: 'Please sign in to view documents.' });
  }

  const id = event.queryStringParameters && event.queryStringParameters.id;

  if (id) {
    const { data, error } = await supabase.from('documents').select('*').eq('id', id).eq('user_id', user.id).single();
    if (error) {
      return jsonResponse(404, { error: `Document not found: ${error.message}` });
    }
    return jsonResponse(200, { document: data });
  }

  const { data, error } = await supabase
    .from('documents')
    .select(LIST_COLUMNS)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(RECENT_LIMIT);

  if (error) {
    return jsonResponse(502, { error: `Could not load documents: ${error.message}` });
  }

  return jsonResponse(200, { documents: data });
};
