from flask import request, jsonify, current_app, render_template
import os
from typing import Dict, List, Any, Optional

# Import from the local helpers module
from features.summarizer.helpers import generate_summary_prompt, parse_ai_response


def register_summarizer_routes(app, scanner):
    """
    Register routes related to file summarization.

    Args:
        app: Flask application instance
        scanner: Scanner instance for file operations
    """
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

            # Create database connection
            db = Database(app_directory=app.config['PROMPTER_DIRECTORY'])
            repo_file = RepositoryFile(db)

            # Get the count of files without summaries first
            unsummarized_count = db.count_files_without_summary()

            # Log the count for debugging
            current_app.logger.info(
                f"Unsummarized files count: {unsummarized_count}")

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
                    current_app.logger.warning(
                        f"File not found on disk: {file_path}")
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
            current_app.logger.error(
                f"Error in get_next_unsummarized_file: {str(e)}")
            return jsonify({'error': str(e)}), 500

    @app.route('/unfamiliar', methods=['GET'])
    def unfamiliar_files():
        """Show the unfamiliar files page for processing files without summaries"""
        # Create a temporary database connection to get stats
        from utils.database import Database
        from utils.repository_file import RepositoryFile

        db = Database(app_directory=app.config['PROMPTER_DIRECTORY'])
        repo_file = RepositoryFile(db)

        # Get count of files without summaries
        unsummarized_count = db.count_files_without_summary()

        # Get the first unsummarized file if available
        next_file = None
        if unsummarized_count > 0:
            next_file = repo_file.get_next_unsummarized_file()

        # Close the database connection
        db.close()

        return render_template('unfamiliar.html',
                               unsummarized_count=unsummarized_count,
                               next_file=next_file)

    @app.route('/api/get_multiple_unsummarized_files', methods=['GET'])
    def get_multiple_unsummarized_files():
        """Get multiple files without summaries, up to a token limit"""
        try:
            # Get token limit from request, default to 50000
            token_limit = request.args.get('token_limit', 50000, type=int)

            # Import repository file class and file summarizer
            from utils.database import Database
            from utils.repository_file import RepositoryFile
            from utils.helpers import get_language_type

            # Create database connection
            db = Database(app_directory=app.config['PROMPTER_DIRECTORY'])
            repo_file = RepositoryFile(db)

            # Get the count of files without summaries first
            unsummarized_count = db.count_files_without_summary()

            # Log the count for debugging
            current_app.logger.info(
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
                            current_app.logger.error(
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
                current_app.logger.warning(
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
            current_app.logger.error(
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
