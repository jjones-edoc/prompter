# src/utils/response_processor.py

import os
from pathlib import Path
from typing import Tuple, Dict, List, Optional

from utils.response_parser import ResponseParser
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
        Process the response from Claude and apply the edits

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
            'error_count': 0
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

        # Apply each edit block
        for block in parse_result.blocks:
            try:
                success, error_msg = self.file_editor.apply_edit(
                    block.file_path,
                    block.search_text,
                    block.replace_text
                )

                if success:
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

        # Remove duplicates from edited_files list while preserving order
        self.results['edited_files'] = list(dict.fromkeys(self.results['edited_files']))

        return self.results