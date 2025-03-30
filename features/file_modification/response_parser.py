import re
from typing import List, Optional, Tuple, Dict
from pathlib import Path
import xml.etree.ElementTree as ET
from features.file_modification.models import EditBlock, MoveOperation, ParseResult
from features.file_modification.normalization import (
    normalize_line_endings,
    extract_and_normalize_text,
    split_with_line_endings
)


class ResponseParser:
    """Parses AI responses into edit commands with line ending normalization"""

    # Constants for validation
    MAX_BLOCK_LINES = 1000
    MAX_LINE_LENGTH = 10000

    # XML tag patterns
    XML_TAGS = {
        'modify_code': 'ModifyCode',
        'new_file': 'NewFile',
        'delete_file': 'DeleteFile',
        'move_file': 'MoveFile',
        'replace_file': 'ReplaceFile',
        'file': 'File',
        'source': 'Source',
        'destination': 'Destination',
        'search': 'Search',
        'replace': 'Replace',
        'content': 'Content'
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

    def extract_xml_blocks(self, response_text: str) -> Tuple[List[Tuple[str, str, int]], List[str], List[Tuple[int, str]]]:
        """
        Extract XML blocks from the response text.
        
        Args:
            response_text: Full response text from the AI
            
        Returns:
            Tuple containing:
            - List of tuples (block_type, block_content, line_number)
            - List of original XML blocks as strings
            - List of errors (line_number, error_message)
        """
        print(f"Extracting XML blocks from response text - length: {len(response_text)}")
        
        lines = split_with_line_endings(response_text)
        print(f"Split response into {len(lines)} lines")
        
        blocks = []
        raw_blocks = []
        errors = []
        
        # XML tags to look for
        xml_tags = list(self.XML_TAGS.values())
        opening_tags = [f"<{tag}>" for tag in xml_tags]
        closing_tags = [f"</{tag}>" for tag in xml_tags]
        
        print(f"Looking for these XML tags: {xml_tags}")
        
        # Find XML blocks
        i = 0
        while i < len(lines):
            try:
                line = lines[i].strip()
                
                # Check for opening tags
                for tag_idx, opening_tag in enumerate(opening_tags):
                    if opening_tag in line:
                        tag_name = xml_tags[tag_idx]
                        closing_tag = closing_tags[tag_idx]
                        block_start = i
                        
                        print(f"Found opening tag {opening_tag} at line {i+1}")
                        
                        # Find closing tag
                        block_end = None
                        for j in range(i, min(i + self.MAX_BLOCK_LINES, len(lines))):
                            if closing_tag in lines[j]:
                                block_end = j
                                print(f"Found closing tag {closing_tag} at line {j+1}")
                                break
                        
                        if block_end is None:
                            print(f"ERROR: Missing closing tag {closing_tag} for {opening_tag}")
                            errors.append((i + 1, f"Missing closing tag {closing_tag} for {opening_tag}"))
                            i += 1
                            break
                        
                        # Extract block content
                        block_content = "".join(lines[block_start:block_end + 1])
                        print(f"Extracted block content - length: {len(block_content)}")
                        print(f"Block content preview: {block_content[:100]}..." if len(block_content) > 100 else block_content)
                        
                        raw_blocks.append(block_content)
                        blocks.append((tag_name, block_content, block_start + 1))
                        
                        # Move to the end of the block
                        i = block_end + 1
                        break
                else:
                    # No opening tag found in this line
                    i += 1
            except Exception as e:
                print(f"ERROR during XML extraction at line {i+1}: {str(e)}")
                errors.append((i + 1, str(e)))
                i += 1
        
        return blocks, raw_blocks, errors
    
    def parse_xml_content(self, xml_content: str) -> Optional[Dict]:
        """
        Parse XML content into a structured dictionary.
        
        Args:
            xml_content: XML content as string
            
        Returns:
            Dictionary with parsed content or None if parsing failed
        """
        try:
            # Add debug logging
            print("Parsing XML content - length:", len(xml_content))
            
            # Skip XML sanitization entirely and use direct regex pattern matching
            # This is more reliable for our specific XML format
            result = {"tag": "ModifyCode"}  # Default to ModifyCode for now
            
            # Extract child elements directly using regex patterns
            # These patterns work with raw XML without transformations
            file_match = re.search(r'<File>(.*?)</File>', xml_content, re.DOTALL)
            if file_match:
                result["file"] = file_match.group(1).strip()
                print(f"Found File tag with content: {result['file']}")
            
            # Modified search pattern extraction to handle empty lines after the opening tag
            search_match = re.search(r'<Search>(.*?)</Search>', xml_content, re.DOTALL)
            if search_match:
                search_content = search_match.group(1)
                # Check if search content has only a newline at the beginning
                if search_content and (search_content.startswith('\r\n') or search_content.startswith('\n')):
                    # Remove just the first newline (LF or CRLF)
                    if search_content.startswith('\r\n'):
                        search_content = search_content[2:]
                    elif search_content.startswith('\n'):
                        search_content = search_content[1:]
                
                result["search"] = search_content
                print(f"Found Search tag with content length: {len(result['search'])}")
            
            # Modified replace pattern extraction to be consistent with search handling
            replace_match = re.search(r'<Replace>(.*?)</Replace>', xml_content, re.DOTALL)
            if replace_match:
                replace_content = replace_match.group(1)
                # Check if replace content has only a newline at the beginning
                if replace_content and (replace_content.startswith('\r\n') or replace_content.startswith('\n')):
                    # Remove just the first newline (LF or CRLF)
                    if replace_content.startswith('\r\n'):
                        replace_content = replace_content[2:]
                    elif replace_content.startswith('\n'):
                        replace_content = replace_content[1:]
                
                result["replace"] = replace_content
                print(f"Found Replace tag with content length: {len(result['replace'])}")
            
            source_match = re.search(r'<Source>(.*?)</Source>', xml_content, re.DOTALL)
            if source_match:
                result["source"] = source_match.group(1).strip()
                print(f"Found Source tag with content: {result['source']}")
            
            destination_match = re.search(r'<Destination>(.*?)</Destination>', xml_content, re.DOTALL)
            if destination_match:
                result["destination"] = destination_match.group(1).strip()
                print(f"Found Destination tag with content: {result['destination']}")
            
            # Modified content pattern extraction to be consistent with search/replace handling
            content_match = re.search(r'<Content>(.*?)</Content>', xml_content, re.DOTALL)
            if content_match:
                content_value = content_match.group(1)
                # Check if content has only a newline at the beginning
                if content_value and (content_value.startswith('\r\n') or content_value.startswith('\n')):
                    # Remove just the first newline (LF or CRLF)
                    if content_value.startswith('\r\n'):
                        content_value = content_value[2:]
                    elif content_value.startswith('\n'):
                        content_value = content_value[1:]
                
                result["content"] = content_value
                print(f"Found Content tag with content length: {len(result['content'])}")
            
            # Extract the tag name itself
            tag_match = re.match(r'<(\w+)>', xml_content)
            if tag_match:
                result["tag"] = tag_match.group(1)
                print(f"Found root tag: {result['tag']}")
            
            # Verify we have the minimum required elements for a valid operation
            # This depends on the operation type
            if result["tag"] == "ModifyCode":
                if not all(key in result for key in ["file", "search", "replace"]):
                    missing = [key for key in ["file", "search", "replace"] if key not in result]
                    raise Exception(f"Missing required elements for ModifyCode: {', '.join(missing)}")
            elif result["tag"] == "NewFile":
                if not all(key in result for key in ["file", "content"]):
                    missing = [key for key in ["file", "content"] if key not in result]
                    raise Exception(f"Missing required elements for NewFile: {', '.join(missing)}")
            elif result["tag"] == "DeleteFile":
                if "file" not in result:
                    raise Exception("Missing required 'file' element for DeleteFile")
            elif result["tag"] == "MoveFile":
                if not all(key in result for key in ["source", "destination"]):
                    missing = [key for key in ["source", "destination"] if key not in result]
                    raise Exception(f"Missing required elements for MoveFile: {', '.join(missing)}")
            elif result["tag"] == "ReplaceFile":
                if not all(key in result for key in ["file", "content"]):
                    missing = [key for key in ["file", "content"] if key not in result]
                    raise Exception(f"Missing required elements for ReplaceFile: {', '.join(missing)}")
            
            print(f"Successfully extracted XML with {len(result)} elements")
            return result
                
        except Exception as e:
            # Add error logging
            print(f"XML parsing error: {str(e)}")
            return None

    def parse_response(self, response_text: str) -> ParseResult:
        """
        Parse the AI response into a list of edit blocks with error tracking.
        Handles XML format and preserves whitespace.

        Args:
            response_text: The full response text from the AI

        Returns:
            ParseResult: Object containing parsed blocks and any errors
        """
        self.active_file = None
        blocks = []
        move_operations = []
        errors = []

        # Extract XML blocks
        xml_blocks, raw_blocks, extract_errors = self.extract_xml_blocks(response_text)
        errors.extend(extract_errors)

        if not xml_blocks:
            return ParseResult(blocks=[], move_operations=[], errors=errors)

        # Process each XML block
        for tag_name, block_content, line_number in xml_blocks:
            try:
                parsed_content = self.parse_xml_content(block_content)
                if not parsed_content:
                    errors.append((line_number, f"Failed to parse {tag_name} XML block"))
                    continue

                # Process based on block type
                if tag_name == self.XML_TAGS['modify_code']:
                    edit_block = self._process_modify_code(parsed_content, line_number, block_content)
                    if edit_block:
                        blocks.append(edit_block)
                    else:
                        errors.append((line_number, f"Invalid {tag_name} block format"))
                
                elif tag_name == self.XML_TAGS['new_file']:
                    edit_block = self._process_new_file(parsed_content, line_number, block_content)
                    if edit_block:
                        blocks.append(edit_block)
                    else:
                        errors.append((line_number, f"Invalid {tag_name} block format"))
                
                elif tag_name == self.XML_TAGS['delete_file']:
                    edit_block = self._process_delete_file(parsed_content, line_number, block_content)
                    if edit_block:
                        blocks.append(edit_block)
                    else:
                        errors.append((line_number, f"Invalid {tag_name} block format"))
                
                elif tag_name == self.XML_TAGS['replace_file']:
                    edit_block = self._process_replace_file(parsed_content, line_number, block_content)
                    if edit_block:
                        blocks.append(edit_block)
                    else:
                        errors.append((line_number, f"Invalid {tag_name} block format"))
                
                elif tag_name == self.XML_TAGS['move_file']:
                    move_op = self._process_move_file(parsed_content, line_number, block_content)
                    if move_op:
                        move_operations.append(move_op)
                    else:
                        errors.append((line_number, f"Invalid {tag_name} block format"))
                
                else:
                    errors.append((line_number, f"Unknown XML tag: {tag_name}"))

            except Exception as e:
                errors.append((line_number, f"Error processing {tag_name} block: {str(e)}"))

        return ParseResult(blocks=blocks, move_operations=move_operations, errors=errors)

    def _process_modify_code(self, parsed_content: Dict, line_number: int, raw_command: str) -> Optional[EditBlock]:
        """Process ModifyCode XML block"""
        try:
            if not all(key in parsed_content for key in ['file', 'search', 'replace']):
                return None
            
            file_path = parsed_content['file']
            search_text = parsed_content['search']
            replace_text = parsed_content['replace']
            
            if not self.validate_file_path(file_path):
                return None
            
            # Create EditBlock object
            self.active_file = Path(file_path.strip()).as_posix()
            
            # Normalize text for comparison
            normalized_search = normalize_line_endings(search_text)
            normalized_replace = normalize_line_endings(replace_text)
            
            edit_block = EditBlock(
                file_path=self.active_file,
                search_text=search_text,
                replace_text=replace_text,
                raw_command=raw_command,
                line_number=line_number,
                normalized_search=normalized_search,
                normalized_replace=normalized_replace
            )
            
            return edit_block
        except Exception:
            return None

    def _process_new_file(self, parsed_content: Dict, line_number: int, raw_command: str) -> Optional[EditBlock]:
        """Process NewFile XML block"""
        try:
            if not all(key in parsed_content for key in ['file', 'content']):
                return None
            
            file_path = parsed_content['file']
            content = parsed_content['content']
            
            if not self.validate_file_path(file_path):
                return None
            
            self.active_file = Path(file_path.strip()).as_posix()
            
            # For new files, search is empty and replace contains the content
            edit_block = EditBlock(
                file_path=self.active_file,
                search_text="",
                replace_text=content,
                raw_command=raw_command,
                line_number=line_number,
                normalized_search="",
                normalized_replace=normalize_line_endings(content)
            )
            
            return edit_block
        except Exception:
            return None

    def _process_delete_file(self, parsed_content: Dict, line_number: int, raw_command: str) -> Optional[EditBlock]:
        """Process DeleteFile XML block"""
        try:
            if 'file' not in parsed_content:
                return None
            
            file_path = parsed_content['file']
            
            if not self.validate_file_path(file_path):
                return None
            
            self.active_file = Path(file_path.strip()).as_posix()
            
            # For delete files, search is "#ENTIRE_FILE" and replace is empty
            edit_block = EditBlock(
                file_path=self.active_file,
                search_text="#ENTIRE_FILE",
                replace_text="",
                raw_command=raw_command,
                line_number=line_number,
                normalized_search="#ENTIRE_FILE",
                normalized_replace=""
            )
            
            return edit_block
        except Exception:
            return None

    def _process_replace_file(self, parsed_content: Dict, line_number: int, raw_command: str) -> Optional[EditBlock]:
        """Process ReplaceFile XML block"""
        try:
            if not all(key in parsed_content for key in ['file', 'content']):
                return None
            
            file_path = parsed_content['file']
            content = parsed_content['content']
            
            if not self.validate_file_path(file_path):
                return None
            
            self.active_file = Path(file_path.strip()).as_posix()
            
            # For replace files, search is "#ENTIRE_FILE" and replace contains the new content
            edit_block = EditBlock(
                file_path=self.active_file,
                search_text="#ENTIRE_FILE",
                replace_text=content,
                raw_command=raw_command,
                line_number=line_number,
                normalized_search="#ENTIRE_FILE",
                normalized_replace=normalize_line_endings(content)
            )
            
            return edit_block
        except Exception:
            return None

    def _process_move_file(self, parsed_content: Dict, line_number: int, raw_command: str) -> Optional[MoveOperation]:
        """Process MoveFile XML block"""
        try:
            if not all(key in parsed_content for key in ['source', 'destination']):
                return None
            
            source_path = parsed_content['source']
            dest_path = parsed_content['destination']
            
            if not self.validate_file_path(source_path) or not self.validate_file_path(dest_path):
                return None
            
            move_operation = MoveOperation(
                source_path=source_path,
                dest_path=dest_path,
                line_number=line_number,
                raw_command=raw_command
            )
            
            return move_operation
        except Exception:
            return None