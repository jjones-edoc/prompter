import os
import sqlite3
import threading
import time
from pathlib import Path
from typing import Dict, List, Optional, Tuple, Any, Union

# Thread-local storage for database connections
_local = threading.local()


class Database:
    """SQLite database handler with connection pooling and thread safety."""

    def __init__(self, app_directory: str = None, db_name: str = "prompter.db"):
        """
        Initialize the database handler.

        Args:
            app_directory: The application's configured directory (from app.config['PROMPTER_DIRECTORY'])
            db_name: Name of the database file (defaults to "prompter.db")
        """
        # Use the app's configured directory or current directory if none provided
        base_dir = app_directory or os.getcwd()
        self.db_path = os.path.join(base_dir, db_name)
        self.db_dir = os.path.dirname(self.db_path)

        # Create directory if it doesn't exist
        if not os.path.exists(self.db_dir):
            os.makedirs(self.db_dir)

        # Add database file to .gitignore if needed
        self._add_to_gitignore(base_dir, db_name)

        # Initialize the database with schema
        self._init_database()

    def _add_to_gitignore(self, base_dir: str, db_name: str) -> None:
        """
        Add the database file to .gitignore if it exists and doesn't already include it.

        Args:
            base_dir: The base directory to look for .gitignore
            db_name: Name of the database file
        """
        gitignore_path = os.path.join(base_dir, '.gitignore')

        # Check if .gitignore exists
        if not os.path.exists(gitignore_path):
            return

        # Check if db_name is already in .gitignore
        try:
            with open(gitignore_path, 'r', encoding='utf-8') as f:
                content = f.read()
                if db_name in content.split('\n'):
                    return  # Already in .gitignore

            # Add db_name to .gitignore
            with open(gitignore_path, 'a', encoding='utf-8') as f:
                # Add a newline first if the file doesn't end with one
                if content and not content.endswith('\n'):
                    f.write('\n')
                f.write(f'{db_name}\n')
        except Exception as e:
            print(f"Warning: Could not update .gitignore: {str(e)}")

    def _get_connection(self) -> sqlite3.Connection:
        """
        Get a thread-local database connection.

        Returns:
            sqlite3.Connection: Database connection
        """
        if not hasattr(_local, 'connection'):
            _local.connection = sqlite3.connect(self.db_path)
            # Enable foreign keys
            _local.connection.execute("PRAGMA foreign_keys = ON")
            # Configure connection to return rows as dictionaries
            _local.connection.row_factory = sqlite3.Row

        return _local.connection

    def _init_database(self) -> None:
        """Initialize the database schema if it doesn't exist."""
        conn = self._get_connection()
        cursor = conn.cursor()

        # Create repository_files table
        cursor.execute('''
        CREATE TABLE IF NOT EXISTS repository_files (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            file_path TEXT UNIQUE NOT NULL,
            file_hash TEXT NOT NULL,
            token_count INTEGER NOT NULL,
            summary TEXT,
            code_data TEXT,
            dependencies TEXT,
            last_modified INTEGER NOT NULL
        )
        ''')

        # Create index on file_path for faster lookups
        cursor.execute('''
        CREATE INDEX IF NOT EXISTS idx_repository_files_file_path
        ON repository_files (file_path)
        ''')

        # Create index on file_hash for faster change detection
        cursor.execute('''
        CREATE INDEX IF NOT EXISTS idx_repository_files_file_hash
        ON repository_files (file_hash)
        ''')

        conn.commit()

    def execute(self, query: str, params: tuple = ()) -> sqlite3.Cursor:
        """
        Execute a query with parameters.

        Args:
            query: SQL query to execute
            params: Query parameters

        Returns:
            sqlite3.Cursor: Query cursor
        """
        conn = self._get_connection()
        return conn.execute(query, params)

    def executemany(self, query: str, params_list: List[tuple]) -> sqlite3.Cursor:
        """
        Execute a query with multiple parameter sets.

        Args:
            query: SQL query to execute
            params_list: List of parameter tuples

        Returns:
            sqlite3.Cursor: Query cursor
        """
        conn = self._get_connection()
        return conn.executemany(query, params_list)

    def commit(self) -> None:
        """Commit the current transaction."""
        if hasattr(_local, 'connection'):
            _local.connection.commit()

    def rollback(self) -> None:
        """Rollback the current transaction."""
        if hasattr(_local, 'connection'):
            _local.connection.rollback()

    def close(self) -> None:
        """Close the database connection."""
        if hasattr(_local, 'connection'):
            _local.connection.close()
            del _local.connection

    def transaction(self):
        """Context manager for database transactions."""
        return DatabaseTransaction(self)

    def get_repository_file(self, file_path: str) -> Optional[Dict[str, Any]]:
        """
        Get a repository file by path.

        Args:
            file_path: Path to the file

        Returns:
            Dict or None: File data if found, None otherwise
        """
        cursor = self.execute(
            "SELECT * FROM repository_files WHERE file_path = ?",
            (file_path,)
        )
        row = cursor.fetchone()
        return dict(row) if row else None

    def upsert_repository_file(self, file_data: Dict[str, Any]) -> int:
        """
        Insert or update a repository file.

        Args:
            file_data: File data dictionary

        Returns:
            int: ID of the inserted/updated record
        """
        # Check if file exists
        existing = self.get_repository_file(file_data['file_path'])

        if existing:
            # Update existing record
            placeholders = ", ".join(
                [f"{k} = ?" for k in file_data.keys() if k != 'id'])
            values = [file_data[k] for k in file_data.keys() if k != 'id']
            values.append(existing['id'])

            cursor = self.execute(
                f"UPDATE repository_files SET {placeholders} WHERE id = ?",
                tuple(values)
            )
            self.commit()
            return existing['id']
        else:
            # Insert new record
            placeholders = ", ".join(["?"] * len(file_data))
            columns = ", ".join(file_data.keys())

            cursor = self.execute(
                f"INSERT INTO repository_files ({columns}) VALUES ({placeholders})",
                tuple(file_data.values())
            )
            self.commit()
            return cursor.lastrowid

    def delete_repository_file(self, file_path: str) -> bool:
        """
        Delete a repository file.

        Args:
            file_path: Path to the file

        Returns:
            bool: True if deleted, False if not found
        """
        cursor = self.execute(
            "DELETE FROM repository_files WHERE file_path = ?",
            (file_path,)
        )
        self.commit()
        return cursor.rowcount > 0

    def get_all_repository_files(self) -> List[Dict[str, Any]]:
        """
        Get all repository files.

        Returns:
            List[Dict]: List of all repository files
        """
        cursor = self.execute(
            "SELECT * FROM repository_files ORDER BY file_path")
        return [dict(row) for row in cursor.fetchall()]

    def search_repository_files(self, query: str) -> List[Dict[str, Any]]:
        """
        Search repository files by path or summary.

        Args:
            query: Search query

        Returns:
            List[Dict]: List of matching repository files
        """
        search_param = f"%{query}%"
        cursor = self.execute(
            """
            SELECT * FROM repository_files 
            WHERE file_path LIKE ? 
            OR summary LIKE ?
            ORDER BY file_path
            """,
            (search_param, search_param)
        )
        return [dict(row) for row in cursor.fetchall()]
        
    def count_files_without_summary(self) -> int:
        """
        Count the number of repository files that don't have summary data.
        
        Returns:
            int: Count of files without summaries
        """
        cursor = self.execute(
            """
            SELECT COUNT(*) as count FROM repository_files
            WHERE summary IS NULL OR summary = ''
            """
        )
        result = cursor.fetchone()
        return result['count'] if result else 0


class DatabaseTransaction:
    """Context manager for database transactions."""

    def __init__(self, db: Database):
        self.db = db

    def __enter__(self):
        return self.db

    def __exit__(self, exc_type, exc_val, exc_tb):
        if exc_type is not None:
            # An exception occurred, rollback
            self.db.rollback()
        else:
            # No exception, commit
            self.db.commit()
