"""
Utilities for normalizing text and handling line endings consistently.
Used primarily for code editing operations where exact whitespace matters.
"""
from typing import List, Tuple, Optional


def normalize_line_endings(text: str) -> str:
    """
    Normalize line endings to LF (\n) for consistent comparison.
    Preserves empty lines and whitespace other than line endings.

    Args:
        text: Text to normalize

    Returns:
        str: Text with normalized line endings
    """
    # Convert all line endings to LF
    return text.replace('\r\n', '\n').replace('\r', '\n')


def extract_and_normalize_text(lines: List[str], start: int, end: int) -> Tuple[str, str]:
    """
    Extract and join lines between start and end indices.
    Returns both original and normalized versions.
    Preserves ALL whitespace except line endings in normalized version.

    Args:
        lines: All lines from the text
        start: Starting index (inclusive)
        end: Ending index (exclusive)

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
    normalized_text = normalize_line_endings(original_text)

    return original_text, normalized_text


def normalize_marker(line: str) -> str:
    """
    Normalize marker line while preserving required parts.
    Standardizes whitespace for comparison.

    Args:
        line: Marker line to normalize

    Returns:
        str: Normalized marker
    """
    return ' '.join(line.split())


def split_with_line_endings(text: str) -> List[str]:
    """
    Split text into lines while preserving original line endings.
    
    Args:
        text: Text to split into lines
        
    Returns:
        List[str]: Lines with their original line endings preserved
    """
    return text.splitlines(keepends=True)
