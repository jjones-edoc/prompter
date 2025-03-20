def _collect_files_recursive(scanner, path, file_list):
    """
    Helper function to collect files recursively from a directory.

    Args:
        scanner: Scanner instance
        path: Path to collect files from
        file_list: List to append files to
    """
    items = scanner.get_items(path)
    # Add files in this directory
    file_list.extend([f['path'] for f in items['files']])
    # Recursively process subdirectories
    for dir_info in items['dirs']:
        _collect_files_recursive(scanner, dir_info['path'], file_list)
