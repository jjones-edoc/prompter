from dataclasses import dataclass
from typing import List, Optional, Tuple, Dict


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
    
    # Optional field to track the type of edit operation for XML format
    operation_type: str = None


@dataclass
class MoveOperation:
    """Represents a file move operation from the AI response"""
    source_path: str
    dest_path: str
    line_number: int
    raw_command: str


@dataclass
class ParseResult:
    """Contains parsing results and any errors"""
    blocks: List[EditBlock]
    move_operations: List[MoveOperation]
    errors: List[Tuple[int, str]]  # Line number and error message


@dataclass
class XMLEditRequest:
    """Represents a parsed XML edit request with structured fields"""
    tag: str
    file_path: Optional[str] = None
    search_text: Optional[str] = None
    replace_text: Optional[str] = None
    content: Optional[str] = None
    source_path: Optional[str] = None
    destination_path: Optional[str] = None
    line_number: int = 0
    raw_command: str = ""