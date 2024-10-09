# app/config.py

import os


class Config:
    # General Config
    SECRET_KEY = os.environ.get('SECRET_KEY', 'your_default_secret_key')
    DATABASE = os.path.join(os.path.abspath(
        os.path.dirname(__file__)), '..', 'app.db')

    # Logging Config
    LOG_LEVEL = 'DEBUG'  # Use string representation

    # Allowed MIME Types
    ALLOWED_MIME_TYPES = {
        'text/plain',
        'text/html',
        'text/css',
        'application/javascript',
        'application/json',
        'text/markdown',
        'text/xml',
        'application/xml',
        'text/x-python',
        'text/x-c',
        'text/x-java',
        'text/x-shellscript',
        'application/x-sh',
        # Add more MIME types as needed
    }
