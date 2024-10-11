# ./app/db/slices.py

import logging
from .db import get_db
import sqlite3


def add_slice(file, slice_type, content):
    """
    Adds a new slice to the slices table and returns the added slice.
    """
    db = get_db()
    if db is None:
        logging.error("Database connection is not available.")
        return None

    try:
        cursor = db.execute('''
            INSERT INTO slices (file, type, content)
            VALUES (?, ?, ?)
        ''', (file, slice_type, content))
        db.commit()
        slice_id = cursor.lastrowid
        logging.debug(f"Added slice: id={slice_id}, file={
                      file}, type={slice_type}, content={content}")

        # Retrieve the newly added slice
        new_slice = db.execute('''
            SELECT id, file, type, content FROM slices WHERE id = ?
        ''', (slice_id,)).fetchone()

        if new_slice:
            return {
                'id': new_slice['id'],
                'file': new_slice['file'],
                'type': new_slice['type'],
                'content': new_slice['content']
            }
        else:
            logging.error(
                f"Failed to retrieve the newly added slice with ID {slice_id}.")
            return None

    except sqlite3.Error as e:
        logging.error(f"Failed to add slice: {e}")
        return None


def update_slice(slice_id, file, slice_type, content):
    """
    Updates a slice in the slices table by its id and returns the updated slice.
    """
    db = get_db()
    if db is None:
        logging.error("Database connection is not available.")
        return None

    try:
        cursor = db.execute('''
            UPDATE slices
            SET file = ?, type = ?, content = ?
            WHERE id = ?
        ''', (file, slice_type, content, slice_id))
        db.commit()

        if cursor.rowcount > 0:
            logging.debug(f"Updated slice ID {slice_id} with file={
                          file}, type={slice_type}, content={content}")

            # Retrieve the updated slice
            updated_slice = db.execute('''
                SELECT id, file, type, content FROM slices WHERE id = ?
            ''', (slice_id,)).fetchone()

            if updated_slice:
                return {
                    'id': updated_slice['id'],
                    'file': updated_slice['file'],
                    'type': updated_slice['type'],
                    'content': updated_slice['content']
                }
            else:
                logging.error(
                    f"Failed to retrieve the updated slice with ID {slice_id}.")
                return None
        else:
            logging.debug(f"No slice found with ID {slice_id} to update.")
            return None

    except sqlite3.Error as e:
        logging.error(f"Failed to update slice ID {slice_id}: {e}")
        return None


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
        cursor = db.execute('SELECT id, file, type, content FROM slices')
        slices = [{'id': row['id'], 'file': row['file'], 'type': row['type'], 'content': row['content']}
                  for row in cursor.fetchall()]
        logging.debug(f"Retrieved {len(slices)} slices.")
        return slices
    except sqlite3.Error as e:
        logging.error(f"Database error while retrieving slices: {e}")
    return []


def get_selected_files():
    """
    Retrieves all slices from the slices table where the file is not empty and type='file'.
    Returns a list of files.
    """
    db = get_db()
    if db is None:
        logging.error("Database connection is not available.")
        return []

    try:
        cursor = db.execute(
            'SELECT file FROM slices WHERE file != ? AND type = ?', ('', "file"))
        files = [row['file'] for row in cursor.fetchall()]
        logging.debug(f"Retrieved {len(files)} files.")
        return files
    except sqlite3.Error as e:
        logging.error(f"Database error while retrieving files: {e}")
    return []


def add_selected_file(file):
    """
    Adds a selected file to the slices table.
    Returns the added slice.
    """
    return add_slice(file, 'file', '')


def remove_selected_file(file):
    """
    Removes a selected file from the slices table.
    """
    db = get_db()
    if db is None:
        logging.error("Database connection is not available.")
        return False

    try:
        cursor = db.execute(
            'DELETE FROM slices WHERE file = ? AND type = ?', (file, "file"))
        db.commit()
        if cursor.rowcount > 0:
            logging.debug(f"Removed selected file: {file}")
            return True
        else:
            logging.debug(f"No selected file found: {file}")
            return False
    except sqlite3.Error as e:
        logging.error(f"Failed to remove selected file: {e}")
        return False


def db_clear_all_selected_files():
    """
    Clears all selected files from the slices table.
    """
    db = get_db()
    if db is None:
        logging.error("Database connection is not available.")
        return False

    try:
        cursor = db.execute('DELETE FROM slices WHERE type = ?', ("file",))
        db.commit()
        logging.debug("Cleared all selected files.")
        return True
    except sqlite3.Error as e:
        logging.error(f"Failed to clear all selected files: {e}")
        return False
