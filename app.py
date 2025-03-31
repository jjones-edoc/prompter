import os
from flask import Flask, render_template
from utils.scanner import Scanner

from features.navigation.routes import register_navigation_routes
from features.file_modification.routes import register_file_modification_routes
from features.prompt_generation.routes import register_prompt_generation_routes


def create_app(directory: str):
    app = Flask(__name__)
    app.secret_key = os.urandom(24)  # Secret key for session management

    # Configure app
    app.config['PROMPTER_DIRECTORY'] = directory

    # Create file system handler
    scanner = Scanner(directory)
    app.config['SCANNER'] = scanner

    register_prompt_generation_routes(app, scanner)
    register_navigation_routes(app, scanner)  # Coming from features/navigation
    register_file_modification_routes(app, scanner)

    return app


if __name__ == '__main__':
    current_dir = os.getcwd()  # Get the current directory
    app = create_app(current_dir)
    app.run(debug=True, use_reloader=False)
