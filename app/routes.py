# ./app/routes.py

from flask import Blueprint, render_template, request, jsonify, current_app
from .db import get_db, get_preference, set_preference, get_selected_files, add_selected_file, remove_selected_file
from .utils import is_text_file, parse_gitignore
from pathlib import Path
import os
import logging

main_bp = Blueprint('main', __name__)


@main_bp.route('/')
def index():
    last_path = get_preference('last_path') or '/'
    selected_files = get_selected_files()
    return render_template('index.html', last_path=last_path, selected_files=selected_files)


@main_bp.route('/about')
def about():
    return render_template('about.html')


@main_bp.route('/select_file', methods=['POST'])
def select_file():
    data = request.get_json()
    file_path = data.get('file_path')

    if not file_path:
        return jsonify({'error': 'No file_path provided'}), 400

    success = add_selected_file(file_path)
    if success:
        return jsonify({'message': 'File selected'}), 200
    else:
        return jsonify({'error': 'Failed to select file'}), 500


@main_bp.route('/deselect_file', methods=['POST'])
def deselect_file():
    data = request.get_json()
    file_path = data.get('file_path')

    if not file_path:
        return jsonify({'error': 'No file_path provided'}), 400

    success = remove_selected_file(file_path)
    if success:
        return jsonify({'message': 'File deselected'}), 200
    else:
        return jsonify({'error': 'Failed to deselect file'}), 500


@main_bp.route('/list_directory', methods=['POST'])
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


@main_bp.route('/read_file', methods=['POST'])
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
