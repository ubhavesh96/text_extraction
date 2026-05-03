import easyocr
import sys
import os

# Initialize the EasyOCR reader for English
reader = easyocr.Reader(['en'])

def extract_text(img_path):
    """
    Function to extract text from an image using EasyOCR.
    
    Args:
        img_path (str): Path to the input image file.
    
    Returns:
        str: Extracted text from the image.
    """
    if not os.path.exists(img_path):
        raise FileNotFoundError(f"Image file not found: {img_path}")
    
    # Read text from the image
    results = reader.readtext(img_path)
    
    # Extract and join the text from results
    text = ' '.join([result[1] for result in results])
    
    return text.strip()

if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: python3 image_recognition.py <image_path>")
        sys.exit(1)
    
    img_path = sys.argv[1]
    
    try:
        text = extract_text(img_path)
        print("Extracted Text:")
        print(text)
    except Exception as e:
        print(f"Error: {e}")
        sys.exit(1)