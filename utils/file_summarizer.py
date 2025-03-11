import re
from typing import Dict, List, Optional, Any, Tuple


def generate_summary_prompt(file_path: str, file_content: str, language_type: str) -> str:
    """
    Generate a prompt for AI to summarize a file.
    
    Args:
        file_path: Path to the file
        file_content: Content of the file
        language_type: Programming language type
    
    Returns:
        str: Formatted prompt
    """
    # Create the prompt with detailed instructions
    prompt = f"""Please analyze the following {language_type} file and extract key information about its structure and purpose.

File: {file_path}

```{language_type}
{file_content}
```

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
[List all imports, requires, includes, or other files this file depends on - one per line. Extract actual module/package names, not just import statements. If the file has no explicit dependencies, write "None" on a single line.]
</DEPENDENCIES>
</FILE>

Important:
1. The SUMMARY should be technical but readable, explaining what this code does and why it exists
2. The TREE should list the key components that make up the file's API surface
3. The DEPENDENCIES section should focus on external libraries and internal project files 
4. Maintain the exact XML format with the tags as shown - this will be parsed automatically
5. Don't add any explanation or notes outside the XML structure
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
    summary_match = re.search(r'<SUMMARY>\s*(.*?)\s*</SUMMARY>', file_content, re.DOTALL)
    if summary_match:
        parsed_data['summary'] = summary_match.group(1).strip()
    else:
        return None, "Could not find <SUMMARY> tags"
    
    # Extract tree
    tree_match = re.search(r'<TREE>\s*(.*?)\s*</TREE>', file_content, re.DOTALL)
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
    deps_match = re.search(r'<DEPENDENCIES>\s*(.*?)\s*</DEPENDENCIES>', file_content, re.DOTALL)
    if deps_match:
        deps_content = deps_match.group(1).strip()
        # Handle "None" or empty dependencies
        if deps_content.lower() == "none" or not deps_content:
            parsed_data['dependencies'] = ""
        else:
            parsed_data['dependencies'] = deps_content
    else:
        return None, "Could not find <DEPENDENCIES> tags"
    
    return parsed_data, None
