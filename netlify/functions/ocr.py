import json
import base64
from io import BytesIO
from PIL import Image
import easyocr

# Initialize the EasyOCR reader (models will be downloaded on first run)
reader = easyocr.Reader(['en'])

def handler(event, context):
    # Handle CORS preflight
    if event['httpMethod'] == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type',
                'Access-Control-Allow-Methods': 'POST, OPTIONS'
            },
            'body': ''
        }

    if event['httpMethod'] != 'POST':
        return {
            'statusCode': 405,
            'body': json.dumps({'error': 'Method not allowed'})
        }

    try:
        # Parse the request body
        body = json.loads(event['body'])
        image_b64 = body.get('image')
        if not image_b64:
            return {
                'statusCode': 400,
                'body': json.dumps({'error': 'No image provided'})
            }

        # Decode the base64 image
        image_data = base64.b64decode(image_b64)
        image = Image.open(BytesIO(image_data))

        # Perform OCR
        results = reader.readtext(image)
        extracted_text = ' '.join([result[1] for result in results])

        # Return the result
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type',
                'Access-Control-Allow-Methods': 'POST, OPTIONS'
            },
            'body': json.dumps({'text': extracted_text})
        }

    except Exception as e:
        return {
            'statusCode': 500,
            'body': json.dumps({'error': str(e)})
        }