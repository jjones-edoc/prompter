# ./app/db.py

import sqlite3
from flask import g, current_app
import logging


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
                        path TEXT NOT NULL,
                        UNIQUE(name, path)
                    )
                ''')
                db.commit()
                logging.debug(
                    "Initialized the SQLite database and ensured app_preferences and files tables exist.")
            except sqlite3.Error as e:
                logging.error(f"Failed to initialize database: {e}")
        app.teardown_appcontext(close_db)
