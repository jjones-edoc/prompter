import os
import pathspec
import tiktoken
import hashlib
import time
from typing import List, Dict, Any, Optional, Tuple
from dataclasses import dataclass


@dataclass
class GitignoreSpec:
    path: str
    spec: pathspec.PathSpec
    patterns: List[str]


@dataclass
class FileInfo:
    name: str
    path: str
    full_path: str
    size: int
    type: str
    token_count: int = 0
    file_hash: str = ""
    last_modified: int = 0


@dataclass
class DirInfo:
    name: str
    path: str
    full_path: str
    token_count: int = 0  # Total token count for this directory


class Scanner:
    """
    Enhanced file system handler that respects .gitignore rules, handles directory navigation,
    and provides token counting, file hashing, and modification tracking for files.
    """
    ALWAYS_HIDDEN = {'.git', '__pycache__', '.vscode', '.idea', '.venv'}
    SUPPORTED_TEXT_EXTENSIONS = {
        '.txt', '.py', '.js', '.json', '.md', '.csv', '.yaml', '.yml',
        '.ini', '.conf', '.cfg', '.html', '.css', '.cpp', '.h', '.c',
        '.java', '.rs', '.go', '.ts', '.jsx', '.tsx', '.vue', '.rb',
        '.php', '.pl', '.sh', '.bash', '.sql', '.xml', '.toml'
    }

    def __init__(self, root_dir: str):
        self.root_dir = os.path.abspath(root_dir)
        self.gitignore_specs = self._load_all_gitignores()
        try:
            self.encoding = tiktoken.get_encoding("cl100k_base")
            self.has_tiktoken = True
        except Exception:
            # Fallback to simple estimation if tiktoken is not available
            self.has_tiktoken = False

    def _load_gitignore_file(self, path: str) -> List[str]:
        """Load patterns from a .gitignore file."""
        patterns = []
        try:
            with open(path, 'r', encoding='utf-8') as f:
                for line in f:
                    line = line.strip()
                    if line and not line.startswith('#'):
                        patterns.append(line)
        except Exception as e:
            print(f"Could not read .gitignore file at {path}: {str(e)}")
        return patterns

    def _load_all_gitignores(self) -> List[GitignoreSpec]:
        """Load all .gitignore files in the directory tree."""
        specs = []
        try:
            for root, dirs, files in os.walk(str(self.root_dir)):
                # Filter out hidden directories
                dirs[:] = [d for d in dirs if d not in self.ALWAYS_HIDDEN]

                if '.gitignore' in files:
                    gitignore_path = os.path.join(root, '.gitignore')
                    patterns = self._load_gitignore_file(gitignore_path)
                    if patterns:
                        spec = pathspec.PathSpec.from_lines(
                            'gitwildmatch', patterns)
                        specs.append(GitignoreSpec(
                            path=root,
                            spec=spec,
                            patterns=patterns
                        ))

            # Sort specs by path length to ensure parent directories are processed first
            specs.sort(key=lambda x: len(x.path))
            return specs
        except Exception as e:
            print(f"Error walking directory tree: {str(e)}")
            return []

    def _should_exclude(self, path: str) -> bool:
        """Check if a path should be excluded based on applicable .gitignore rules."""
        abs_path = os.path.abspath(path)
        name = os.path.basename(path)

        # Core exclusion rules
        if abs_path == self.root_dir:
            return False
        if name in self.ALWAYS_HIDDEN or name.startswith('.'):
            return True
        if name == '.gitignore':
            return False

        try:
            rel_path = os.path.relpath(
                abs_path, self.root_dir).replace(os.sep, '/')
            if os.path.isdir(abs_path):
                rel_path += '/'

            # Check against gitignore specs
            for spec in self.gitignore_specs:
                spec_dir = os.path.abspath(spec.path)
                if abs_path.startswith(spec_dir) or spec_dir == self.root_dir:
                    try:
                        gitignore_rel_path = os.path.relpath(
                            abs_path, spec.path).replace(os.sep, '/')
                        if os.path.isdir(abs_path):
                            gitignore_rel_path += '/'

                        if spec.spec.match_file(gitignore_rel_path):
                            return True
                    except ValueError:
                        continue

        except ValueError:
            print(f"Could not compute relative path for: {path}")

        return False

    def _is_text_file(self, path: str) -> bool:
        """Check if the file is a supported text file based on extension."""
        ext = os.path.splitext(path)[1].lower()
        return ext in self.SUPPORTED_TEXT_EXTENSIONS

    def _is_searchable_file(self, file_path: str) -> bool:
        """Check if the file can be searched through (text-based)."""
        # Check if it's a supported text file
        if not self._is_text_file(file_path):
            return False

        # Skip very large files (over 10MB)
        try:
            if os.path.getsize(file_path) > 10 * 1024 * 1024:
                return False
        except Exception:
            return False

        return True

    def count_tokens(self, file_path: str) -> int:
        """Count tokens in a text file using tiktoken if available, or estimate if not."""
        if not self._is_text_file(file_path):
            # For non-text files, make a rough estimate
            try:
                size = os.path.getsize(file_path)
                return size // 4  # Rough estimate: ~4 bytes per token
            except Exception:
                return 0

        try:
            # If tiktoken is available, use it for accurate counts
            if self.has_tiktoken:
                with open(file_path, 'r', encoding='utf-8') as f:
                    content = f.read()
                    tokens = self.encoding.encode(content)
                    return len(tokens)
            else:
                # Fallback to size-based estimation for text files too
                size = os.path.getsize(file_path)
                return size // 4
        except Exception as e:
            print(f"Error counting tokens in {file_path}: {str(e)}")
            return 0

    def get_items(self, subpath: str = "") -> Dict[str, Any]:
        """
        Get directories and files in the specified path, respecting .gitignore rules.
        Now includes token counts for files and directories.

        Args:
            subpath: Relative path from root directory

        Returns:
            Dict with 'dirs' and 'files' keys containing lists of info dictionaries
        """
        # Construct absolute path
        current_dir = os.path.normpath(os.path.join(self.root_dir, subpath))

        # Make sure we don't navigate outside root directory
        if not current_dir.startswith(self.root_dir):
            current_dir = self.root_dir
            subpath = ""

        # Initialize result structure
        result = {
            'dirs': [],
            'files': [],
            'current_path': subpath,
            'parent_path': os.path.dirname(subpath) if subpath else None
        }

        # Check if directory exists
        if not os.path.isdir(current_dir):
            return result

        try:
            # Sort entries for consistent output
            entries = sorted(os.scandir(current_dir),
                             key=lambda e: e.name.lower())

            for entry in entries:
                # Skip excluded items
                if self._should_exclude(entry.path):
                    continue

                # Get relative path from root for the item
                rel_path = os.path.relpath(entry.path, self.root_dir)
                rel_path = rel_path.replace(os.sep, '/')

                if entry.is_dir():
                    # Skip empty directories
                    if self.is_dir_empty(rel_path):
                        continue
                        
                    # For directories, get token count recursively
                    dir_token_count = self.get_directory_token_count(rel_path)

                    result['dirs'].append({
                        'name': entry.name,
                        'path': rel_path,
                        'full_path': entry.path,
                        'token_count': dir_token_count
                    })
                else:
                    # Skip non-text files
                    if not self._is_text_file(entry.path):
                        continue

                    # Count tokens for this file
                    token_count = self.count_tokens(entry.path)
                    # Get file hash and last modified time
                    file_hash = self.calculate_file_hash(entry.path)
                    last_modified = int(os.path.getmtime(entry.path))

                    result['files'].append({
                        'name': entry.name,
                        'path': rel_path,
                        'full_path': entry.path,
                        'size': entry.stat().st_size,
                        'type': os.path.splitext(entry.name)[1][1:] or 'unknown',
                        'token_count': token_count,
                        'file_hash': file_hash,
                        'last_modified': last_modified
                    })

            return result

        except Exception as e:
            print(f"Error scanning directory {current_dir}: {str(e)}")
            return result

    def get_directory_token_count(self, dir_path: str) -> int:
        """
        Calculate total token count for all TEXT files in a directory recursively.
        """
        total_tokens = 0
        full_path = os.path.join(self.root_dir, dir_path)

        try:
            for root, dirs, files in os.walk(full_path):
                # Filter out excluded directories
                dirs[:] = [d for d in dirs if not self._should_exclude(
                    os.path.join(root, d))]

                # Process files in this directory
                for file in files:
                    file_path = os.path.join(root, file)
                    if (not self._should_exclude(file_path) and
                            self._is_text_file(file_path)):
                        total_tokens += self.count_tokens(file_path)

        except Exception as e:
            print(
                f"Error calculating tokens for directory {dir_path}: {str(e)}")

        return total_tokens
        
    def is_dir_empty(self, dir_path: str) -> bool:
        """
        Check if a directory is empty after applying .gitignore rules.
        
        Args:
            dir_path: Relative path from root directory
            
        Returns:
            bool: True if directory has no visible files or subdirectories, False otherwise
        """
        full_path = os.path.join(self.root_dir, dir_path)
        
        try:
            # Check immediate contents first
            for entry in os.scandir(full_path):
                # Skip excluded items
                if self._should_exclude(entry.path):
                    continue
                
                # If we found any non-excluded item, the directory is not empty
                return False
                
            # If we reach here, no visible items were found
            return True
            
        except Exception as e:
            print(f"Error checking if directory {dir_path} is empty: {str(e)}")
            # In case of error, assume not empty as a safer default
            return False

    def calculate_file_hash(self, file_path: str) -> str:
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

    def get_file_contents(self, file_path: str) -> Optional[str]:
        """Read file contents, handling encoding issues."""
        full_path = os.path.join(self.root_dir, file_path)

        if not os.path.exists(full_path) or not os.path.isfile(full_path):
            return None

        try:
            with open(full_path, 'r', encoding='utf-8') as f:
                return f.read()
        except UnicodeDecodeError:
            return "[Binary file not included]"
        except Exception as e:
            return f"[Error reading file: {str(e)}]"

    def search_files(self, search_query: str) -> List[Dict[str, Any]]:
        """
        Search all text files for the given query.

        Args:
            search_query: Text to search for

        Returns:
            List of dicts with file info
        """
        matching_files = []

        # Normalize query for case-insensitive search
        search_query = search_query.lower()

        try:
            # Walk through the entire directory structure
            for root, dirs, files in os.walk(self.root_dir):
                # Filter out excluded directories
                dirs[:] = [d for d in dirs if not self._should_exclude(
                    os.path.join(root, d))]

                # Process files in this directory
                for file in files:
                    file_path = os.path.join(root, file)

                    # Skip if file should be excluded or is not searchable
                    if self._should_exclude(file_path) or not self._is_searchable_file(file_path):
                        continue

                    try:
                        # Get relative path from root
                        rel_path = os.path.relpath(file_path, self.root_dir)
                        rel_path = rel_path.replace(os.sep, '/')

                        # Search file content
                        with open(file_path, 'r', encoding='utf-8') as f:
                            content = f.read().lower()

                        if search_query in content:
                            # Count matches
                            match_count = content.count(search_query)

                            # Find lines with matches
                            lines = content.splitlines()
                            matching_lines = []
                            for i, line in enumerate(lines):
                                if search_query in line.lower():
                                    matching_lines.append({
                                        'line_number': i + 1,
                                        'text': line[:100] + ('...' if len(line) > 100 else '')
                                    })

                                    # Limit to first 5 matching lines
                                    if len(matching_lines) >= 5:
                                        break

                            # Get token count, file hash, and last modified time
                            token_count = self.count_tokens(file_path)
                            file_hash = self.calculate_file_hash(file_path)
                            last_modified = int(os.path.getmtime(file_path))

                            # Add to results
                            matching_files.append({
                                'name': file,
                                'path': rel_path,
                                'size': os.path.getsize(file_path),
                                'type': os.path.splitext(file)[1][1:] or 'unknown',
                                'token_count': token_count,
                                'file_hash': file_hash,
                                'last_modified': last_modified,
                                'match_count': match_count,
                                'matching_lines': matching_lines
                            })
                    except (UnicodeDecodeError, IOError, OSError):
                        # Skip files that can't be read
                        continue

        except Exception as e:
            print(f"Error searching files: {str(e)}")

        return matching_files

    def get_folder_contents(self, folder_path: str) -> Tuple[List[DirInfo], List[FileInfo]]:
        """
        Get all directories and text files within a folder.
        """
        dirs = []
        files = []

        # Get the absolute path
        full_path = os.path.join(self.root_dir, folder_path)

        try:
            # Sort entries for consistent output
            entries = sorted(os.scandir(full_path),
                             key=lambda e: e.name.lower())

            for entry in entries:
                # Skip excluded items
                if self._should_exclude(entry.path):
                    continue

                # Get relative path from root
                rel_path = os.path.relpath(entry.path, self.root_dir)
                rel_path = rel_path.replace(os.sep, '/')

                if entry.is_dir():
                    # Skip empty directories
                    if self.is_dir_empty(rel_path):
                        continue
                        
                    # Calculate token count for this directory
                    token_count = self.get_directory_token_count(rel_path)

                    dirs.append(DirInfo(
                        name=entry.name,
                        path=rel_path,
                        full_path=entry.path,
                        token_count=token_count
                    ))
                else:
                    # Skip non-text files
                    if not self._is_text_file(entry.path):
                        continue

                    # Count tokens for this file
                    token_count = self.count_tokens(entry.path)
                    # Get file hash and last modified time
                    file_hash = self.calculate_file_hash(entry.path)
                    last_modified = int(os.path.getmtime(entry.path))

                    files.append(FileInfo(
                        name=entry.name,
                        path=rel_path,
                        full_path=entry.path,
                        size=entry.stat().st_size,
                        type=os.path.splitext(entry.name)[1][1:] or 'unknown',
                        token_count=token_count,
                        file_hash=file_hash,
                        last_modified=last_modified
                    ))

        except Exception as e:
            print(f"Error getting folder contents for {folder_path}: {str(e)}")

        return dirs, files
