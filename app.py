from flask import Flask, request, render_template, jsonify
import json
import logging
from werkzeug.utils import secure_filename
from werkzeug.exceptions import RequestEntityTooLarge
import os


logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('app.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

app = Flask(__name__)

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/get-files', methods=['GET'])
def get_files():
    # Directory containing the JSON files
    directory = os.path.join(os.getcwd(), 'data')
    
    # Get a list of files ending with .json
    files = [f for f in os.listdir(directory) if f.endswith('.json')]
    
    # Return the file list as JSON
    return jsonify(files)

@app.route('/get-json', methods=['GET'])
def get_json():

    file_name = request.args.get('file')  # Get the file name from query parameters
    if not file_name:
        return jsonify({'error': 'No file specified'}), 400

    directory = os.path.join(os.getcwd(), 'data')

    file_path = os.path.join(directory, file_name)

    if not os.path.exists(file_path):
        return jsonify({'error': 'File not found'}), 404

    try:
        with open(file_path, 'r') as file:
            data = json.load(file)  # Parse the file content as JSON
        return jsonify(data)  # Return the JSON content as a response
    except Exception as e:
        return jsonify({'error': f'Error reading or parsing file: {str(e)}'}),

@app.route('/upload', methods=['POST'])
def upload_file():
    try:
        if 'file' not in request.files:
            return jsonify({'error': 'No file uploaded'}), 400

        file = request.files['file']
        if file.filename == '':
            return jsonify({'error': 'No file selected'}), 400

        # Log the raw content
        filename = secure_filename(file.filename)

        file.seek(0, 2)  # Move cursor to end of file
        file_length = file.tell()
        file.seek(0)     # Reset cursor to beginning of file

        if file_length > 1 * 1024 * 1024:  # 1 MB
            return jsonify({'error': 'File is too large. Maximum size allowed is 1 MB.'}), 400

        file.save(os.path.join("uploads/", filename))
        
        try:
            with open(os.path.join("uploads/", filename), "r") as fd:
                content = fd.read()
        except UnicodeDecodeError:
            # If UTF-8 fails, try other encodings
            try:
                content = raw_content.decode('latin-1')
            except UnicodeDecodeError:
                return jsonify({'error': 'Unable to decode file content. Please ensure it is properly encoded.'}), 400

        logger.debug(f"Decoded content first 100 characters: {content[:100]}")
        
        try:
            # Remove any BOM if present
            if content.startswith('\ufeff'):
                content = content[1:]
            
            # Remove any whitespace
            content = content.strip()
            
            # Try to parse JSON
            json_data = json.loads(content)
            return jsonify(json_data)
            
        except json.JSONDecodeError as e:
            error_lines = content.splitlines()
            error_context = '\n'.join(error_lines[max(0, e.lineno-2):e.lineno+1])
            error_message = f"""JSON Parse Error:
            Location: line {e.lineno}, column {e.colno}
            Error: {str(e)}
            Context:
            {error_context}
            """
            logger.error(error_message)
            return jsonify({'error': error_message}), 400

    except Exception as e:
        logger.exception("Unexpected error processing file")
        return jsonify({'error': f'Unexpected error: {str(e)}'}), 500

if __name__ == '__main__':
    app.run(debug=True, port=5001, host='0.0.0.0')

