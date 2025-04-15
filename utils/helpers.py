def get_language_type(file_path):
    """
    Determines language type based on file extension.

    Args:
        file_path (str): Path to the file

    Returns:
        str: Language identifier for code highlighting or empty string if not recognized
    """
    extension_map = {
        '.py': 'python',
        '.js': 'javascript',
        '.html': 'html',
        '.css': 'css',
        '.java': 'java',
        '.cpp': 'cpp',
        '.c': 'c',
        '.cs': 'csharp',
        '.go': 'go',
        '.php': 'php',
        '.rb': 'ruby',
        '.rs': 'rust',
        '.ts': 'typescript',
        '.json': 'json',
        '.xml': 'xml',
        '.yml': 'yaml',
        '.yaml': 'yaml',
        '.md': 'markdown',
        '.sh': 'bash',
        '.sql': 'sql',
        '.pas': 'pascal',
        '.yml': 'yaml',
        'Dockerfile': 'dockerfile',
        # Add more mappings as needed
    }
    import os
    _, ext = os.path.splitext(file_path)
    # Empty string if not a recognized code file
    return extension_map.get(ext.lower(), '')
