import re
import os
from typing import Dict, List, Optional, Any, Tuple, Set


def get_repository_structure(scanner, current_file_path: str) -> str:
    """
    Get the structure of the repository as a formatted string to include in the prompt.

    Args:
        scanner: Scanner instance to scan the repository
        current_file_path: Path of the current file being summarized

    Returns:
        str: Formatted repository structure
    """
    # Get all files recursively
    all_files = set()

    def collect_files_recursive(path: str):
        items = scanner.get_items(path)
        # Add files in this directory
        for file_info in items['files']:
            all_files.add(file_info['path'])
        # Process subdirectories
        for dir_info in items['dirs']:
            collect_files_recursive(dir_info['path'])

    # Start from root directory
    collect_files_recursive("")

    # Group files by directory for easier visualization
    file_structure = {}
    for file_path in sorted(all_files):
        dir_path = os.path.dirname(file_path)
        if dir_path not in file_structure:
            file_structure[dir_path] = []
        file_structure[dir_path].append(os.path.basename(file_path))

    # Format the structure as a nested string
    structure_str = "Repository structure:\n"
    for dir_path in sorted(file_structure.keys()):
        # Skip empty directory path
        if dir_path:
            # Calculate directory depth for indentation
            depth = dir_path.count('/') + 1
            indent = '  ' * depth
            structure_str += f"{indent}{dir_path}/\n"
        else:
            # Root directory
            structure_str += "  /\n"
            indent = '    '

        # Add files in this directory
        for file_name in sorted(file_structure[dir_path]):
            file_indent = indent + '  ' if dir_path else indent
            structure_str += f"{file_indent}{file_name}\n"

    return structure_str


def generate_summary_prompt(file_path: str, file_content: str, language_type: str, scanner=None) -> str:
    """
    Generate a prompt for AI to summarize a file.

    Args:
        file_path: Path to the file
        file_content: Content of the file
        language_type: Programming language type
        scanner: Optional Scanner instance to include repository structure

    Returns:
        str: Formatted prompt
    """
    # Include repository structure if scanner is provided
    repo_structure = ""
    if scanner:
        repo_structure = get_repository_structure(scanner, file_path)

    # Create the prompt with detailed instructions
    prompt = f"""Please analyze the following {language_type} file and extract key information about its structure and purpose.

File: {file_path}

```{language_type}
{file_content}
```

{repo_structure}

Extract and parse the file content into the following format:

<FILE>
<PATH>{file_path}</PATH>
<SUMMARY>
[Provide a concise 2-4 sentence description of the file's purpose and functionality. Focus on what this file does, what components it defines, and its role in the overall system. Be specific and technical, but clear.]
</SUMMARY>
<TREE>
[List all significant classes, interfaces, functions, methods, and constants defined in this file - one per line. Include only top-level elements and class methods, not local variables or nested utility functions. For each function or method, include a very brief indication of its purpose.]
</TREE>
<DEPENDENCIES>
[ONLY list internal project files that this file imports or depends on - one per line. Do NOT list standard library modules or external packages. For each internal dependency:

1. ONLY include files that actually exist in this repository (shown in the repository structure above)
2. Use relative import paths (e.g., '../utils/helpers.py' instead of 'utils.helpers')
3. Match import statements in the code to actual files in the repository
4. If the file has no internal dependencies, leave this section empty or write nothing between the tags]
</DEPENDENCIES>
</FILE>

Important:
1. The SUMMARY should be technical but readable, explaining what this code does and why it exists
2. The TREE should list the key components that make up the file's API surface
3. The DEPENDENCIES section must ONLY list internal project files that exist in the repository structure provided above - DO NOT include standard libraries or external packages
4. Use relative paths for all dependencies (based on the current file location)
5. Maintain the exact XML format with the tags as shown - this will be parsed automatically
6. Don't add any explanation or notes outside the XML structure
"""

    return prompt


def parse_ai_response(response: str) -> Tuple[Optional[Dict[str, Any]], Optional[str]]:
    """
    Parse the AI response to extract file summary information.

    Args:
        response: AI response text

    Returns:
        Tuple of (parsed data dict, error message)
    """
    # Initialize result
    parsed_data = {
        'summary': None,
        'tree': None,
        'dependencies': None
    }

    # Check if response is empty
    if not response or len(response.strip()) == 0:
        return None, "Empty response"

    # Extract content between FILE tags
    file_match = re.search(r'<FILE>\s*(.*?)\s*</FILE>', response, re.DOTALL)
    if not file_match:
        return None, "Could not find <FILE> tags in the response"

    file_content = file_match.group(1)

    # Extract summary
    summary_match = re.search(
        r'<SUMMARY>\s*(.*?)\s*</SUMMARY>', file_content, re.DOTALL)
    if summary_match:
        parsed_data['summary'] = summary_match.group(1).strip()
    else:
        return None, "Could not find <SUMMARY> tags"

    # Extract tree
    tree_match = re.search(r'<TREE>\s*(.*?)\s*</TREE>',
                           file_content, re.DOTALL)
    if tree_match:
        tree_content = tree_match.group(1).strip()
        # Handle "None" or empty tree
        if tree_content.lower() == "none" or not tree_content:
            parsed_data['tree'] = ""
        else:
            parsed_data['tree'] = tree_content
    else:
        return None, "Could not find <TREE> tags"

    # Extract dependencies
    deps_match = re.search(
        r'<DEPENDENCIES>\s*(.*?)\s*</DEPENDENCIES>', file_content, re.DOTALL)
    if deps_match:
        deps_content = deps_match.group(1).strip()
        # Handle "None" or empty dependencies - treat "None" as no dependencies
        if deps_content.lower() == "none" or not deps_content:
            parsed_data['dependencies'] = ""
        else:
            parsed_data['dependencies'] = deps_content
    else:
        return None, "Could not find <DEPENDENCIES> tags"

    return parsed_data, None
