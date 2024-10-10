# ./app/db/files.py

import logging
import os
from .db import get_db
import sqlite3


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
            ON CONFLICT(name, path) DO NOTHING
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


def db_clear_all_selected_files():
    """
    Removes all files from the files table.
    Returns True on success, False otherwise.
    """
    db = get_db()
    if db is None:
        logging.error("Database connection is not available.")
        return False

    try:
        db.execute('''
            DELETE FROM files
        ''')
        db.commit()
        logging.debug("Cleared all selected files.")
        return True
    except sqlite3.Error as e:
        logging.error(f"Failed to clear selected files: {e}")
        return False
