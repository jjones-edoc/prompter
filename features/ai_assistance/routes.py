from flask import request, jsonify, session, url_for, current_app

# Import necessary database utilities
from utils.database import Database
from utils.repository_file import RepositoryFile

# Internal helper functions for this module
from features.ai_assistance.helpers import (
    filter_files_for_ai_selection,
    build_ai_selection_prompt,
    extract_file_paths_from_ai_response
)


def register_ai_assistance_routes(app, scanner):
    """
    Register routes related to AI assistance features.

    Args:
        app: Flask application instance
        scanner: Scanner instance for file operations
    """
    @app.route('/api/get_ai_selection_prompt', methods=['GET'])
    def get_ai_selection_prompt():
        """Generate prompt for AI selection helper"""
        try:
            # Get the user prompt from session
            user_prompt = session.get('user_prompt', '')
            if not user_prompt:
                return jsonify({'error': 'No prompt found in session'}), 400

            db = Database(app_directory=app.config['PROMPTER_DIRECTORY'])
            repo_file = RepositoryFile(db)

            # Get all files from the repository with metadata
            files = repo_file.get_all()

            # Close the database connection
            db.close()

            # Filter out files that don't have a summary or have been skipped
            filtered_files = filter_files_for_ai_selection(files)

            # Build the prompt
            prompt = build_ai_selection_prompt(user_prompt, filtered_files)

            return jsonify({
                'success': True,
                'prompt': prompt
            })
        except Exception as e:
            current_app.logger.error(
                f"Error generating AI selection prompt: {str(e)}")
            return jsonify({'error': str(e)}), 500

    @app.route('/api/process_ai_selection', methods=['POST'])
    def process_ai_selection():
        """Process the AI selection response and save to session"""
        try:
            # Get the AI response
            ai_response = request.form.get('ai_response', '')
            if not ai_response.strip():
                return jsonify({'error': 'AI response is empty'}), 400

            # Parse the response to extract file paths
            file_paths = extract_file_paths_from_ai_response(ai_response)

            # Store in session
            session['preselected_files'] = file_paths

            return jsonify({
                'success': True,
                'file_count': len(file_paths),
                'files': file_paths,
                'redirect_url': url_for('select_files')
            })
        except Exception as e:
            current_app.logger.error(
                f"Error processing AI selection: {str(e)}")
            return jsonify({'error': str(e)}), 500

    @app.route('/api/get_preselected_files', methods=['GET'])
    def get_preselected_files():
        """Get preselected files from session"""
        try:
            preselected_files = session.get('preselected_files', [])

            return jsonify({
                'success': True,
                'files': preselected_files
            })
        except Exception as e:
            current_app.logger.error(
                f"Error getting preselected files: {str(e)}")
            return jsonify({'error': str(e)}), 500

    @app.route('/api/clear_preselected_files', methods=['GET'])
    def clear_preselected_files():
        """Clear preselected files from session"""
        try:
            if 'preselected_files' in session:
                session.pop('preselected_files')

            return jsonify({
                'success': True
            })
        except Exception as e:
            current_app.logger.error(
                f"Error clearing preselected files: {str(e)}")
            return jsonify({'error': str(e)}), 500
