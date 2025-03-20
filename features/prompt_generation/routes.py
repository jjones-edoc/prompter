from flask import render_template, request, session, redirect, url_for
from utils.helpers import get_language_type
from utils.edit_code_prompt import edit_code_prompt
from features.prompt_generation.helpers import _collect_files_recursive


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

        return render_template('prompt.html')

    @app.route('/selection_method', methods=['POST'])
    def selection_method():
        """Handle the prompt input and show the selection method screen"""
        user_prompt = request.form.get('prompt', '')
        include_coding_prompt = 'include_coding_prompt' in request.form

        # Store prompt data in session
        session['user_prompt'] = user_prompt
        session['include_coding_prompt'] = include_coding_prompt

        # If prompt is empty, go back to index
        if not user_prompt.strip():
            return redirect(url_for('index'))

        return render_template('selection_method.html')

    @app.route('/select_files', methods=['POST', 'GET'])
    def select_files():
        """Display the file selection screen"""
        # If this is a GET request, check if we have prompt data in session
        if request.method == 'GET':
            if 'user_prompt' not in session:
                return redirect(url_for('index'))

        # Get the current path from the query string (default to root)
        current_path = request.args.get('path', '')

        # Get parent path for navigation
        items = scanner.get_items(current_path)
        parent_path = items['parent_path']

        # Get any preselected files from the AI helper
        preselected_files = session.get('preselected_files', [])

        return render_template('index.html',
                               current_path=current_path,
                               parent_path=parent_path,
                               preselected_files=preselected_files)

    @app.route('/generate', methods=['GET', 'POST'])
    def generate():
        """Generate the final prompt with file contents"""
        # If GET request (e.g., from back button), redirect to file selection page
        if request.method == 'GET':
            return redirect(url_for('index'))

        selected_files = request.form.getlist('selected_files')
        selected_folders = request.form.getlist('selected_folder')

        # Get stored prompt data from session
        user_prompt = session.get('user_prompt', '')
        include_coding_prompt = session.get('include_coding_prompt', False)

        # Process folders to get all files within them
        folder_files = []
        for folder_path in selected_folders:
            _collect_files_recursive(scanner, folder_path, folder_files)

        # Combine explicitly selected files and files from selected folders
        all_selected_files = list(set(selected_files + folder_files))

        # If no files were selected, go back to file selection
        if not all_selected_files and not selected_folders:
            current_path = request.form.get('current_path', '')
            return redirect(url_for('select_files', path=current_path))

        # Prepare the combined content
        combined_content = ""

        # Add coding prompt if checkbox was selected
        if include_coding_prompt:
            combined_content += edit_code_prompt() + "\n\n"

        combined_content += "### List of files:\n\n"
        # Read and add file contents with the new format
        for file_path in all_selected_files:
            file_content = scanner.get_file_contents(file_path)
            if file_content is not None:
                language_type = get_language_type(file_path)
                combined_content += f"File: {file_path}\n```{language_type}\n{file_content}\n```\n\n"

        # Add user prompt at the end
        combined_content += f"### User Query:\n\n{user_prompt}"

        return render_template('generated.html', combined_content=combined_content)
