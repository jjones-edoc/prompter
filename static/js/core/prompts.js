/**
 * Generate Feature Prompts Module
 * Contains static prompt templates used by the prompt generation feature
 */
const GeneratePrompts = (function () {
  /**
   * Returns the editing prompt template
   * @returns {string} The editing prompt text
   */
  function getEditingPrompt() {
    return `### Please use the following instructions for suggesting code changes:
  
  Always use best practices when recommending code changes.
  Respect and use existing conventions, libraries, and patterns present in the code.
  
  CRITICAL: When using <Search> and <Replace> tags, you MUST preserve exact whitespace at the beginning of each line.
  Failing to match the exact indentation will cause the edit to fail. Copy the exact indentation from the original code.
  
  XML syntax for suggesting code changes, must follow these formats:
  
  For modifying existing code:
  <ModifyCode>
  <File>path/to/file.py</File>
  <Search>
  [exact content to find with EXACT whitespace/indentation preserved]
  </Search>
  <Replace>
  [new content with matching whitespace/indentation at line beginnings]
  </Replace>
  </ModifyCode>
  
  For creating new files:
  <NewFile>
  <File>path/to/new_file.py</File>
  <Content>
  [content of the new file]
  </Content>
  </NewFile>
  
  For deleting files:
  <DeleteFile>
  <File>path/to/file_to_delete.py</File>
  </DeleteFile>
  
  For moving files:
  <MoveFile>
  <Source>path/to/source_file.py</Source>
  <Destination>path/to/destination_file.py</Destination>
  </MoveFile>
  
  For replacing the content of an entire file:
  <ReplaceFile>
  <File>path/to/file.py</File>
  <Content>
  [entire new content]
  </Content>
  </ReplaceFile>
  
  General steps to follow:
  1. Read the instructions carefully and understand the changes required.
  2. Identify the file(s) that need to be modified or created.
  3. For each file, determine the appropriate XML tag to use based on the type of change (modify, create, delete, move, replace).
  4. If there are more than a couple of couple of recommended changes in a file use the <ReplaceFile> tag.
  5. Construct the XML blocks using the identified tag and the provided instructions.
  6. When using the <ModifyCode> tag, ensure that:
     - The <Search> and <Replace> tags are used correctly to find and replace the exact content.
     - The whitespace/indentation at the beginning of each line is PRESERVED EXACTLY in both search and replace blocks.
     - Line endings and other invisible characters are maintained correctly.
  7. If you use artifacts in your responses, put the code edits in a new artifact.
  8. Make precise suggested code changes when possible by providing just enough lines in the search criteria to be able to locate the code that would be changed.
  9. After providing the suggested code changes for a step, wait for the user to confirm before proceeding to the next step.
  
  Tips for preserving whitespace:
  - Copy-paste from the original code whenever possible to maintain exact indentation
  - Pay attention to tabs vs. spaces in the original code
  - Ensure the same number of leading spaces/tabs in both <Search> and <Replace> blocks
  - When adding new lines, match the indentation style of the surrounding code`;
  }

  /**
   * Returns the planning prompt template
   * @returns {string} The planning prompt text
   */
  function getPlanningPrompt() {
    // This would contain the actual planning prompt from planning_prompt.py
    // You'd need to copy the actual content from that file
    return `### Planning Prompt for Code Changes
  
  This is a planning prompt to help you think through significant code changes before implementing them. Please provide your analysis and plans in the format below. 
  
  ## Goals and Requirements Analysis:
  - What are the primary goals of the requested changes?
  - What are the specific requirements I need to fulfill?
  - Are there any potential edge cases or complications I should consider?
  
  ## Affected Components:
  - Which files and components will be affected by the changes?
  - What are the dependencies between these components?
  - How might these changes impact other parts of the codebase?
  
  ## Implementation Strategy:
  - What's the high-level approach for implementing these changes?
  - What will be the sequence of modifications?
  - Are there any architectural decisions that need to be made?
  
  ## Potential Challenges:
  - What parts of the implementation might be difficult or risky?
  - Are there any performance, security, or compatibility concerns?
  - How will I ensure the changes don't break existing functionality?
  
  ## Testing Strategy:
  - How will I test these changes?
  - What edge cases should be tested?
  - How will I verify that the changes meet all requirements?
  
  Please provide a clear, step-by-step plan before making any actual code changes.`;
  }

  // Public API
  return {
    getEditingPrompt,
    getPlanningPrompt,
  };
})();
