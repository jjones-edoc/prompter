from flask import Blueprint, request, jsonify, current_app
from .db.slices import add_slice, get_all_slices, update_slice, delete_slice
from .db.files import get_selected_files
from .db.preferences import get_preference, set_preference
from .utils import is_text_file, parse_gitignore
from pathlib import Path
import logging

builder_bp = Blueprint('builder', __name__, url_prefix='/builder')


@builder_bp.route('/get_all', methods=['POST'])
def get_slices_route():
    slices = get_all_slices()
    files = get_selected_files()
    for the_file in files:
        path = Path(the_file)
        if not path.is_file():
            logging.warning(f"File does not exist: {the_file}")
            return jsonify({'error': 'File does not exist'}), 400

        if not is_text_file(path):
            logging.warning(f"Attempted to read a non-text file: {the_file}")
            return jsonify({'error': 'File is not a text file'}), 400

        try:
            content = path.read_text(encoding='utf-8')
            logging.debug(f"Read content from {the_file}")
            ext = path.suffix.lower()
            if ext == '.py':
                file_type = 'python'
            elif ext == '.go':
                file_type = 'go'
            elif ext == '.css':
                file_type = 'css'
            elif ext == '.js':
                file_type = 'javascript'
            elif ext == '.html':
                file_type = 'html'
            elif ext == '.cs':
                file_type = 'csharp'
            else:
                file_type = 'text'
            slices.append(
                {'id': the_file, 'type': file_type, 'content': content})
        except Exception as e:
            logging.error(f"Error reading file: {e}")
            return jsonify({'error': str(e)}), 500
    return jsonify({'all_slices': slices})

# add a new slice


@builder_bp.route('/add', methods=['POST'])
def add_slice_route():
    data = request.json
    slice_type = data.get('type')
    slice_content = data.get('content')
    if not slice_type or not slice_content:
        return jsonify({'error': 'Missing required fields'}), 400
    if add_slice(slice_type, slice_content):
        return jsonify({'message': 'Slice added'})
    return jsonify({'error': 'Failed to add slice'}), 500

# update an existing slice


@builder_bp.route('/update', methods=['POST'])
def update_slice_route():
    data = request.json
    slice_id = data.get('id')
    slice_type = data.get('type')
    slice_content = data.get('content')
    if not slice_id or not slice_type or not slice_content:
        return jsonify({'error': 'Missing required fields'}), 400
    if update_slice(slice_id, slice_type, slice_content):
        return jsonify({'message': 'Slice updated'})
    return jsonify({'error': 'Failed to update slice'}), 500

# delete an existing slice


def delete_slice_route():
    data = request.json
    slice_id = data.get('id')
    if not slice_id:
        return jsonify({'error': 'Missing required fields'}), 400
    if delete_slice(slice_id):
        return jsonify({'message': 'Slice deleted'})
    return jsonify({'error': 'Failed to delete slice'}), 500
