# ./app/db/slices.py

import logging
from .db import get_db
import sqlite3


def add_slice(slice_type, content):
    """
    Adds a new slice to the slices table.
    """
    db = get_db()
    if db is None:
        logging.error("Database connection is not available.")
        return False

    try:
        db.execute('''
            INSERT INTO slices (type, content)
            VALUES (?, ?, ?)
        ''', (slice_type, content))
        db.commit()
        logging.debug(f"Added slice: type={slice_type}, content={content}")
        return True
    except sqlite3.Error as e:
        logging.error(f"Failed to add slice: {e}")
        return False


def update_slice(slice_id, slice_type, content):
    """
    Updates a slice in the slices table by its id.
    """
    db = get_db()
    if db is None:
        logging.error("Database connection is not available.")
        return False

    try:
        db.execute('''
            UPDATE slices
            SET type = ?, content = ?
            WHERE id = ?
        ''', (slice_type, content, slice_id))
        db.commit()
        logging.debug(f"Updated slice ID {slice_id} with type={
                      slice_type}, content={content}")
        return True
    except sqlite3.Error as e:
        logging.error(f"Failed to update slice ID {slice_id}: {e}")
        return False


def delete_slice(slice_id):
    """
    Deletes a slice from the slices table by its id.
    """
    db = get_db()
    if db is None:
        logging.error("Database connection is not available.")
        return False

    try:
        cursor = db.execute('''
            DELETE FROM slices WHERE id = ?
        ''', (slice_id,))
        db.commit()
        if cursor.rowcount > 0:
            logging.debug(f"Deleted slice ID {slice_id}")
            return True
        else:
            logging.debug(f"No slice found with ID {slice_id}")
            return False
    except sqlite3.Error as e:
        logging.error(f"Failed to delete slice ID {slice_id}: {e}")
        return False


def get_all_slices():
    """
    Retrieves all slices from the slices table.
    Returns a list of dictionaries representing each slice.
    """
    db = get_db()
    if db is None:
        logging.error("Database connection is not available.")
        return []

    try:
        cursor = db.execute('SELECT id, type, content FROM slices')
        slices = [{'id': row['id'], 'type': row['type'], 'content': row['content']}
                  for row in cursor.fetchall()]
        logging.debug(f"Retrieved {len(slices)} slices.")
        return slices
    except sqlite3.Error as e:
        logging.error(f"Database error while retrieving slices: {e}")
    return []
