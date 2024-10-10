# ./app/db/preferences.py

import logging
from .db import get_db
import sqlite3


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
