from flask import request, jsonify, current_app


def register_file_modification_routes(app, scanner):
    """
    Register routes related to file modifications.

    Args:
        app: Flask application instance
        scanner: Scanner instance for file operations
    """
    @app.route('/api/process_claude_response', methods=['POST'])
    def process_claude_response():
        """Process the response pasted from Claude to modify files"""
        claude_response = request.form.get('claude_response', '')
        if not claude_response:
            return jsonify({'error': 'No response provided'}), 400

        try:
            # Import our processor
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
            current_app.logger.error(
                f"Error processing Claude response: {str(e)}")
            return jsonify({'error': str(e)}), 500
