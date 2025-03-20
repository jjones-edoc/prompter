import os
from flask import request, jsonify, current_app


def register_navigation_routes(app, scanner):
    """
    Register routes related to file and folder navigation.

    Args:
        app: Flask application instance
        scanner: Scanner instance for file operations
    """

    @app.route('/api/search_files', methods=['POST'])
    def search_files():
        """Search for files containing the specified text"""
        search_query = request.form.get('search_query', '')
        if not search_query:
            return jsonify({'error': 'No search query provided'}), 400

        try:
            matching_files = scanner.search_files(search_query)
            return jsonify({
                'matching_files': matching_files,
                'count': len(matching_files)
            })
        except Exception as e:
            current_app.logger.error(f"Error searching files: {str(e)}")
            return jsonify({'error': str(e)}), 500

    @app.route('/api/get_folder_contents', methods=['POST'])
    def get_folder_contents():
        """Get contents of a folder for the dynamic tree view"""
        folder_path = request.form.get('folder_path', '')
        # Empty folder_path means root directory, so we treat it as valid
        # No need to return an error for the root directory

        try:
            dirs, files = scanner.get_folder_contents(folder_path)

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

    @app.route('/api/get_complete_folder_tree', methods=['POST'])
    def get_complete_folder_tree():
        """Get the complete folder tree including all nested directories and files"""
        root_path = request.form.get('root_path', '')

        # Structure to hold the tree
        tree = {'name': root_path or 'Root',
                'path': root_path, 'dirs': [], 'files': []}

        def build_tree_recursive(current_path, tree_node):
            try:
                dirs, files = scanner.get_folder_contents(current_path)

                # Add files
                file_list = []
                for f in files:
                    file_list.append({
                        'name': f.name,
                        'path': f.path,
                        'full_path': f.full_path,
                        'size': f.size,
                        'type': f.type,
                        'token_count': f.token_count
                    })
                tree_node['files'] = file_list

                # Add and process directories
                dirs_list = []
                for d in dirs:
                    dir_node = {
                        'name': d.name,
                        'path': d.path,
                        'full_path': d.full_path,
                        'token_count': d.token_count,
                        'dirs': [],
                        'files': []
                    }
                    build_tree_recursive(d.path, dir_node)
                    dirs_list.append(dir_node)
                tree_node['dirs'] = dirs_list
            except Exception as e:
                print(f"Error building tree for {current_path}: {str(e)}")
                tree_node['error'] = str(e)

        # Build the complete tree
        build_tree_recursive(root_path, tree)

        return jsonify(tree)

    @app.route('/api/get_folder_token_count', methods=['POST'])
    def get_folder_token_count():
        """Calculate token count for all files in a folder recursively"""
        folder_path = request.form.get('folder_path', '')
        if not folder_path:
            return jsonify({'error': 'No folder path provided'}), 400

        try:
            token_count = scanner.get_directory_token_count(folder_path)

            # Get file count as well
            file_count = 0

            def count_files(path):
                nonlocal file_count
                items = scanner.get_items(path)
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
            items = scanner.get_items(path)
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
            token_count = scanner.count_tokens(abs_path)

            return jsonify({
                'token_count': token_count,
                'file_path': file_path
            })
        except Exception as e:
            return jsonify({'error': str(e)}), 500
