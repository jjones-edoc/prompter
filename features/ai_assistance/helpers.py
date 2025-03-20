"""
Helper functions for AI assistance features
"""


def filter_files_for_ai_selection(files):
    """
    Filter files for AI selection, removing files without summaries or skipped files.

    Args:
        files: List of file objects with metadata

    Returns:
        List of filtered file objects
    """
    filtered_files = []
    for file in files:
        # Skip files without a summary or with "[Skipped]" in the summary
        if not file.get('summary') or not file['summary'].strip() or '[Skipped]' in file['summary']:
            continue
        filtered_files.append(file)
    return filtered_files


def build_ai_selection_prompt(user_prompt, filtered_files):
    """
    Build the prompt for AI file selection.

    Args:
        user_prompt: User's original prompt
        filtered_files: List of filtered file objects

    Returns:
        Formatted prompt string
    """
    prompt = "# File Selection Task\n"
    prompt += "Your task is to analyze the user's query and identify the most relevant files from the codebase that would help address the query. DO NOT attempt to solve the user's problem or implement a solution - focus ONLY on selecting the appropriate files.\n\n"

    prompt += "# User Query\n"
    prompt += f"{user_prompt}\n\n"

    prompt += "# Available Files\n"
    for file in filtered_files:
        prompt += f"File: {file['file_path']}\n"
        prompt += f"Token Count: {file.get('token_count', 0)}\n"
        prompt += f"Summary: {file['summary']}\n"

        # Add code structure if available
        if file.get('code_data') and isinstance(file['code_data'], dict) and file['code_data'].get('tree'):
            tree = file['code_data']['tree']
            if tree and len(tree) > 0:
                prompt += f"Structure: {', '.join(tree)}\n"

        # Add dependencies if available
        if file.get('dependencies') and isinstance(file['dependencies'], list) and len(file['dependencies']) > 0:
            prompt += f"Dependencies: {', '.join(file['dependencies'])}\n"

        prompt += "\n"

    prompt += "# Required Response Format\n"
    prompt += "Your response MUST use exactly the following format with all three sections:\n\n"

    prompt += "## Thoughts\n"
    prompt += "Think about which files are most relevant to the user's query based on their descriptions, structures, and token counts. Consider what functionality needs to be included to address the query effectively.\n\n"

    prompt += "## Dependency Considerations\n"
    prompt += "Analyze dependencies between files. If you select a file, consider whether its dependencies should also be included. Identify any potential dependency chains necessary for the functionality requested.\n\n"

    prompt += "## Selected Files\n"
    prompt += "List ONLY the file paths you've selected, one per line, with no additional commentary or explanation. Include only files from the AVAILABLE FILES section that are either:\n"
    prompt += "- Directly relevant to implementing the requested functionality\n"
    prompt += "- Dependencies required by selected files\n"
    prompt += "- Core utilities or helpers needed to understand the system's architecture\n"
    prompt += "- ANY files you mentioned or identified in the 'Dependency Considerations' section\n\n"

    prompt += "# Critical Instructions\n"
    prompt += "1. You MUST include all three sections in your response\n"
    prompt += "2. In the 'Selected Files' section, include ONLY file paths - one per line with NO additional commentary\n"
    prompt += "3. DO NOT attempt to solve the user's problem or provide implementation details\n"
    prompt += "4. Select ONLY files that exist in the 'Available Files' section\n"
    prompt += "5. Your role is to identify relevant files, NOT to create a solution\n"
    prompt += "6. IMPORTANT: Every file mentioned in your 'Dependency Considerations' section MUST appear in the 'Selected Files' list\n"

    return prompt


def extract_file_paths_from_ai_response(ai_response):
    """
    Extract file paths from AI selection response.

    Args:
        ai_response: Response text from AI

    Returns:
        List of file paths
    """
    # Split by newlines and trim whitespace
    file_paths = [line.strip()
                  for line in ai_response.splitlines() if line.strip()]

    # Remove any empty lines
    file_paths = [path for path in file_paths if path]

    return file_paths
