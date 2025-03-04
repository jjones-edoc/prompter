# src/tools/code_editor/response_parser.py

import re
from dataclasses import dataclass
from typing import List, Optional, Tuple, Dict
from pathlib import Path


@dataclass
class EditBlock:
    """
    Represents a parsed edit block from the AI response
    Stores both original text and normalized versions for comparison
    """
    file_path: str
    search_text: str  # Original text with original line endings
    replace_text: str  # Original text with original line endings
    raw_command: str
    line_number: int
    normalized_search: str  # Text with normalized line endings for comparison
    normalized_replace: str  # Text with normalized line endings for comparison


@dataclass
class ParseResult:
    """Contains parsing results and any errors"""
    blocks: List[EditBlock]
    errors: List[Tuple[int, str]]  # Line number and error message


class ResponseParser:
    """Parses AI responses into edit commands with line ending normalization"""

    # Constants for validation
    MARKER_MIN_LENGTH = 5
    MAX_BLOCK_LINES = 1000
    MAX_LINE_LENGTH = 10000

    # Regex patterns for code edit markers with strict formatting
    VALID_MARKER_PATTERN = {
        'head': r"^<{5,}\s*SEARCH\s*$",
        'divider': r"^={5,}\s*$",
        'tail': r"^>{5,}\s*REPLACE\s*$"
    }

    def __init__(self, valid_files: List[str] = None):
        """
        Initialize the ResponseParser with a list of valid files that can be edited.

        Args:
            valid_files: List of valid file paths
        """
        self.active_file = None
        self.valid_files = [Path(f).as_posix() for f in (valid_files or [])]

    def validate_file_path(self, path: str) -> bool:
        """
        Validate file path format and check against valid files list.

        Args:
            path: File path to validate

        Returns:
            bool: True if path is valid, False otherwise
        """
        if not path or not path.strip():
            return False

        normalized_path = Path(path.strip()).as_posix()

        # If no valid files list provided, check for basic path validity
        if not self.valid_files:
            try:
                Path(normalized_path)
                return bool(re.match(r'^[\w\-./\\]+$', normalized_path))
            except Exception:
                return False

        return normalized_path in self.valid_files

    def normalize_line_endings(self, text: str) -> str:
        """
        Normalize line endings to LF for comparison purposes.
        Preserves empty lines and whitespace other than line endings.

        Args:
            text: Text to normalize

        Returns:
            str: Text with normalized line endings
        """
        # First convert all line endings to LF
        text = text.replace('\r\n', '\n').replace('\r', '\n')
        return text

    def _normalize_marker(self, line: str) -> str:
        """
        Normalize marker line while preserving required parts.

        Args:
            line: Marker line to normalize

        Returns:
            str: Normalized marker
        """
        return ' '.join(line.split())

    def is_marker(self, line: str, marker_type: str) -> bool:
        """
        Check if line matches exactly one of the valid marker patterns.

        Args:
            line: Line to check
            marker_type: Type of marker to validate ('head', 'divider', or 'tail')

        Returns:
            bool: True if marker is valid, False otherwise
        """
        pattern = self.VALID_MARKER_PATTERN[marker_type]
        return bool(re.match(pattern, self._normalize_marker(line)))

    def _extract_lines(self, lines: List[str], start: int, end: int) -> Tuple[str, str]:
        """
        Extract and join lines between start and end indices.
        Returns both original and normalized versions.
        Preserves ALL whitespace except line endings in normalized version.

        Args:
            lines: All lines from the response
            start: Starting index
            end: Ending index

        Returns:
            Tuple[str, str]: (original_text, normalized_text)
        """
        if start >= end:
            return "", ""

        # Get lines between markers
        extract_lines = lines[start:end]

        # Only remove empty lines at start and end
        while extract_lines and not extract_lines[0].rstrip('\r\n'):
            extract_lines.pop(0)
        while extract_lines and not extract_lines[-1].rstrip('\r\n'):
            extract_lines.pop()

        if not extract_lines:
            return "", ""

        # Join preserving original line endings
        original_text = "".join(
            line if line.endswith(('\r\n', '\n', '\r')) else line + '\n'
            for line in extract_lines
        )

        # Create normalized version for comparison
        normalized_text = self.normalize_line_endings(original_text)

        return original_text, normalized_text

    def parse_response(self, response_text: str) -> ParseResult:
        """
        Parse the AI response into a list of edit blocks with error tracking.
        Handles mixed line endings and preserves whitespace.

        Args:
            response_text: The full response text from the AI

        Returns:
            ParseResult: Object containing parsed blocks and any errors
        """
        self.active_file = None
        blocks = []
        errors = []

        # Normalize line endings in the input text while preserving original endings in content
        lines = response_text.splitlines(keepends=True)

        if not lines:
            return ParseResult(blocks=[], errors=[])

        in_block = False
        i = 0
        while i < len(lines):
            try:
                # Check line length
                if len(lines[i]) > self.MAX_LINE_LENGTH:
                    raise ValueError(
                        f"Line exceeds maximum length of {self.MAX_LINE_LENGTH} characters")

                # Skip empty lines
                if not lines[i].rstrip('\r\n'):
                    i += 1
                    continue

                line = lines[i].rstrip('\r\n')

                # Not in a block - look for file path or start marker
                if not in_block:
                    # Check for misplaced markers
                    if self.is_marker(line, 'divider'):
                        raise ValueError(
                            "Found divider marker without preceding SEARCH marker")
                    if self.is_marker(line, 'tail'):
                        raise ValueError(
                            "Found REPLACE marker without preceding SEARCH marker")

                    # Check for file path
                    if not self.is_marker(line, 'head'):
                        if self.validate_file_path(line):
                            self.active_file = Path(line.strip()).as_posix()
                        i += 1
                        continue

                    # Start of new block
                    if self.is_marker(line, 'head'):
                        in_block = True
                        block_start = i

                # Inside a block
                else:
                    if self.is_marker(line, 'head'):
                        raise ValueError(
                            "Found new SEARCH marker before previous block was closed")

                    if self.is_marker(line, 'tail'):
                        # Process the completed block
                        block, next_line = self._parse_edit_block(
                            lines, block_start)
                        if block:
                            blocks.append(block)
                        in_block = False
                        i = next_line
                        continue

                i += 1

            except ValueError as e:
                errors.append((i + 1, str(e)))
                # Skip to next potential block
                while i < len(lines) and not self.is_marker(lines[i].rstrip('\r\n'), 'head'):
                    i += 1
                in_block = False

        # Check if we ended while still in a block
        if in_block:
            errors.append(
                (len(lines), "Reached end of input while still in an edit block"))

        return ParseResult(blocks=blocks, errors=errors)

    def _parse_edit_block(self, lines: List[str], start_idx: int) -> Tuple[Optional[EditBlock], int]:
        """Parse a single edit block starting from the HEAD marker"""
        if not self.active_file:
            raise ValueError("No active file when parsing edit block")

        if start_idx >= len(lines):
            return None, start_idx

        # Check block size
        if len(lines) - start_idx > self.MAX_BLOCK_LINES:
            raise ValueError(
                f"Edit block exceeds maximum size of {self.MAX_BLOCK_LINES} lines")

        # Validate HEAD marker
        if not self.is_marker(lines[start_idx].strip(), 'head'):
            raise ValueError("Invalid or missing HEAD marker")

        # Find section boundaries
        divider_idx = None
        tail_idx = None
        block_lines = [lines[start_idx]]

        i = start_idx + 1
        while i < len(lines):
            line = lines[i].strip()
            block_lines.append(lines[i])

            if self.is_marker(line, 'divider'):
                if divider_idx is not None:
                    raise ValueError("Multiple divider markers found in block")
                divider_idx = i
            elif self.is_marker(line, 'tail'):
                tail_idx = i
                break
            i += 1

        if not divider_idx:
            raise ValueError("Missing divider marker in block")
        if not tail_idx:
            raise ValueError("Missing REPLACE marker in block")
        if not (start_idx < divider_idx < tail_idx):
            raise ValueError("Invalid edit block structure")

        # Extract both original and normalized versions
        search_text, norm_search = self._extract_lines(
            lines, start_idx + 1, divider_idx)
        replace_text, norm_replace = self._extract_lines(
            lines, divider_idx + 1, tail_idx)

        # Build raw command (preserve original line endings)
        raw_lines = [self.active_file] + lines[start_idx:tail_idx + 1]
        raw_command = "".join(
            line if line.endswith(('\r\n', '\n', '\r')) else line + '\n'
            for line in raw_lines
        )

        block = EditBlock(
            file_path=self.active_file,
            search_text=search_text,
            replace_text=replace_text,
            raw_command=raw_command,
            line_number=start_idx + 1,
            normalized_search=norm_search,
            normalized_replace=norm_replace
        )

        self.validate_edit_block(block)
        return block, tail_idx + 1

    def validate_edit_block(self, block: EditBlock) -> None:
        """
        Validate an edit block's format and content.
        Ensures:
        - Valid file path
        - Non-empty search/replace text
        - Required markers present
        - Search text preserves exact whitespace for matching
        - Line endings are properly normalized for comparison

        Args:
            block: EditBlock to validate

        Raises:
            ValueError: If the block is invalid
        """
        # Check file path
        if not self.validate_file_path(block.file_path):
            raise ValueError(f"Invalid file path: {block.file_path}")

        # Check search and replace text
        if block.normalized_search.strip() == "" and block.normalized_replace.strip() == "":
            raise ValueError("Both search and replace text cannot be empty")

        # Verify normalization was successful
        if '\r' in block.normalized_search or '\r' in block.normalized_replace:
            raise ValueError("Line ending normalization failed")

        # Validate markers in raw command
        lines = self.normalize_line_endings(block.raw_command).splitlines()
        found_markers = {
            'head': False,
            'divider': False,
            'tail': False
        }

        for line in lines:
            line = line.strip()
            if self.is_marker(line, 'head'):
                found_markers['head'] = True
            elif self.is_marker(line, 'divider'):
                found_markers['divider'] = True
            elif self.is_marker(line, 'tail'):
                found_markers['tail'] = True

        if not all(found_markers.values()):
            missing = [k for k, v in found_markers.items() if not v]
            raise ValueError(
                f"Edit block missing required markers: {', '.join(missing)}")
