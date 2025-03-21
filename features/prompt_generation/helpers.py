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

def generate_directory_structure(scanner, max_depth=None):
    """
    Generate a textual representation of the project's directory structure.
    
    Args:
        scanner: Scanner instance
        max_depth: Maximum directory depth to show (None for unlimited)
        
    Returns:
        str: Formatted directory tree structure
    """
    result = []
    
    def _build_tree(path, prefix="", depth=0):
        if max_depth is not None and depth > max_depth:
            return
            
        items = scanner.get_items(path)
        
        # Sort directories and files
        dirs = sorted(items['dirs'], key=lambda x: x['name'].lower())
        files = sorted(items['files'], key=lambda x: x['name'].lower())
        
        # Process all items in the current directory
        count = len(dirs) + len(files)
        
        # Process directories
        for i, dir_info in enumerate(dirs):
            is_last = (i == count - 1) if i == len(dirs) - 1 else False
            
            # Add the directory to the result
            dir_marker = "└── " if is_last else "├── "
            result.append(f"{prefix}{dir_marker}{dir_info['name']}/")
            
            # Prepare the prefix for sub-items
            next_prefix = prefix + ("    " if is_last else "│   ")
            
            # Recurse into the subdirectory
            _build_tree(dir_info['path'], next_prefix, depth + 1)
        
        # Process files
        for i, file_info in enumerate(files):
            is_last = i == len(files) - 1
            file_marker = "└── " if is_last else "├── "
            result.append(f"{prefix}{file_marker}{file_info['name']}")
    
    # Start building the tree from the root
    result.append("Project Directory Structure:")
    _build_tree("")
    
    return "\n".join(result)
