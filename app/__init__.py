# ./app/__init__.py

from flask import Flask
import logging
from .config import Config
from .db import init_db
from .utils import initialize_magic
from .routes import main_bp
from .explorer_routes import explorer_bp


def create_app():
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

    # Initialize python-magic
    initialize_magic()

    # Register Blueprints
    app.register_blueprint(main_bp)
    app.register_blueprint(explorer_bp)

    return app
