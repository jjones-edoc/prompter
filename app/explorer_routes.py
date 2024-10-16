# ./app/explorer_routes.py

from flask import Blueprint, request, jsonify, current_app
from .db.slices import (
    add_selected_file,
    remove_selected_file,
    db_clear_all_selected_files,
)
from .db.preferences import set_preference
from .utils import is_text_file, parse_gitignore
from pathlib import Path
import logging

explorer_bp = Blueprint('explorer', __name__, url_prefix='/explorer')


@explorer_bp.route('/clear_all_selected_files', methods=['POST'])
def clear_all_selected_files():
    success = db_clear_all_selected_files()
    if success:
        logging.info("All selected files cleared.")
        return jsonify({'message': 'All selected files cleared'}), 200
    else:
        logging.error("Failed to clear all selected files.")
        return jsonify({'error': 'Failed to clear all selected files'}), 500


@explorer_bp.route('/select_file', methods=['POST'])
def select_file():
    data = request.get_json()
    file_path = data.get('file_path')

    logging.debug(f"Received select_file request for file_path: {file_path}")

    if not file_path:
        logging.warning("No file_path provided in select_file request")
        return jsonify({'error': 'No file_path provided'}), 400

    success = add_selected_file(file_path)
    if success:
        logging.info(f"File selected: {file_path}")
        return jsonify({'message': 'File selected'}), 200
    else:
        logging.error(f"Failed to select file: {file_path}")
        return jsonify({'error': 'Failed to select file'}), 500


@explorer_bp.route('/deselect_file', methods=['POST'])
def deselect_file():
    data = request.get_json()
    file_path = data.get('file_path')

    logging.debug(f"Received deselect_file request for file_path: {file_path}")

    if not file_path:
        logging.warning("No file_path provided in deselect_file request")
        return jsonify({'error': 'No file_path provided'}), 400

    success = remove_selected_file(file_path)
    if success:
        logging.info(f"File deselected: {file_path}")
        return jsonify({'message': 'File deselected'}), 200
    else:
        logging.error(f"Failed to deselect file: {file_path}")
        return jsonify({'error': 'Failed to deselect file'}), 500


@explorer_bp.route('/list_prompt', methods=['POST'])
def create_list_prompt():
    return jsonify({'message': 'List prompt created'}), 200


@explorer_bp.route('/list_directory', methods=['POST'])
def list_directory():
    data = request.get_json()
    path = data.get('path')
    source = data.get('source')  # Get the source parameter

    logging.debug(f"Received list_directory request for path: {
                  path} from source: {source}")

    if not path:
        return jsonify({'error': 'No path provided'}), 400

    dir_path = Path(path)
    if not dir_path.is_dir():
        logging.warning(f"Path is not a directory: {path}")
        return jsonify({'error': 'Path is not a directory'}), 400

    gitignore_path = dir_path / '.gitignore'
    spec = parse_gitignore(gitignore_path)

    try:
        items = list(dir_path.iterdir())
        files = []
        directories = []
        for item in items:
            # Skip the .git directory explicitly
            if item.name == '.git':
                logging.debug(f"Skipping .git directory: {item.name}")
                continue

            # Determine if the item is a directory
            is_dir = item.is_dir()

            # Prepare the relative path for .gitignore matching
            # Append a trailing slash for directories
            item_rel_path = item.name.replace('\\', '/')
            if is_dir:
                item_rel_path += '/'

            # Check if the item is ignored by .gitignore
            if spec.match_file(item_rel_path):
                logging.debug(f"Ignored by .gitignore: {item_rel_path}")
                continue

            # Add to directories or files based on the item type
            if is_dir:
                directories.append(item.name)
            else:
                if is_text_file(item):
                    files.append(item.name)
                else:
                    logging.debug(f"Excluded non-text file: {item.name}")

        logging.debug(f"Listing directories and files in {path}")

        # Save the current path as the last accessed path only if the source is 'select_folder'
        if source == 'select_folder':
            success = set_preference('last_path', str(dir_path.resolve()))
            if success:
                logging.debug(f"Updated last_path to: {
                              dir_path.resolve()} based on source: {source}")
            else:
                logging.error("Failed to update last_path.")

        return jsonify({
            'directories': directories,
            'files': files,
            'current_path': str(dir_path.resolve())
        })
    except Exception as e:
        logging.error(f"Error listing directory: {e}")
        return jsonify({'error': str(e)}), 500


@explorer_bp.route('/read_file', methods=['POST'])
def read_file():
    data = request.get_json()
    file_path = data.get('file_path')

    logging.debug(f"Received read_file request for file_path: {file_path}")

    if not file_path:
        return jsonify({'error': 'No file path provided'}), 400

    path = Path(file_path)
    if not path.is_file():
        logging.warning(f"File does not exist: {file_path}")
        return jsonify({'error': 'File does not exist'}), 400

    if not is_text_file(path):
        logging.warning(f"Attempted to read a non-text file: {file_path}")
        return jsonify({'error': 'File is not a text file'}), 400

    try:
        content = path.read_text(encoding='utf-8')
        logging.debug(f"Read content from {file_path}")
        return jsonify({'content': content})
    except Exception as e:
        logging.error(f"Error reading file: {e}")
        return jsonify({'error': str(e)}), 500


@explorer_bp.route('/save_file', methods=['POST'])
def save_file():
    data = request.get_json()
    file_path = data.get('file_path')
    content = data.get('content')

    logging.debug(f"Received save_file request for file_path: {file_path}")

    if not file_path:
        logging.warning("No file_path provided in save_file request")
        return jsonify({'error': 'No file_path provided'}), 400

    if content is None:
        logging.warning("No content provided in save_file request")
        return jsonify({'error': 'No content was provided'}), 400

    path = Path(file_path)
    if not path.is_file():
        logging.warning(f"File does not exist: {file_path}")
        return jsonify({'error': 'File does not exist'}), 400

    if not is_text_file(path):
        logging.warning(f"Attempted to save a non-text file: {file_path}")
        return jsonify({'error': 'File is not a text file'}), 400

    try:
        path.write_text(content, encoding='utf-8')
        logging.info(f"File saved: {file_path}")
        return jsonify({'message': 'File saved successfully'}), 200
    except Exception as e:
        logging.error(f"Error saving file: {e}")
        return jsonify({'error': str(e)}), 500
