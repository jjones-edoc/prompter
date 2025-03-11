import os
from flask import request, jsonify


def register_api_routes(app, scanner):
    """
    Register all API routes.

    Args:
        app: Flask application instance
        scanner: Scanner instance for file operations
    """
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
            return jsonify({'error': str(e)}), 500
            
    @app.route('/api/process_claude_response', methods=['POST'])
    def process_claude_response():
        """Process the response pasted from Claude"""
        claude_response = request.form.get('claude_response', '')
        if not claude_response:
            return jsonify({'error': 'No response provided'}), 400
            
        try:
            # Import our processor (using relative import based on project structure)
            from utils.response_processor import ClaudeResponseProcessor
            
            # Get the root directory from app config
            root_dir = app.config['PROMPTER_DIRECTORY']
            
            # Initialize the processor with the root directory
            processor = ClaudeResponseProcessor(root_dir)
            
            # Process the response
            results = processor.process_response(claude_response)
            
            # Build response based on processing results
            response = {
                'success': results['success_count'] > 0,
                'edited_files': results['edited_files'],
                'success_count': results['success_count'],
                'error_count': results['error_count'],
                'errors': results['errors']
            }
            
            # Add a summary message
            if results['error_count'] == 0:
                response['message'] = f"Successfully edited {results['success_count']} file(s)"
            else:
                response['message'] = f"Processed with {results['success_count']} successful edit(s) and {results['error_count']} error(s)"
            
            return jsonify(response)
        except Exception as e:
            return jsonify({'error': str(e)}), 500
            
    @app.route('/api/count_unsummarized_files', methods=['GET'])
    def count_unsummarized_files():
        """Get the count of repository files without summaries"""
        try:
            # Create a temporary database connection to query the count
            from utils.database import Database
            db = Database(app_directory=app.config['PROMPTER_DIRECTORY'])
            
            # Get the count of files without summaries
            count = db.count_files_without_summary()
            
            # Close the database connection
            db.close()
            
            return jsonify({
                'count': count
            })
        except Exception as e:
            return jsonify({'error': str(e)}), 500
            
    @app.route('/api/get_next_unsummarized_file', methods=['GET'])
    def get_next_unsummarized_file():
        """Get the next file without a summary"""
        try:
            # Import repository file class and file summarizer
            from utils.database import Database
            from utils.repository_file import RepositoryFile
            from utils.file_summarizer import generate_summary_prompt
            
            # Create database connection
            db = Database(app_directory=app.config['PROMPTER_DIRECTORY'])
            repo_file = RepositoryFile(db)
            
            # Get the next file without a summary
            file_data = repo_file.get_next_unsummarized_file()
            
            # Close the database connection
            db.close()
            
            if file_data:
                # Get the file contents
                file_path = file_data['file_path']
                abs_path = os.path.join(app.config['PROMPTER_DIRECTORY'], file_path)
                
                # Make sure the file exists
                if os.path.isfile(abs_path):
                    try:
                        with open(abs_path, 'r', encoding='utf-8') as f:
                            file_content = f.read()
                    except UnicodeDecodeError:
                        # Try another encoding if UTF-8 fails
                        with open(abs_path, 'r', encoding='latin-1') as f:
                            file_content = f.read()
                    
                    # Get the language type
                    from utils.helpers import get_language_type
                    language_type = get_language_type(file_path)
                    
                    # Generate the prompt with repository structure
                    prompt = generate_summary_prompt(
                        file_path=file_path,
                        file_content=file_content,
                        language_type=language_type,
                        scanner=scanner
                    )
                    
                    return jsonify({
                        'file_path': file_path,
                        'token_count': file_data['token_count'],
                        'content': file_content,
                        'language_type': language_type,
                        'prompt': prompt
                    })
                else:
                    return jsonify({'error': 'File not found on disk'}), 404
            else:
                return jsonify({'message': 'No unsummarized files found'}), 404
        except Exception as e:
            return jsonify({'error': str(e)}), 500
            
    @app.route('/api/update_file_summary', methods=['POST'])
    def update_file_summary():
        """Update a file's summary, tree, and dependencies"""
        try:
            # Get request data
            file_path = request.form.get('file_path')
            summary = request.form.get('summary')
            tree = request.form.get('tree')
            dependencies = request.form.get('dependencies')
            
            # Validate required fields
            if not file_path or not summary:
                return jsonify({'error': 'File path and summary are required'}), 400
                
            # Process tree and dependencies if provided
            tree_list = tree.splitlines() if tree else None
            dependencies_list = dependencies.splitlines() if dependencies else None
            
            # Import repository file class
            from utils.database import Database
            from utils.repository_file import RepositoryFile
            
            # Create database connection
            db = Database(app_directory=app.config['PROMPTER_DIRECTORY'])
            repo_file = RepositoryFile(db)
            
            # Update the file summary
            success = repo_file.update_file_summary(
                file_path=file_path,
                summary=summary,
                tree=tree_list,
                dependencies=dependencies_list
            )
            
            # Close the database connection
            db.close()
            
            if success:
                # Get the updated count of unsummarized files
                db = Database(app_directory=app.config['PROMPTER_DIRECTORY'])
                remaining_count = db.count_files_without_summary()
                db.close()
                
                return jsonify({
                    'success': True,
                    'message': 'File summary updated successfully',
                    'remaining_count': remaining_count
                })
            else:
                return jsonify({'error': 'File not found in database'}), 404
        except Exception as e:
            return jsonify({'error': str(e)}), 500
            
    @app.route('/api/skip_file', methods=['POST'])
    def skip_file():
        """Skip a file by marking it with an empty summary"""
        try:
            # Get request data
            file_path = request.form.get('file_path')
            
            # Validate required fields
            if not file_path:
                return jsonify({'error': 'File path is required'}), 400
                
            # Import repository file class
            from utils.database import Database
            from utils.repository_file import RepositoryFile
            
            # Create database connection
            db = Database(app_directory=app.config['PROMPTER_DIRECTORY'])
            repo_file = RepositoryFile(db)
            
            # Update with an empty summary to mark as processed but skipped
            success = repo_file.update_file_summary(
                file_path=file_path,
                summary="[Skipped]"
            )
            
            # Close the database connection
            db.close()
            
            if success:
                # Get the updated count of unsummarized files
                db = Database(app_directory=app.config['PROMPTER_DIRECTORY'])
                remaining_count = db.count_files_without_summary()
                db.close()
                
                return jsonify({
                    'success': True,
                    'message': 'File skipped successfully',
                    'remaining_count': remaining_count
                })
            else:
                return jsonify({'error': 'File not found in database'}), 404
        except Exception as e:
            return jsonify({'error': str(e)}), 500
