import os
from pathlib import Path
from typing import Optional, Tuple, Dict, List
import tempfile
import shutil


class FileEditor:
    """Handles safe file modifications"""

    def __init__(self, root_dir: str):
        # Resolve root dir immediately
        self.root_dir = Path(root_dir).resolve()

    def validate_edit(self, file_path: str, search_text: str) -> Tuple[bool, Optional[str], Optional[Dict]]:
        """
        Validate if a search pattern exists in a file without modifying it.
        Returns enhanced error information for better reporting.

        Args:
            file_path: Path to the file to check
            search_text: Text to find (empty or #ENTIRE_FILE is always valid)

        Returns:
            Tuple of (is_valid, error_message, error_details)
            where error_details is a dictionary with additional context
        """
        try:
            # Convert to absolute path relative to root
            full_path = (self.root_dir / file_path).resolve()
            error_details = None

            # Validate file location
            if not self._is_safe_path(full_path):
                error_details = {
                    'type': 'validation_error',
                    'file': file_path,
                    'message': f"File path {file_path} is outside root directory"
                }
                return False, error_details['message'], error_details

            # Special cases that are always valid
            if not search_text.strip() or search_text.strip() == "#ENTIRE_FILE":
                return True, None, None

            # File must exist for non-empty search text
            if not full_path.exists():
                error_details = {
                    'type': 'validation_error',
                    'file': file_path,
                    'message': f"Cannot find search text in non-existent file: {file_path}"
                }
                return False, error_details['message'], error_details

            # Read file content
            try:
                content = self._read_file(full_path)
            except UnicodeDecodeError:
                error_details = {
                    'type': 'validation_error',
                    'file': file_path,
                    'message': f"Unable to read {file_path} - file may be binary or use unknown encoding"
                }
                return False, error_details['message'], error_details

            # Normalize line endings for comparison
            content = content.replace('\r\n', '\n')
            search_text = search_text.replace('\r\n', '\n')

            # Check if search text exists in content
            if search_text not in content:
                # Create search preview for error context
                search_preview = search_text[:50] + \
                    "..." if len(search_text) > 50 else search_text
                search_preview = search_preview.replace('\n', '\\n')

                error_details = {
                    'type': 'validation_error',
                    'file': file_path,
                    'message': f"Could not find exact match for search text in {file_path}",
                    'search_preview': search_preview
                }
                return False, error_details['message'], error_details

            return True, None, None

        except Exception as e:
            error_details = {
                'type': 'validation_exception',
                'file': file_path,
                'message': str(e)
            }
            return False, str(e), error_details

    def validate_move(self, source_path: str, dest_path: str) -> Tuple[bool, Optional[str]]:
        """
        Validate that a file can be moved from source to destination.

        Args:
            source_path: Path of file to move
            dest_path: Destination path for the file

        Returns:
            Tuple of (is_valid, error_message)
        """
        try:
            # Convert to absolute paths relative to root
            full_source = (self.root_dir / source_path).resolve()

            # For destination, we don't resolve yet since it might not exist
            # Just get the absolute path first
            full_dest = (self.root_dir / dest_path).absolute()

            # Validate source path
            if not self._is_safe_path(full_source):
                return False, f"Source path {source_path} is outside root directory"

            # Validate destination path - just check if it would be within the root directory
            if not self._is_safe_path(full_dest):
                return False, f"Destination path {dest_path} is outside root directory"

            # Check source exists
            if not full_source.exists():
                return False, f"Source file does not exist: {source_path}"

            # Check if source is a file
            if not full_source.is_file():
                return False, f"Source path is not a file: {source_path}"

            # All parent directories in the destination are considered valid
            # as long as they're within the root directory, which we've already checked

            return True, None

        except Exception as e:
            return False, str(e)

    def move_file(self, source_path: str, dest_path: str) -> Tuple[bool, Optional[str]]:
        """
        Move a file from source_path to dest_path.
        Creates destination directory if it doesn't exist.

        Args:
            source_path: Path to the source file
            dest_path: Path to the destination file

        Returns:
            Tuple of (success, error_message)
        """
        try:
            # Validate the move operation first
            is_valid, error_msg = self.validate_move(source_path, dest_path)
            if not is_valid:
                return False, error_msg

            # Convert to absolute paths
            full_source = (self.root_dir / source_path).resolve()
            full_dest = (self.root_dir / dest_path).absolute()

            # Create destination directory structure if needed
            try:
                full_dest.parent.mkdir(parents=True, exist_ok=True)
            except Exception as e:
                return False, f"Failed to create destination directory structure: {str(e)}"

            # If destination file already exists, back it up
            temp_backup = None
            if full_dest.exists():
                try:
                    # Create temporary backup
                    temp_fd, temp_backup = tempfile.mkstemp(
                        dir=str(full_dest.parent))
                    os.close(temp_fd)
                    shutil.copy2(full_dest, temp_backup)
                except Exception as e:
                    return False, f"Failed to create backup of existing destination file: {str(e)}"

            try:
                # Ensure atomic operation by first copying then deleting
                # This is safer than a direct move in case of interruption
                shutil.copy2(full_source, full_dest)
                full_source.unlink()

                # Remove temp backup if everything worked
                if temp_backup and Path(temp_backup).exists():
                    Path(temp_backup).unlink()

                return True, None

            except Exception as e:
                # Restore from backup if something went wrong
                if temp_backup and Path(temp_backup).exists():
                    Path(temp_backup).replace(full_dest)
                raise e

        except Exception as e:
            return False, f"Failed to move file: {str(e)}"

    def apply_edit(self, file_path: str, search_text: str, replace_text: str) -> Tuple[bool, Optional[str]]:
        """
        Apply an edit to a file. Creates new file if it doesn't exist and search_text is empty.

        Args:
            file_path: Path to the file to edit
            search_text: Text to find (empty for append/create)
            replace_text: Text to replace with

        Returns:
            Tuple of (success, error_message)
        """
        try:
            # Convert to absolute path relative to root
            full_path = (self.root_dir / file_path).resolve()

            # Validate file location
            if not self._is_safe_path(full_path):
                return False, f"File path {file_path} is outside root directory"

            # Handle file creation or modification
            if not full_path.exists():
                if search_text.strip():
                    return False, f"Cannot find search text in non-existent file: {file_path}"
                content = ""
            else:
                try:
                    content = self._read_file(full_path)
                except UnicodeDecodeError:
                    return False, f"Unable to read {file_path} - file may be binary or use unknown encoding"

            # Apply the replacement
            new_content = self.apply_replacement(
                content, search_text, replace_text)
            if new_content is None:
                return False, f"Could not find exact match for search text in {file_path}"

            # Write changes
            return self._write_file_safely(full_path, new_content)

        except Exception as e:
            return False, str(e)

    def _is_safe_path(self, file_path: Path) -> bool:
        """Check if a file path is within the root directory"""
        try:
            if not isinstance(file_path, Path):
                return False

            # No need to resolve root_dir again as it's resolved in __init__
            # For file_path, only resolve if it exists to handle new file creation
            check_path = file_path.resolve() if file_path.exists() else file_path.absolute()

            try:
                # Use parts comparison to check if path is under root
                root_parts = self.root_dir.parts
                path_parts = check_path.parts

                # Path must start with all parts of root_dir
                return (len(path_parts) >= len(root_parts) and
                        path_parts[:len(root_parts)] == root_parts)

            except Exception as e:
                return False

        except Exception as e:
            return False

    def _read_file(self, file_path: Path) -> str:
        """Read file content with UTF-8 or system default encoding"""
        # Convert Path to string for consistency
        file_path_str = str(file_path)
        try:
            with open(file_path_str, 'r', encoding='utf-8') as f:
                return f.read()
        except UnicodeDecodeError:
            # Use system default encoding for fallback
            with open(file_path_str, 'r', encoding=None) as f:
                return f.read()

    def apply_replacement(self, content: str, search_text: str, replace_text: str) -> Optional[str]:
        """
        Apply the replacement to the content. Handles append case and line ending normalization.
        Special marker #ENTIRE_FILE can be used to replace or delete the entire file.

        Args:
            content: The content to modify
            search_text: Text to search for
            replace_text: Text to replace with

        Returns:
            Modified content or None if search text not found
        """
        # Import here to avoid circular imports
        from features.file_modification.normalization import normalize_line_endings

        # Normalize line endings
        content = normalize_line_endings(content)
        search_text = normalize_line_endings(search_text)
        replace_text = normalize_line_endings(replace_text)

        # Handle special case for entire file operations
        if search_text.strip() == "#ENTIRE_FILE":
            # For file deletion (empty replace text)
            if not replace_text.strip():
                return ""
            # For complete file replacement
            return replace_text

        # Handle append case
        if not search_text.strip():
            if not content.endswith('\n') and content:
                content += '\n'
            return content + replace_text

        # Original exact matching behavior
        if search_text not in content:
            return None
        return content.replace(search_text, replace_text, 1)

    def _write_file_safely(self, file_path: Path, content: str) -> Tuple[bool, Optional[str]]:
        """Write content to file using a temporary file for safety"""
        tmp_path = None
        try:
            # Create parent directories before creating temp file
            file_path.parent.mkdir(parents=True, exist_ok=True)

            # Create and write to temporary file
            tmp_fd, tmp_path = tempfile.mkstemp(dir=str(file_path.parent))
            os.close(tmp_fd)

            with open(tmp_path, 'w', encoding='utf-8') as f:
                f.write(content)

            # Replace target file with temporary file
            Path(tmp_path).replace(file_path)
            return True, None

        except Exception as e:
            return False, f"Failed to write file: {str(e)}"

        finally:
            # Clean up temporary file if it exists
            if tmp_path and Path(tmp_path).exists():
                try:
                    Path(tmp_path).unlink()
                except Exception:
                    pass
