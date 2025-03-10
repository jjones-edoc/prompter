import os
from flask import Flask
from routes.main_routes import register_main_routes
from routes.api_routes import register_api_routes
from utils.scanner import Scanner
from utils.database import Database
from utils.repository_updater import RepositoryUpdater


def create_app(directory: str, scan_on_startup: bool = True):
    app = Flask(__name__)
    app.secret_key = os.urandom(24)  # Secret key for session management

    # Configure app
    app.config['PROMPTER_DIRECTORY'] = directory

    # Initialize the database with the configured directory
    db = Database(app_directory=app.config['PROMPTER_DIRECTORY'])
    app.config['DATABASE'] = db

    # Create file system handler
    scanner = Scanner(directory)
    app.config['SCANNER'] = scanner

    # Update repository database if scan_on_startup is enabled
    if scan_on_startup:
        repository_updater = RepositoryUpdater(directory, db)
        stats = repository_updater.update_repository()
        app.logger.info(f"Repository scan completed: {stats['scanned']} files scanned, "
                        f"{stats['added']} added, {stats['updated']} updated, "
                        f"{stats['skipped']} skipped, {stats['errors']} errors")

    # Register route blueprints
    register_main_routes(app, scanner)
    register_api_routes(app, scanner)

    return app


if __name__ == '__main__':
    current_dir = os.getcwd()  # Get the current directory
    app = create_app(current_dir, scan_on_startup=True)
    app.run(debug=True)
