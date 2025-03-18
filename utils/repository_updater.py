import os
from typing import Dict, List, Optional, Any, Set
import time

from utils.scanner import Scanner
from utils.repository_file import RepositoryFile
from utils.database import Database


class RepositoryUpdater:
    """
    Handles synchronization between filesystem and repository database.
    Scans files and directories and updates the repository_files table accordingly.
    """

    def __init__(self, root_dir: str, db: Database):
        """
        Initialize the repository updater.

        Args:
            root_dir: Root directory of the repository
            db: Database instance
        """
        self.root_dir = os.path.abspath(root_dir)
        self.db = db
        self.scanner = Scanner(root_dir)
        self.repo_file = RepositoryFile(db)
        self.stats = {
            'scanned': 0,
            'updated': 0,
            'added': 0,
            'skipped': 0,
            'errors': 0
        }

    def update_repository(self) -> Dict[str, int]:
        """
        Update the repository_files table based on the current file system state.
        Only updates entries where the modification time has changed.

        Returns:
            Dict with statistics about the operation
        """
        # Reset stats
        self.stats = {
            'scanned': 0,
            'updated': 0,
            'added': 0,
            'skipped': 0,
            'errors': 0
        }

        # Get all files recursively
        all_files = set()
        self._scan_directory("", all_files)

        # Get all existing file records
        db_files = {file['file_path']: file for file in self.repo_file.get_all()}

        # Process each file
        for file_path in all_files:
            self.stats['scanned'] += 1
            self._process_file(file_path, db_files)

        return self.stats

    def _scan_directory(self, dir_path: str, file_set: Set[str]) -> None:
        """
        Recursively scan a directory and add all file paths to the provided set.

        Args:
            dir_path: Directory path relative to root
            file_set: Set to store file paths
        """
        items = self.scanner.get_items(dir_path)

        # Add files in this directory
        for file_info in items['files']:
            # Ensure we're using the relative path
            rel_path = file_info['path']
            file_set.add(rel_path)

        # Process subdirectories
        for dir_info in items['dirs']:
            self._scan_directory(dir_info['path'], file_set)

    def _process_file(self, file_path: str, db_files: Dict[str, Any]) -> None:
        """
        Process a single file and update the database if needed.

        Args:
            file_path: Path to the file relative to the repository root
            db_files: Dictionary of existing files in the database
        """
        try:
            # Get absolute path for file operations while keeping the relative path for database
            abs_path = os.path.join(self.root_dir, file_path)

            # Get file info using absolute path
            last_modified = int(os.path.getmtime(abs_path))

            # Skip if file hasn't changed
            if file_path in db_files and db_files[file_path]['last_modified'] == last_modified:
                self.stats['skipped'] += 1
                return

            print(f"File changed: {file_path}")
            print(f"file_path in db_files: {file_path in db_files}")

            # Calculate file hash and token count using absolute path
            file_hash = self.scanner.calculate_file_hash(abs_path)
            token_count = self.scanner.count_tokens(abs_path)

            # Create or update record using relative path for file_path
            if file_path in db_files:
                # When a file is updated, we need to clear summary, code_data, and dependencies
                # so that it will be picked up for rescanning/summarizing
                self.repo_file.create_or_update(
                    file_path=file_path,  # Use relative path
                    token_count=token_count,
                    file_hash=file_hash,
                    last_modified=last_modified,
                    summary=None,  # Clear the summary
                    code_data=None,  # Clear code data
                    dependencies=None  # Clear dependencies
                )
                self.stats['updated'] += 1
            else:
                # Create new record
                self.repo_file.create_or_update(
                    file_path=file_path,  # Use relative path
                    token_count=token_count,
                    file_hash=file_hash,
                    last_modified=last_modified
                )
                self.stats['added'] += 1

        except Exception as e:
            print(f"Error processing file {file_path}: {str(e)}")
            self.stats['errors'] += 1
