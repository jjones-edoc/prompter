import os
from flask import Flask
from routes.summarizer_routes import register_summarizer_routes
from routes.navigation_routes import register_navigation_routes
from routes.search_routes import register_search_routes
from routes.ai_assistance_routes import register_ai_assistance_routes
from routes.file_modification_routes import register_file_modification_routes


def register_api_routes(app, scanner):
    """
    Register all API routes by delegating to specialized route modules.

    Args:
        app: Flask application instance
        scanner: Scanner instance for file operations
    """
    # Register specialized route modules
    register_summarizer_routes(app, scanner)
    register_navigation_routes(app, scanner)
    register_search_routes(app, scanner)
    register_ai_assistance_routes(app, scanner)
    register_file_modification_routes(app, scanner)
