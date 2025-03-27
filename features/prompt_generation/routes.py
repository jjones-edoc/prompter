from flask import render_template, request, session, redirect, url_for, jsonify
from utils.helpers import get_language_type
from features.prompt_generation.edit_code_prompt import edit_code_prompt
from features.prompt_generation.helpers import _collect_files_recursive, generate_directory_structure


def register_prompt_generation_routes(app, scanner):
    """
    Register routes related to prompt generation from selected files.

    Args:
        app: Flask application instance
        scanner: Scanner instance for file operations
    """

    @app.route('/')
    def index():
        """Display the prompt input screen as the first step"""
        # Clear any existing session data to start fresh
        session.clear()

        return render_template('main.html')

    @app.route('/api/generate', methods=['POST'])
    def api_generate_content():
        """API endpoint to generate prompt content from selected files for the JS-based UI"""
        # Get selected files and folders from the request
        selected_files = request.form.getlist('selected_files')
        selected_folders = request.form.getlist('selected_folder')

        # Get prompt options from the request
        user_prompt = request.form.get('user_prompt', '')
        include_coding_prompt = request.form.get(
            'include_coding_prompt') == '1'
        include_directory_structure = request.form.get(
            'include_directory_structure') == '1'

        # Process folders to get all files within them
        folder_files = []
        for folder_path in selected_folders:
            _collect_files_recursive(scanner, folder_path, folder_files)

        # Combine explicitly selected files and files from selected folders
        all_selected_files = list(set(selected_files + folder_files))

        # If no files were selected, return an error
        if not all_selected_files and not selected_folders:
            return jsonify({'error': 'No files selected. Please select at least one file or folder.'})

        # Prepare the combined content
        combined_content = ""

        # Add coding prompt if checkbox was selected
        if include_coding_prompt:
            combined_content += edit_code_prompt() + "\n\n"

        # Add directory structure if checkbox was selected
        if include_directory_structure:
            combined_content += "### Project Structure:\n\n```\n"
            combined_content += generate_directory_structure(
                scanner, max_depth=5)
            combined_content += "\n```\n\n"

        combined_content += "### List of files:\n\n"
        # Read and add file contents with the new format
        for file_path in all_selected_files:
            file_content = scanner.get_file_contents(file_path)
            if file_content is not None:
                language_type = get_language_type(file_path)
                combined_content += f"File: {file_path}\n```{language_type}\n{file_content}\n```\n\n"

        # Add user prompt at the end
        combined_content += f"### User Query:\n\n{user_prompt}"

        # Return JSON response with the combined content
        return jsonify({
            'combined_content': combined_content,
            # Simple token estimate
            'token_estimate': len(combined_content) // 4
        })
