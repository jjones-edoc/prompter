# app/utils.py

import os
import logging
from pathlib import Path
from pathspec import PathSpec
from pathspec.patterns.gitwildmatch import GitWildMatchPattern
from flask import current_app, g
import magic

# Global magic instance
mime = None


def initialize_magic():
    global mime
    try:
        if os.name == 'nt':
            # Windows
            mime = magic.Magic(mime=True)
        else:
            # Unix/Linux/macOS
            mime = magic.Magic(mime=True, uncompress=True)
        logging.debug("Initialized python-magic successfully.")
    except ImportError:
        logging.error(
            "python-magic is not installed. Please install it using 'pip install python-magic' or 'pip install python-magic-bin' on Windows."
        )
        raise
    except Exception as e:
        logging.error(f"Failed to initialize python-magic: {e}")
        raise


def is_text_file(file_path):
    """
    Checks if a file is text-based using MIME types.
    """
    try:
        global mime
        if mime is None:
            logging.error("python-magic is not initialized.")
            return False

        mime_type = mime.from_file(str(file_path))
        is_text = mime_type in current_app.config['ALLOWED_MIME_TYPES']
        logging.debug(f"MIME type for {file_path}: {
                      mime_type} - {'Text' if is_text else 'Binary'}")
        return is_text
    except Exception as e:
        logging.error(f"Error determining MIME type for {file_path}: {e}")
        return False


def parse_gitignore(gitignore_path):
    """
    Parses a .gitignore file and returns a PathSpec object.
    """
    try:
        if not gitignore_path.exists():
            # Return an empty PathSpec if .gitignore does not exist
            logging.debug(f"No .gitignore found at {
                          gitignore_path}. Using empty PathSpec.")
            return PathSpec.from_lines(GitWildMatchPattern, [])

        with gitignore_path.open('r') as f:
            # Read and parse the .gitignore file
            spec = PathSpec.from_lines(GitWildMatchPattern, f)
            logging.debug(f"Parsed .gitignore from {gitignore_path}")
            return spec
    except Exception as e:
        logging.error(f"Failed to parse .gitignore at {gitignore_path}: {e}")
        return PathSpec.from_lines(GitWildMatchPattern, [])
