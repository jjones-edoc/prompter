from flask import render_template, request, session, redirect, url_for, Blueprint
from utils.helpers import get_language_type, get_coding_prompt


def register_main_routes(app, scanner):
    """
    Register all main application routes.

    Args:
        app: Flask application instance
        scanner: Scanner instance for file operations
    """

    @app.route('/')
    def index():
        """Display the files in the current directory"""
        # Clear any existing session data to start fresh
        session.clear()

        # Get the current path from the query string (default to root)
        current_path = request.args.get('path', '')

        # Get parent path for navigation
        items = scanner.get_items(current_path)
        parent_path = items['parent_path']

        return render_template('index.html',
                               current_path=current_path,
                               parent_path=parent_path)

    @app.route('/prompt', methods=['POST'])
    def prompt_input():
        """Handle the file selection and show prompt input screen"""
        selected_files = request.form.getlist('selected_files')
        selected_folders = request.form.getlist('selected_folder')

        # Process folders to get all files within them
        folder_files = []
        for folder_path in selected_folders:
            _collect_files_recursive(scanner, folder_path, folder_files)

        # Combine explicitly selected files and files from selected folders
        all_selected_files = list(set(selected_files + folder_files))

        # Store selected files in session
        session['selected_files'] = all_selected_files
        session['selected_folders'] = selected_folders

        # If no files were selected, go back to index
        if not all_selected_files and not selected_folders:
            current_path = request.form.get('current_path', '')
            return redirect(url_for('index', path=current_path))

        return render_template('prompt.html',
                               selected_files=all_selected_files,
                               selected_folders=selected_folders)

    @app.route('/generate', methods=['GET', 'POST'])
    def generate():
        """Generate the final prompt with file contents"""
        # If GET request (e.g., from back button), redirect to prompt input page
        if request.method == 'GET':
            return redirect(url_for('prompt_input'))

        user_prompt = request.form.get('prompt', '')
        include_coding_prompt = 'include_coding_prompt' in request.form
        selected_files = session.get('selected_files', [])
        selected_folders = request.form.getlist('selected_folder')

        # If folders were selected, get all files in those folders
        folder_files = []
        for folder_path in selected_folders:
            _collect_files_recursive(scanner, folder_path, folder_files)

        # Combine explicitly selected files and files from selected folders
        all_selected_files = list(set(selected_files + folder_files))

        # Prepare the combined content
        combined_content = ""

        # Add coding prompt if checkbox was selected
        if include_coding_prompt:
            combined_content += get_coding_prompt() + "\n\n"

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


def _collect_files_recursive(scanner, path, file_list):
    """
    Helper function to collect files recursively from a directory.

    Args:
        scanner: Scanner instance
        path: Path to collect files from
        file_list: List to append files to
    """
    items = scanner.get_items(path)
    # Add files in this directory
    file_list.extend([f['path'] for f in items['files']])
    # Recursively process subdirectories
    for dir_info in items['dirs']:
        _collect_files_recursive(scanner, dir_info['path'], file_list)
