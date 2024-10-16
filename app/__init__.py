# ./app/__init__.py

from flask import Flask
import logging
from .config import Config
from .db.db import init_db
from .utils import initialize_magic
from .routes import main_bp
from .explorer_routes import explorer_bp
from .builder_routes import builder_bp
from .db.preferences import set_preference


def create_app(current_dir):
    app = Flask(__name__)
    app.config.from_object(Config)

    # Configure logging
    log_level = getattr(
        logging, app.config['LOG_LEVEL'].upper(), logging.DEBUG)
    logging.basicConfig(
        level=log_level,
        format='%(asctime)s %(levelname)s: %(message)s [in %(pathname)s:%(lineno)d]'
    )

    # Initialize the database
    init_db(app)

    with app.app_context():
        logging.debug(
            "Setting last_path preference to current directory: %s", current_dir)
        success = set_preference('last_path', current_dir)
        if not success:
            logging.error("Failed to set last_path preference.")
        else:
            logging.debug(f"Set last_path preference: {current_dir}")

    # Initialize python-magic
    initialize_magic()

    # Register Blueprints
    app.register_blueprint(main_bp)
    app.register_blueprint(explorer_bp)
    app.register_blueprint(builder_bp)

    return app
