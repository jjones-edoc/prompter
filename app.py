import os
from flask import Flask
from routes.main_routes import register_main_routes
from routes.navigation_routes import register_navigation_routes
from routes.search_routes import register_search_routes
from utils.scanner import Scanner
from utils.database import Database
from utils.repository_updater import RepositoryUpdater

# Import from new feature-based structure
from features.ai_assistance.routes import register_ai_assistance_routes
from features.summarizer.routes import register_summarizer_routes
from features.file_modification.routes import register_file_modification_routes


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
                        f"{stats['deleted']} deleted, "
                        f"{stats['skipped']} skipped, {stats['errors']} errors")

    # Register route blueprints
    register_main_routes(app, scanner)
    register_navigation_routes(app, scanner)
    register_search_routes(app, scanner)
    register_ai_assistance_routes(app, scanner)  # Coming from features/ai_assistance
    register_summarizer_routes(app, scanner)  # Coming from features/summarizer
    register_file_modification_routes(app, scanner)  # Coming from features/file_modification

    return app


if __name__ == '__main__':
    current_dir = os.getcwd()  # Get the current directory
    app = create_app(current_dir, scan_on_startup=True)
    app.run(debug=True)
