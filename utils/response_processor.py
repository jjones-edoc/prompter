import os
from pathlib import Path
from typing import Tuple, Dict, List, Optional

from utils.response_parser import ResponseParser, EditBlock
from utils.file_editor import FileEditor


class ClaudeResponseProcessor:
    """Processes Claude's code edit responses and applies the changes to files"""

    def __init__(self, root_dir: str):
        self.root_dir = Path(root_dir).resolve()
        self.file_editor = FileEditor(root_dir)
        self.response_parser = ResponseParser()
        self.results = {
            'edited_files': [],
            'errors': [],
            'success_count': 0,
            'error_count': 0
        }

    def process_response(self, claude_response: str) -> Dict:
        """
        Process the response from Claude and apply the edits.
        Groups edits by file and validates all search blocks for a file before applying changes.

        Args:
            claude_response: The text response from Claude containing edit blocks

        Returns:
            Dict: Results of the processing including success/failure counts and errors
        """
        # Reset results for this processing run
        self.results = {
            'edited_files': [],
            'errors': [],
            'success_count': 0,
            'error_count': 0,
            'validation_failures': [],
            'files_skipped': []
        }

        # Parse the response into edit blocks
        parse_result = self.response_parser.parse_response(claude_response)

        # Handle parsing errors
        if parse_result.errors:
            for line_num, error_msg in parse_result.errors:
                self.results['errors'].append({
                    'type': 'parsing_error',
                    'line': line_num,
                    'message': error_msg
                })
            self.results['error_count'] += len(parse_result.errors)
            return self.results

        # Group blocks by file path
        blocks_by_file = {}
        for block in parse_result.blocks:
            if block.file_path not in blocks_by_file:
                blocks_by_file[block.file_path] = []
            blocks_by_file[block.file_path].append(block)

        # Process each file
        for file_path, blocks in blocks_by_file.items():
            validation_errors = self._validate_file_blocks(file_path, blocks)
            
            # If any validation errors, record them and skip this file
            if validation_errors:
                validation_failure = {
                    'file': file_path,
                    'errors': validation_errors,
                    'block_count': len(blocks)
                }
                self.results['validation_failures'].append(validation_failure)
                self.results['error_count'] += len(validation_errors)
                self.results['files_skipped'].append(file_path)
                
                # Add a summary error for this file
                self.results['errors'].append({
                    'type': 'file_validation_failed',
                    'file': file_path,
                    'message': f"File skipped: {len(validation_errors)} of {len(blocks)} edit blocks failed validation",
                    'details': [e['message'] for e in validation_errors]
                })
                
                continue
            
            # All validations passed, apply the edits
            for block in blocks:
                try:
                    success, error_msg = self.file_editor.apply_edit(
                        block.file_path,
                        block.search_text,
                        block.replace_text
                    )

                    if success:
                        if block.file_path not in self.results['edited_files']:
                            self.results['edited_files'].append(block.file_path)
                        self.results['success_count'] += 1
                    else:
                        self.results['errors'].append({
                            'type': 'edit_error',
                            'file': block.file_path,
                            'message': error_msg,
                            'line': block.line_number
                        })
                        self.results['error_count'] += 1

                except Exception as e:
                    self.results['errors'].append({
                        'type': 'execution_error',
                        'file': block.file_path,
                        'message': str(e),
                        'line': block.line_number
                    })
                    self.results['error_count'] += 1

        return self.results
        
    def _validate_file_blocks(self, file_path: str, blocks: List[EditBlock]) -> List[Dict]:
        """
        Validate all search blocks for a file before applying any changes.
        
        Args:
            file_path: Path to the file
            blocks: List of edit blocks for the file
            
        Returns:
            List of validation error dictionaries
        """
        validation_errors = []
        
        for i, block in enumerate(blocks):
            try:
                is_valid, error_msg = self.file_editor.validate_edit(
                    block.file_path,
                    block.search_text
                )
                
                if not is_valid:
                    # Extract the first 50 chars of search text for error context
                    search_preview = block.search_text[:50] + "..." if len(block.search_text) > 50 else block.search_text
                    search_preview = search_preview.replace('\n', '\\n')
                    
                    validation_errors.append({
                        'type': 'validation_error',
                        'file': block.file_path,
                        'message': error_msg,
                        'line': block.line_number,
                        'block_index': i,
                        'search_preview': search_preview
                    })
            except Exception as e:
                validation_errors.append({
                    'type': 'validation_exception',
                    'file': block.file_path,
                    'message': str(e),
                    'line': block.line_number,
                    'block_index': i
                })
                
        return validation_errors