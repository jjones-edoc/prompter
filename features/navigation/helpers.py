"""
Helper functions for navigation and search features.
"""
from typing import Dict, List, Any, Optional
import os


def format_search_results(matching_files: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Format search results for display.

    Args:
        matching_files: List of matching file dictionaries from the scanner

    Returns:
        Dict with formatted search results
    """
    # Group files by directory for easier navigation
    results_by_dir = {}
    for file_info in matching_files:
        dir_path = os.path.dirname(file_info['path'])
        if dir_path not in results_by_dir:
            results_by_dir[dir_path] = []
        results_by_dir[dir_path].append(file_info)

    # Create a summary of results
    summary = {
        'total_files': len(matching_files),
        'total_matches': sum(f.get('match_count', 0) for f in matching_files),
        'directories': len(results_by_dir)
    }

    return {
        'summary': summary,
        'results_by_directory': results_by_dir,
        'all_results': matching_files
    }
