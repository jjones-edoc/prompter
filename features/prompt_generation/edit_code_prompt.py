from features.prompt_generation.planning_prompt import planning_prompt
from features.prompt_generation.editing_prompt import editing_prompt


def edit_code_prompt():
    """
    Returns the combined planning and editing prompt for backward compatibility.
    This function combines the planning_prompt and editing_prompt functions
    to maintain the original functionality.

    Returns:
        str: The combined planning and editing prompt text
    """
    # Combine both prompts with a separator for clarity
    return planning_prompt() + "\n\n" + editing_prompt()
