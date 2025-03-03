import os
import pathspec
import tiktoken
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


@dataclass
class DirInfo:
    name: str
    path: str
    full_path: str
    token_count: int = 0  # Total token count for this directory


class Scanner:
    """
    Enhanced file system handler that respects .gitignore rules, handles directory navigation,
    and provides token counting for files.
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
                    # For directories, get token count recursively
                    dir_token_count = self.get_directory_token_count(rel_path)

                    result['dirs'].append({
                        'name': entry.name,
                        'path': rel_path,
                        'full_path': entry.path,
                        'token_count': dir_token_count
                    })
                else:
                    # Count tokens for this file
                    token_count = self.count_tokens(entry.path)

                    result['files'].append({
                        'name': entry.name,
                        'path': rel_path,
                        'full_path': entry.path,
                        'size': entry.stat().st_size,
                        'type': os.path.splitext(entry.name)[1][1:] or 'unknown',
                        'token_count': token_count
                    })

            return result

        except Exception as e:
            print(f"Error scanning directory {current_dir}: {str(e)}")
            return result

    def get_directory_token_count(self, dir_path: str) -> int:
        """
        Calculate total token count for all files in a directory recursively.

        Args:
            dir_path: Relative path from root directory

        Returns:
            Total token count for all files in the directory and subdirectories
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
                    if not self._should_exclude(file_path):
                        total_tokens += self.count_tokens(file_path)

        except Exception as e:
            print(
                f"Error calculating tokens for directory {dir_path}: {str(e)}")

        return total_tokens

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

    def get_folder_contents(self, folder_path: str) -> Tuple[List[DirInfo], List[FileInfo]]:
        """
        Get all directories and files within a folder.

        Args:
            folder_path: Relative path from root directory

        Returns:
            Tuple of (directories, files) with token counts
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
                    # Calculate token count for this directory
                    token_count = self.get_directory_token_count(rel_path)

                    dirs.append(DirInfo(
                        name=entry.name,
                        path=rel_path,
                        full_path=entry.path,
                        token_count=token_count
                    ))
                else:
                    # Count tokens for this file
                    token_count = self.count_tokens(entry.path)

                    files.append(FileInfo(
                        name=entry.name,
                        path=rel_path,
                        full_path=entry.path,
                        size=entry.stat().st_size,
                        type=os.path.splitext(entry.name)[1][1:] or 'unknown',
                        token_count=token_count
                    ))

        except Exception as e:
            print(f"Error getting folder contents for {folder_path}: {str(e)}")

        return dirs, files
