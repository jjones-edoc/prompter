import os
from flask import request, jsonify, session, url_for


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
                response[
                    'message'] = f"Successfully edited {results['success_count']} file(s)"
            else:
                response[
                    'message'] = f"Processed with {results['success_count']} successful edit(s) and {results['error_count']} error(s)"

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

            # Get the count of files without summaries first
            unsummarized_count = db.count_files_without_summary()

            # Log the count for debugging
            app.logger.info(f"Unsummarized files count: {unsummarized_count}")

            if unsummarized_count == 0:
                db.close()
                return jsonify({'message': 'No unsummarized files found'}), 200

            # Get the next file without a summary
            file_data = repo_file.get_next_unsummarized_file()

            # Close the database connection
            db.close()

            if file_data:
                # Get the file contents
                file_path = file_data['file_path']
                abs_path = os.path.join(
                    app.config['PROMPTER_DIRECTORY'], file_path)

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
                    # File exists in DB but not on disk
                    app.logger.warning(f"File not found on disk: {file_path}")
                    # Skip this file in the DB by marking it as processed with a special flag
                    db = Database(
                        app_directory=app.config['PROMPTER_DIRECTORY'])
                    repo_file = RepositoryFile(db)
                    repo_file.update_file_summary(
                        file_path=file_path, summary="[File not found on disk - skipped]")
                    db.close()
                    # Try to get the next file instead
                    return get_next_unsummarized_file()
            else:
                return jsonify({'message': 'No valid unsummarized files found'}), 200
        except Exception as e:
            app.logger.error(f"Error in get_next_unsummarized_file: {str(e)}")
            return jsonify({'error': str(e)}), 500

    @app.route('/api/get_multiple_unsummarized_files', methods=['GET'])
    def get_multiple_unsummarized_files():
        """Get multiple files without summaries, up to a token limit"""
        try:
            # Get token limit from request, default to 50000
            token_limit = request.args.get('token_limit', 50000, type=int)

            # Import repository file class and file summarizer
            from utils.database import Database
            from utils.repository_file import RepositoryFile
            from utils.file_summarizer import generate_summary_prompt
            from utils.helpers import get_language_type

            # Create database connection
            db = Database(app_directory=app.config['PROMPTER_DIRECTORY'])
            repo_file = RepositoryFile(db)

            # Get the count of files without summaries first
            unsummarized_count = db.count_files_without_summary()

            # Log the count for debugging
            app.logger.info(
                f"Unsummarized files count for multi-file: {unsummarized_count}")

            if unsummarized_count == 0:
                db.close()
                return jsonify({
                    'message': 'No unsummarized files found',
                    'files': [],
                    'total_tokens': 0,
                    'file_count': 0
                }), 200

            # Get multiple files without summaries
            files_data = repo_file.get_multiple_unsummarized_files(token_limit)

            # Close the database connection
            db.close()

            if not files_data:
                return jsonify({
                    'message': 'No unsummarized files found',
                    'files': [],
                    'total_tokens': 0,
                    'file_count': 0
                }), 200

            # Process each file to add content and language type
            processed_files = []
            skipped_files = []

            for file_data in files_data:
                file_path = file_data['file_path']
                abs_path = os.path.join(
                    app.config['PROMPTER_DIRECTORY'], file_path)

                # Make sure the file exists
                if os.path.isfile(abs_path):
                    try:
                        with open(abs_path, 'r', encoding='utf-8') as f:
                            file_content = f.read()
                    except UnicodeDecodeError:
                        # Try another encoding if UTF-8 fails
                        try:
                            with open(abs_path, 'r', encoding='latin-1') as f:
                                file_content = f.read()
                        except Exception as e:
                            # Skip this file and log the error
                            app.logger.error(
                                f"Error reading file {file_path}: {str(e)}")
                            skipped_files.append(file_path)
                            continue

                    # Get the language type
                    language_type = get_language_type(file_path)

                    # Add to processed files
                    processed_files.append({
                        'file_path': file_path,
                        'token_count': file_data['token_count'],
                        'content': file_content,
                        'language_type': language_type
                    })
                else:
                    # File exists in DB but not on disk - mark it for skipping
                    skipped_files.append(file_path)

            # Skip files that don't exist on disk
            if skipped_files:
                app.logger.warning(
                    f"Files not found on disk: {', '.join(skipped_files)}")
                # Mark these files as processed with a special flag
                db = Database(app_directory=app.config['PROMPTER_DIRECTORY'])
                repo_file = RepositoryFile(db)
                for file_path in skipped_files:
                    repo_file.update_file_summary(
                        file_path=file_path, summary="[File not found on disk - skipped]")
                db.close()

            # If no valid files were processed, return appropriate response
            if not processed_files:
                return jsonify({
                    'message': 'No valid unsummarized files found',
                    'files': [],
                    'total_tokens': 0,
                    'file_count': 0
                }), 200

            # Generate a combined prompt
            combined_prompt = "Please analyze the following files and extract key information about their structure and purpose.\n\n"

            for file in processed_files:
                combined_prompt += f"File: {file['file_path']}\n\n"
                combined_prompt += f"```{file['language_type']}\n{file['content']}\n```\n\n"

            combined_prompt += """
For each file, extract and parse the content into the following format:

<FILE>
<PATH>[file path]</PATH>
<SUMMARY>
[Provide a concise 2-4 sentence description of the file's purpose and functionality. Focus on what this file does, what components it defines, and its role in the overall system. Be specific and technical, but clear.]
</SUMMARY>
<TREE>
[List all significant classes, interfaces, functions, methods, and constants defined in this file - one per line. Include only top-level elements and class methods, not local variables or nested utility functions. For each function or method, include a very brief indication of its purpose.]
</TREE>
<DEPENDENCIES>
[ONLY list internal project files that this file imports or depends on - one per line. Do NOT list standard library modules or external packages. If the file has no internal dependencies, leave this section empty or write nothing between the tags]
</DEPENDENCIES>
</FILE>

Important:
1. The SUMMARY should be technical but readable, explaining what this code does and why it exists
2. The TREE should list the key components that make up the file's API surface
3. The DEPENDENCIES section must ONLY list internal project files
4. Maintain the exact XML format with the tags as shown - this will be parsed automatically
5. Create a <FILE> section for EACH file in the prompt
6. Don't add any explanation or notes outside the XML structure
"""

            # Calculate total token count
            total_tokens = sum(file['token_count'] for file in processed_files)

            return jsonify({
                'files': processed_files,
                'total_tokens': total_tokens,
                'combined_prompt': combined_prompt,
                'file_count': len(processed_files)
            })
        except Exception as e:
            app.logger.error(
                f"Error in get_multiple_unsummarized_files: {str(e)}")
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

    @app.route('/api/update_multiple_file_summaries', methods=['POST'])
    def update_multiple_file_summaries():
        """Update summaries for multiple files"""
        try:
            # Get request data as JSON
            request_data = request.json

            if not request_data or not isinstance(request_data, list):
                return jsonify({'error': 'Invalid request format. Expected a list of file summary objects'}), 400

            # Import repository file class
            from utils.database import Database
            from utils.repository_file import RepositoryFile

            # Create database connection
            db = Database(app_directory=app.config['PROMPTER_DIRECTORY'])
            repo_file = RepositoryFile(db)

            # Update multiple file summaries
            success_count, errors = repo_file.update_multiple_file_summaries(
                request_data)

            # Close the database connection
            db.close()

            # Get the updated count of unsummarized files
            db = Database(app_directory=app.config['PROMPTER_DIRECTORY'])
            remaining_count = db.count_files_without_summary()
            db.close()

            return jsonify({
                'success': success_count > 0,
                'message': f'Updated {success_count} file(s) successfully',
                'success_count': success_count,
                'errors': errors,
                'error_count': len(errors),
                'remaining_count': remaining_count
            })
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

    @app.route('/api/get_ai_selection_prompt', methods=['GET'])
    def get_ai_selection_prompt():
        """Generate prompt for AI selection helper"""
        try:
            # Get the user prompt from session
            user_prompt = session.get('user_prompt', '')
            if not user_prompt:
                return jsonify({'error': 'No prompt found in session'}), 400

            # Get all repository files with their metadata
            from utils.database import Database
            from utils.repository_file import RepositoryFile

            db = Database(app_directory=app.config['PROMPTER_DIRECTORY'])
            repo_file = RepositoryFile(db)

            # Get all files from the repository with metadata
            files = repo_file.get_all()

            # Close the database connection
            db.close()

            # Filter out files that don't have a summary or have been skipped
            filtered_files = []
            for file in files:
                # Skip files without a summary or with "[Skipped]" in the summary
                if not file.get('summary') or not file['summary'].strip() or '[Skipped]' in file['summary']:
                    continue
                filtered_files.append(file)

            # Build the prompt
            prompt = "Based on the user's query, select the most relevant files from the codebase that would help address the query.\n\n"
            prompt += "USER QUERY:\n"
            prompt += f"{user_prompt}\n\n"

            prompt += "AVAILABLE FILES:\n"
            for file in filtered_files:
                prompt += f"File: {file['file_path']}\n"

                # Add token count
                prompt += f"Token Count: {file.get('token_count', 0)}\n"

                # Add summary
                prompt += f"Summary: {file['summary']}\n"

                # Add code structure if available
                if file.get('code_data') and isinstance(file['code_data'], dict) and file['code_data'].get('tree'):
                    tree = file['code_data']['tree']
                    if tree and len(tree) > 0:
                        prompt += "Structure: "
                        prompt += ", ".join(tree)
                        prompt += "\n"

                # Add dependencies if available
                if file.get('dependencies') and isinstance(file['dependencies'], list) and len(file['dependencies']) > 0:
                    prompt += "Dependencies: "
                    prompt += ", ".join(file['dependencies'])
                    prompt += "\n"

                prompt += "\n"

            prompt += "INSTRUCTIONS:\n"
            prompt += "Analyze the user query and the available files to select the most relevant files that would address the query. Structure your response in the following format:\n\n"

            prompt += "# Thoughts\n"
            prompt += "Think about which files are most relevant to the user's query based on their descriptions, structures, and token counts. Consider what functionality needs to be included to address the query effectively.\n\n"

            prompt += "# Dependency Considerations\n"
            prompt += "Analyze dependencies between files. If you select a file, consider whether its dependencies should also be included. Identify any potential dependency chains necessary for the functionality requested.\n\n"

            prompt += "# Selected Files\n"
            prompt += "List the file paths you've selected, one per line. Include only files from the AVAILABLE FILES section that are either:\n"
            prompt += "- Directly relevant to implementing the requested functionality\n"
            prompt += "- Dependencies required by selected files\n"
            prompt += "- Core utilities or helpers needed to understand the system's architecture\n\n"

            return jsonify({
                'success': True,
                'prompt': prompt
            })
        except Exception as e:
            app.logger.error(f"Error generating AI selection prompt: {str(e)}")
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
            # Split by newlines and trim whitespace
            file_paths = [line.strip()
                          for line in ai_response.splitlines() if line.strip()]

            # Remove any empty lines
            file_paths = [path for path in file_paths if path]

            # Store in session
            session['preselected_files'] = file_paths

            return jsonify({
                'success': True,
                'file_count': len(file_paths),
                'files': file_paths,
                'redirect_url': url_for('select_files')
            })
        except Exception as e:
            app.logger.error(f"Error processing AI selection: {str(e)}")
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
            app.logger.error(f"Error getting preselected files: {str(e)}")
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
            app.logger.error(f"Error clearing preselected files: {str(e)}")
            return jsonify({'error': str(e)}), 500
