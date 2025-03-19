from flask import request, jsonify, current_app


def register_search_routes(app, scanner):
    """
    Register routes related to searching files.

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
