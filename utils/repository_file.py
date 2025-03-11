import os
import json
import hashlib
import time
from typing import Dict, List, Optional, Any, Union

from utils.database import Database


class RepositoryFile:
    """Model for repository file records in the database."""

    def __init__(self, db: Database):
        """
        Initialize the repository file model.

        Args:
            db: Database instance
        """
        self.db = db

    @staticmethod
    def calculate_file_hash(file_path: str) -> str:
        """
        Calculate a SHA-256 hash of a file's contents.

        Args:
            file_path: Path to the file

        Returns:
            str: Hexadecimal hash string
        """
        hash_sha256 = hashlib.sha256()

        try:
            with open(file_path, 'rb') as f:
                for chunk in iter(lambda: f.read(4096), b''):
                    hash_sha256.update(chunk)
            return hash_sha256.hexdigest()
        except Exception as e:
            # Return a hash of the error string for files that can't be read
            return hashlib.sha256(str(e).encode()).hexdigest()

    def create_or_update(self, file_path: str, token_count: int,
                         file_hash: Optional[str] = None, summary: Optional[str] = None,
                         code_data: Optional[Dict] = None, last_modified: Optional[int] = None,
                         dependencies: Optional[List[str]] = None) -> int:
        """
        Create or update a repository file record.

        Args:
            file_path: Path to the file (relative to repository root)
            token_count: Number of tokens in the file
            file_hash: File content hash (calculated if not provided)
            summary: Optional summary of the file
            code_data: Optional JSON-serializable data about the code
            dependencies: Optional list of dependencies

        Returns:
            int: ID of the inserted/updated record
        """
        # Convert relative path to absolute for hash calculation
        abs_path = os.path.abspath(file_path)

        # Calculate hash if not provided
        if file_hash is None:
            file_hash = self.calculate_file_hash(abs_path)

        # Serialize code_data and dependencies to JSON strings
        if code_data is not None:
            code_data = json.dumps(code_data)

        if dependencies is not None:
            dependencies = json.dumps(dependencies)

        # Use provided last_modified or current time
        current_time = last_modified if last_modified is not None else int(time.time())

        # Prepare data for database
        file_data = {
            'file_path': file_path,
            'file_hash': file_hash,
            'token_count': token_count,
            'summary': summary,
            'code_data': code_data,
            'dependencies': dependencies,
            'last_modified': current_time
        }

        # Filter out None values
        file_data = {k: v for k, v in file_data.items() if v is not None}

        # Insert or update in the database
        return self.db.upsert_repository_file(file_data)

    def get_by_path(self, file_path: str) -> Optional[Dict[str, Any]]:
        """
        Get a repository file by path.

        Args:
            file_path: Path to the file

        Returns:
            Dict or None: File data if found, None otherwise
        """
        file_data = self.db.get_repository_file(file_path)

        if file_data and file_data.get('code_data'):
            try:
                file_data['code_data'] = json.loads(file_data['code_data'])
            except json.JSONDecodeError:
                pass

        if file_data and file_data.get('dependencies'):
            try:
                file_data['dependencies'] = json.loads(
                    file_data['dependencies'])
            except json.JSONDecodeError:
                pass

        return file_data

    def delete(self, file_path: str) -> bool:
        """
        Delete a repository file.

        Args:
            file_path: Path to the file

        Returns:
            bool: True if deleted, False if not found
        """
        return self.db.delete_repository_file(file_path)

    def has_changed(self, file_path: str, abs_path: str) -> bool:
        """
        Check if a file has changed since it was last processed.

        Args:
            file_path: Relative path to the file
            abs_path: Absolute path to the file for hash calculation

        Returns:
            bool: True if the file has changed or doesn't exist in the database
        """
        existing_file = self.get_by_path(file_path)
        if not existing_file:
            return True

        current_hash = self.calculate_file_hash(abs_path)
        return current_hash != existing_file['file_hash']

    def get_all(self) -> List[Dict[str, Any]]:
        """
        Get all repository files.

        Returns:
            List[Dict]: List of all repository files
        """
        files = self.db.get_all_repository_files()

        # Process JSON strings
        for file_data in files:
            if file_data.get('code_data'):
                try:
                    file_data['code_data'] = json.loads(file_data['code_data'])
                except json.JSONDecodeError:
                    pass

            if file_data.get('dependencies'):
                try:
                    file_data['dependencies'] = json.loads(
                        file_data['dependencies'])
                except json.JSONDecodeError:
                    pass

        return files

    def search(self, query: str) -> List[Dict[str, Any]]:
        """
        Search repository files.

        Args:
            query: Search query

        Returns:
            List[Dict]: List of matching repository files
        """
        files = self.db.search_repository_files(query)

        # Process JSON strings
        for file_data in files:
            if file_data.get('code_data'):
                try:
                    file_data['code_data'] = json.loads(file_data['code_data'])
                except json.JSONDecodeError:
                    pass

            if file_data.get('dependencies'):
                try:
                    file_data['dependencies'] = json.loads(
                        file_data['dependencies'])
                except json.JSONDecodeError:
                    pass

        return files
        
    def get_next_unsummarized_file(self) -> Optional[Dict[str, Any]]:
        """
        Get the next file that doesn't have a summary.
        
        Returns:
            Dict or None: File data for the next file without a summary, or None if all files have summaries
        """
        cursor = self.db.execute(
            """
            SELECT * FROM repository_files
            WHERE summary IS NULL OR summary = ''
            ORDER BY file_path
            LIMIT 1
            """
        )
        row = cursor.fetchone()
        
        if not row:
            return None
            
        file_data = dict(row)
        
        # Process JSON strings if present
        if file_data.get('code_data'):
            try:
                file_data['code_data'] = json.loads(file_data['code_data'])
            except json.JSONDecodeError:
                pass

        if file_data.get('dependencies'):
            try:
                file_data['dependencies'] = json.loads(
                    file_data['dependencies'])
            except json.JSONDecodeError:
                pass
                
        return file_data
        
    def update_file_summary(self, file_path: str, summary: str, 
                          tree: Optional[List[str]] = None, 
                          dependencies: Optional[List[str]] = None) -> bool:
        """
        Update a file's summary, tree, and dependencies.
        
        Args:
            file_path: Path to the file
            summary: Summary text
            tree: Optional list of classes, functions, etc.
            dependencies: Optional list of dependencies
            
        Returns:
            bool: True if updated successfully, False otherwise
        """
        # Get the existing file data
        file_data = self.get_by_path(file_path)
        if not file_data:
            return False
            
        # Update the fields
        file_data['summary'] = summary
        
        # Convert lists to JSON strings if provided
        if tree is not None:
            # Check for "None" in tree
            if tree and len(tree) == 1 and tree[0].lower() == "none":
                # Empty tree structure
                code_data = {'tree': []}
            else:
                # Store tree in code_data field as a JSON string
                code_data = {'tree': tree}
            file_data['code_data'] = json.dumps(code_data)
            
        if dependencies is not None:
            # Check for "None" in dependencies
            if dependencies and len(dependencies) == 1 and dependencies[0].lower() == "none":
                # Empty dependencies list
                file_data['dependencies'] = json.dumps([])
            else:
                file_data['dependencies'] = json.dumps(dependencies)
            
        # Save the updated file data
        self.create_or_update(
            file_path=file_data['file_path'],
            token_count=file_data['token_count'],
            file_hash=file_data['file_hash'],
            summary=file_data['summary'],
            code_data=file_data.get('code_data'),
            dependencies=file_data.get('dependencies'),
            last_modified=file_data['last_modified']
        )
        
        return True
