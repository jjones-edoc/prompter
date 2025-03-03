import os
from flask import Flask
from routes.main_routes import register_main_routes
from routes.api_routes import register_api_routes
from utils.scanner import Scanner


def create_app(directory: str):
    app = Flask(__name__)
    app.secret_key = os.urandom(24)  # Secret key for session management

    # Configure app
    app.config['PROMPTER_DIRECTORY'] = directory

    # Create file system handler
    scanner = Scanner(directory)

    # Register route blueprints
    register_main_routes(app, scanner)
    register_api_routes(app, scanner)

    return app


if __name__ == '__main__':
    current_dir = os.getcwd()  # Get the current directory
    app = create_app(current_dir)
    app.run(debug=True)
