import os
import pathspec
from typing import List, Dict, Any, Optional, Tuple
from dataclasses import dataclass


@dataclass
class GitignoreSpec:
    path: str
    spec: pathspec.PathSpec
    patterns: List[str]


class GitIgnoreManager:
    """
    Manages gitignore rules and provides functionality for checking path exclusions.
    Supports multiple .gitignore files throughout a directory tree.
    """
    ALWAYS_HIDDEN = {'.git', '__pycache__', '.vscode', '.idea', '.venv'}

    def __init__(self, root_dir: str):
        self.root_dir = os.path.abspath(root_dir)
        self.gitignore_specs = self._load_all_gitignores()

    def _normalize_path(self, path: str, is_dir: bool = None) -> Tuple[str, str, bool]:
        """
        Normalize a path for gitignore processing.

        Args:
            path: The path to normalize
            is_dir: Explicitly specify if path is a directory. If None, will be detected.

        Returns:
            Tuple of (absolute_path, normalized_relative_path, is_directory)
        """
        # Convert to absolute path
        abs_path = os.path.abspath(path)

        # Determine if path is a directory if not specified
        if is_dir is None:
            is_dir = os.path.isdir(abs_path)

        # Get path relative to root
        try:
            rel_path = os.path.relpath(
                abs_path, self.root_dir).replace(os.sep, '/')
            # Add trailing slash for directories (gitignore standard)
            if is_dir and not rel_path.endswith('/'):
                rel_path += '/'
        except ValueError:
            # Path might be on a different drive (Windows) or otherwise invalid
            rel_path = None

        return abs_path, rel_path, is_dir

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

    def get_applicable_specs(self, abs_path: str) -> List[GitignoreSpec]:
        """
        Find all gitignore specs that apply to a given path.

        Args:
            abs_path: Absolute path to check

        Returns:
            List[GitignoreSpec]: List of applicable gitignore specs, sorted from most specific to least
        """
        applicable_specs = []

        # Find all specs that might apply to this path
        for spec in self.gitignore_specs:
            spec_dir = os.path.abspath(spec.path)

            # A spec applies if the path is within its directory or it's the root spec
            if abs_path.startswith(spec_dir) or spec_dir == self.root_dir:
                applicable_specs.append(spec)

        # Sort by path length (descending) so more specific gitignores are checked first
        return sorted(applicable_specs, key=lambda x: len(x.path), reverse=True)

    def should_exclude(self, path: str) -> bool:
        """
        Check if a path should be excluded based on applicable .gitignore rules.

        Args:
            path: Path to check (absolute or relative to root)

        Returns:
            bool: True if path should be excluded, False otherwise
        """
        # Get the normalized paths and directory status
        abs_path, rel_path, is_dir = self._normalize_path(path)
        name = os.path.basename(path)

        # Always include the root directory
        if abs_path == self.root_dir:
            return False

        # Standard exclusion rules
        if name in self.ALWAYS_HIDDEN or name.startswith('.'):
            return True

        # Always include .gitignore files themselves
        if name == '.gitignore':
            return False

        # If we can't get a relative path, we can't apply gitignore rules
        if rel_path is None:
            return False

        # Get applicable gitignore specs for this path
        applicable_specs = self.get_applicable_specs(abs_path)

        # Check each applicable spec in order (most specific first)
        for spec in applicable_specs:
            try:
                # Get path relative to the gitignore file's directory
                spec_rel_path = os.path.relpath(
                    abs_path, spec.path).replace(os.sep, '/')
                if is_dir and not spec_rel_path.endswith('/'):
                    spec_rel_path += '/'

                # Check if the path matches any pattern in this gitignore
                if spec.spec.match_file(spec_rel_path):
                    return True
            except ValueError:
                # Skip if we can't get a relative path (different drives, etc.)
                continue

        # If no exclusion rule matched, include the path
        return False
