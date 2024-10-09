# ./app/db.py

import sqlite3
from flask import g, current_app
import logging
import os
import json


def get_db():
    if 'db' not in g:
        try:
            g.db = sqlite3.connect(
                current_app.config['DATABASE'],
                detect_types=sqlite3.PARSE_DECLTYPES
            )
            g.db.row_factory = sqlite3.Row
        except sqlite3.Error as e:
            logging.error(f"Database connection failed: {e}")
            g.db = None
    return g.db


def close_db(e=None):
    db = g.pop('db', None)
    if db is not None:
        db.close()


def init_db(app):
    with app.app_context():
        db = get_db()
        if db is not None:
            try:
                db.execute('''
                    CREATE TABLE IF NOT EXISTS app_preferences (
                        key TEXT PRIMARY KEY,
                        value TEXT
                    )
                ''')
                db.execute('''
                    CREATE TABLE IF NOT EXISTS files (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        name TEXT NOT NULL,
                        path TEXT NOT NULL UNIQUE
                    )
                ''')
                db.commit()
                logging.debug(
                    "Initialized the SQLite database and ensured app_preferences and files tables exist.")
            except sqlite3.Error as e:
                logging.error(f"Failed to initialize database: {e}")
        app.teardown_appcontext(close_db)


def get_preference(key):
    """
    Retrieves the value for the given key from the app_preferences table.
    Returns None if the key does not exist or on error.
    """
    db = get_db()
    if db is None:
        logging.error("Database connection is not available.")
        return None

    try:
        cursor = db.execute(
            'SELECT value FROM app_preferences WHERE key = ?', (key,))
        row = cursor.fetchone()
        if row:
            value = row['value']
            logging.debug(f"Retrieved preference: {key} = {value}")
            return value
        else:
            logging.debug(f"No preference found for key: {key}")
    except sqlite3.Error as e:
        logging.error(f"Database error while retrieving {key}: {e}")
    return None


def set_preference(key, value):
    """
    Sets the value for the given key in the app_preferences table.
    Inserts a new row or updates the existing one.
    """
    db = get_db()
    if db is None:
        logging.error("Database connection is not available.")
        return False

    try:
        db.execute('''
            INSERT INTO app_preferences (key, value)
            VALUES (?, ?)
            ON CONFLICT(key) DO UPDATE SET value=excluded.value
        ''', (key, value))
        db.commit()
        logging.debug(f"Set preference: {key} = {value}")
        return True
    except sqlite3.Error as e:
        logging.error(f"Failed to set preference {key}: {e}")
        return False


def get_files():
    """
    Retrieves a list of all files.
    Returns a list of dictionaries with 'id' and 'name'.
    """
    db = get_db()
    if db is None:
        logging.error("Database connection is not available.")
        return []

    try:
        cursor = db.execute('SELECT id, name FROM files')
        files = [{'id': row['id'], 'name': row['name']}
                 for row in cursor.fetchall()]
        logging.debug(f"Retrieved {len(files)} files.")
        return files
    except sqlite3.Error as e:
        logging.error(f"Database error while retrieving files: {e}")
    return []


def get_selected_files():
    """
    Retrieves a list of all selected files as full paths.
    Returns a list of strings.
    """
    db = get_db()
    if db is None:
        logging.error("Database connection is not available.")
        return []

    try:
        cursor = db.execute('SELECT path, name FROM files')
        selected_files = [os.path.join(row['path'], row['name'])
                          for row in cursor.fetchall()]
        logging.debug(f"Retrieved {len(selected_files)} selected files.")
        return selected_files
    except sqlite3.Error as e:
        logging.error(f"Database error while retrieving selected files: {e}")
    return []


def get_file_path_by_id(file_id):
    """
    Retrieves the full file path by its ID.
    Returns the combined path and name or None if not found.
    """
    db = get_db()
    if db is None:
        logging.error("Database connection is not available.")
        return None

    try:
        cursor = db.execute(
            'SELECT path, name FROM files WHERE id = ?', (file_id,))
        row = cursor.fetchone()
        if row:
            full_path = os.path.join(row['path'], row['name'])
            logging.debug(f"Retrieved file path for ID {file_id}: {full_path}")
            return full_path
        else:
            logging.debug(f"No file found with ID: {file_id}")
    except sqlite3.Error as e:
        logging.error(
            f"Database error while retrieving file ID {file_id}: {e}")
    return None


def add_selected_file(file_path):
    """
    Adds a file to the files table.
    Parses the file_path into directory path and file name.
    Returns True on success, False otherwise.
    """
    db = get_db()
    if db is None:
        logging.error("Database connection is not available.")
        return False

    try:
        directory, name = os.path.split(file_path)
        db.execute('''
            INSERT INTO files (name, path)
            VALUES (?, ?)
            ON CONFLICT(path) DO NOTHING
        ''', (name, directory))
        db.commit()
        logging.debug(f"Added selected file: {name} at {directory}")
        return True
    except sqlite3.Error as e:
        logging.error(f"Failed to add selected file {file_path}: {e}")
        return False


def remove_selected_file(file_path):
    """
    Removes a file from the files table based on its file_path.
    Returns True on success, False otherwise.
    """
    db = get_db()
    if db is None:
        logging.error("Database connection is not available.")
        return False

    try:
        directory, name = os.path.split(file_path)
        cursor = db.execute('''
            DELETE FROM files
            WHERE path = ? AND name = ?
        ''', (directory, name))
        db.commit()
        if cursor.rowcount > 0:
            logging.debug(f"Removed selected file: {name} from {directory}")
            return True
        else:
            logging.debug(f"No file found to remove for path: {file_path}")
            return False
    except sqlite3.Error as e:
        logging.error(f"Failed to remove selected file {file_path}: {e}")
        return False
