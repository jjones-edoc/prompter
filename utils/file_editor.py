import os
from pathlib import Path
from typing import Optional, Tuple
import tempfile


class FileEditor:
    """Handles safe file modifications"""

    def __init__(self, root_dir: str):
        # Resolve root dir immediately
        self.root_dir = Path(root_dir).resolve()

    def validate_edit(self, file_path: str, search_text: str) -> Tuple[bool, Optional[str]]:
        """
        Validate if a search pattern exists in a file without modifying it.
        
        Args:
            file_path: Path to the file to check
            search_text: Text to find (empty or #ENTIRE_FILE is always valid)
            
        Returns:
            Tuple of (is_valid, error_message)
        """
        try:
            # Convert to absolute path relative to root
            full_path = (self.root_dir / file_path).resolve()
            
            # Validate file location
            if not self._is_safe_path(full_path):
                return False, f"File path {file_path} is outside root directory"
                
            # Special cases that are always valid
            if not search_text.strip() or search_text.strip() == "#ENTIRE_FILE":
                return True, None
                
            # File must exist for non-empty search text
            if not full_path.exists():
                return False, f"Cannot find search text in non-existent file: {file_path}"
                
            # Read file content
            try:
                content = self._read_file(full_path)
            except UnicodeDecodeError:
                return False, f"Unable to read {file_path} - file may be binary or use unknown encoding"
                
            # Normalize line endings for comparison
            content = content.replace('\r\n', '\n')
            search_text = search_text.replace('\r\n', '\n')
            
            # Check if search text exists in content
            if search_text not in content:
                return False, f"Could not find exact match for search text in {file_path}"
                
            return True, None
            
        except Exception as e:
            return False, str(e)

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

    def apply_replacement(self, content: str, search_text: str, replace_text: str, strict_mode: bool = True) -> Optional[str]:
        """
        Apply the replacement to the content. Handles append case and line ending normalization.
        Special marker #ENTIRE_FILE can be used to replace or delete the entire file.

        Args:
            content: The content to modify
            search_text: Text to search for
            replace_text: Text to replace with
            strict_mode: If True, requires exact match. If False, matches on alphanumeric and single spaces

        Returns:
            Modified content or None if search text not found
        """
        # Normalize line endings
        content = content.replace('\r\n', '\n')
        search_text = search_text.replace('\r\n', '\n')
        replace_text = replace_text.replace('\r\n', '\n')

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

        if strict_mode:
            # Original exact matching behavior
            if search_text not in content:
                return None
            return content.replace(search_text, replace_text, 1)
        else:
            # Non-strict matching based on alphanumeric and single spaces
            import re

            def normalize_line(line: str) -> str:
                # Convert to lowercase and replace multiple spaces with single space
                normalized = re.sub(r'\s+', ' ', line.lower())
                # Keep only alphanumeric and single spaces
                normalized = ''.join(
                    c for c in normalized if c.isalnum() or c.isspace())
                return normalized.strip()

            # Split both content and search text into lines
            content_lines = content.split('\n')
            search_lines = [line for line in search_text.split(
                '\n') if line.strip()]  # Ignore empty lines

            if not search_lines:
                return None

            # Track start of potential match
            start_idx = None
            matched_lines = 0

            # Go through content lines
            for i, content_line in enumerate(content_lines):
                # Skip empty content lines
                if not content_line.strip():
                    continue

                # Compare normalized versions
                if normalize_line(content_line) == normalize_line(search_lines[matched_lines]):
                    # First match found
                    if start_idx is None:
                        start_idx = i
                    matched_lines += 1

                    # All lines matched
                    if matched_lines == len(search_lines):
                        # Get the exact original text that matched
                        end_idx = i + 1
                        original_section = '\n'.join(
                            content_lines[start_idx:end_idx])

                        # Replace the original section with new text
                        return content.replace(original_section, replace_text, 1)
                else:
                    # Reset match tracking if line doesn't match
                    start_idx = None
                    matched_lines = 0
                    # If this line matches first search line, start new potential match
                    if normalize_line(content_line) == normalize_line(search_lines[0]):
                        start_idx = i
                        matched_lines = 1

            return None

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