import os
from flask import Flask, render_template, request, session, redirect, url_for, jsonify
from utils.scanner import Scanner


def create_app(directory: str):
    app = Flask(__name__)
    app.secret_key = os.urandom(24)  # Secret key for session management

    app.config['PROMPTER_DIRECTORY'] = directory
    # Create our file system handler
    fs = Scanner(directory)

    # Helper function to determine language type based on file extension
    def get_language_type(file_path):
        extension_map = {
            '.py': 'python',
            '.js': 'javascript',
            '.html': 'html',
            '.css': 'css',
            '.java': 'java',
            '.cpp': 'cpp',
            '.c': 'c',
            '.cs': 'csharp',
            '.go': 'go',
            '.php': 'php',
            '.rb': 'ruby',
            '.rs': 'rust',
            '.ts': 'typescript',
            '.json': 'json',
            '.xml': 'xml',
            '.yml': 'yaml',
            '.yaml': 'yaml',
            '.md': 'markdown',
            '.sh': 'bash',
            '.sql': 'sql',
            # Add more mappings as needed
        }
        _, ext = os.path.splitext(file_path)
        # Empty string if not a recognized code file
        return extension_map.get(ext.lower(), '')

    # Other routes remain unchanged
    @app.route('/')
    def index():
        """Display the files in the current directory"""
        # Clear any existing session data to start fresh
        session.clear()

        # Get the current path from the query string (default to root)
        current_path = request.args.get('path', '')

        # Get parent path for navigation
        items = fs.get_items(current_path)
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
            # Collect files recursively for each selected folder
            def collect_files_recursive(path):
                items = fs.get_items(path)
                # Add files in this directory
                folder_files.extend([f['path'] for f in items['files']])
                # Recursively process subdirectories
                for dir_info in items['dirs']:
                    collect_files_recursive(dir_info['path'])

            collect_files_recursive(folder_path)

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

    @app.route('/api/get_folder_contents', methods=['POST'])
    def get_folder_contents():
        """Get contents of a folder for the dynamic tree view"""
        folder_path = request.form.get('folder_path', '')
        # Empty folder_path means root directory, so we treat it as valid
        # No need to return an error for the root directory

        try:
            dirs, files = fs.get_folder_contents(folder_path)

            # Convert to serializable dictionaries
            dirs_json = []
            for d in dirs:
                dirs_json.append({
                    'name': d.name,
                    'path': d.path,
                    'full_path': d.full_path,
                    'token_count': d.token_count
                })

            files_json = []
            for f in files:
                files_json.append({
                    'name': f.name,
                    'path': f.path,
                    'full_path': f.full_path,
                    'size': f.size,
                    'type': f.type,
                    'token_count': f.token_count
                })

            return jsonify({
                'dirs': dirs_json,
                'files': files_json
            })
        except Exception as e:
            return jsonify({'error': str(e)}), 500

    @app.route('/api/get_folder_token_count', methods=['POST'])
    def get_folder_token_count():
        """Calculate token count for all files in a folder recursively"""
        folder_path = request.form.get('folder_path', '')
        if not folder_path:
            return jsonify({'error': 'No folder path provided'}), 400

        try:
            token_count = fs.get_directory_token_count(folder_path)

            # Get file count as well
            file_count = 0

            def count_files(path):
                nonlocal file_count
                items = fs.get_items(path)
                file_count += len(items['files'])
                for dir_info in items['dirs']:
                    count_files(dir_info['path'])

            count_files(folder_path)

            return jsonify({
                'token_count': token_count,
                'file_count': file_count
            })
        except Exception as e:
            return jsonify({'error': str(e)}), 500

    @app.route('/api/get_files', methods=['POST'])
    def get_files_in_folder():
        """Get all files in a folder recursively"""
        folder_path = request.form.get('folder_path', '')
        if not folder_path:
            return jsonify({'error': 'No folder path provided'}), 400

        all_files = []

        def collect_files_recursive(path):
            items = fs.get_items(path)
            # Add files in this directory
            all_files.extend([f['path'] for f in items['files']])
            # Recursively process subdirectories
            for dir_info in items['dirs']:
                collect_files_recursive(dir_info['path'])

        collect_files_recursive(folder_path)
        return jsonify({'files': all_files})

    @app.route('/api/get_file_token_count', methods=['POST'])
    def get_file_token_count():
        """Get token count for a single file"""
        file_path = request.form.get('file_path', '')
        if not file_path:
            return jsonify({'error': 'No file path provided'}), 400

        try:
            # Get absolute path to the file
            abs_path = os.path.join(
                app.config['PROMPTER_DIRECTORY'], file_path)

            # Make sure file exists
            if not os.path.isfile(abs_path):
                return jsonify({'error': 'File not found'}), 404

            # Count tokens
            token_count = fs.count_tokens(abs_path)

            return jsonify({
                'token_count': token_count,
                'file_path': file_path
            })
        except Exception as e:
            return jsonify({'error': str(e)}), 500

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
            # Collect files recursively for each selected folder
            def collect_files_recursive(path):
                items = fs.get_items(path)
                # Add files in this directory
                folder_files.extend([f['path'] for f in items['files']])
                # Recursively process subdirectories
                for dir_info in items['dirs']:
                    collect_files_recursive(dir_info['path'])

            collect_files_recursive(folder_path)

        # Combine explicitly selected files and files from selected folders
        all_selected_files = list(set(selected_files + folder_files))

        # Prepare the combined content
        combined_content = ""

        # Add coding prompt if checkbox was selected
        if include_coding_prompt:
            coding_prompt = """### Instructions for code editing:
            
You are an expert code editor. You receive code editing instructions and make precise changes to files.
Always use best practices when editing code.
Respect and use existing conventions, libraries, and patterns present in the code.

When providing code edits:
1. Think step-by-step about the needed changes
2. Return each edit in a SEARCH/REPLACE block
3. Make sure SEARCH blocks exactly match existing code
4. Break large changes into a series of smaller edits
5. Include only the necessary lines in each block

SEARCH/REPLACE blocks must follow this exact format:
<<<<<<< SEARCH
[exact content to find]
=======
[new content to replace with]
>>>>>>> REPLACE

Critical rules for SEARCH/REPLACE blocks:
1. SEARCH content must match the associated file section EXACTLY character-for-character:
   - Match all whitespace, indentation, and line endings
   - Include comments, docstrings, and all existing formatting
   - Never truncate lines mid-way through as this will cause matching failures
   
2. Keep SEARCH/REPLACE blocks concise and targeted:
   - Include just enough lines to uniquely identify the section to change
   - Break large changes into multiple small, focused edits
   - Don't include long runs of unchanged lines
   - Each line must be complete - never truncate lines

3. Multiple edits in the same file:
   - List SEARCH/REPLACE blocks in the order they appear in the file
   - Ensure no overlapping edits (never modify the same line twice)
   - Each block must match unique content in the file

4. Special operations:
   - To append to end of file: Use empty SEARCH block
   - To move code: Use two separate blocks (one to remove, one to insert)
   - To delete code: Use empty REPLACE section

Example of a valid edit command:
filename.py
<<<<<<< SEARCH
def old_function():
    return 1
=======
def new_function():
    return 2
>>>>>>> REPLACE

Rules for edit structure:
1. The filename must be alone on a line before the opening fence
2. The SEARCH section must exactly match existing code
3. Empty SEARCH blocks are used to add content to end of file
4. Each block edits one continuous section
5. No overlapping edits allowed

Put all code edits across files in one artifact
"""
            combined_content += coding_prompt + "\n\n"

        combined_content += "### List of files:\n\n"
        # Read and add file contents with the new format
        for file_path in all_selected_files:
            file_content = fs.get_file_contents(file_path)
            if file_content is not None:
                language_type = get_language_type(file_path)
                combined_content += f"File: {file_path}\n```{language_type}\n{file_content}\n```\n\n"

        # Add user prompt at the end
        combined_content += f"### User Query:\n\n{user_prompt}"

        return render_template('generated.html', combined_content=combined_content)

    return app


if __name__ == '__main__':
    current_dir = os.getcwd()  # Get the current directory
    app = create_app(current_dir)
    app.run(debug=True)
