/**
 * Handler for the unfamiliar files page functionality
 */

var UnfamiliarHandler = (function() {
  // Keep track of the current file being processed
  var currentFile = null;
  
  /**
   * Initialize the unfamiliar files handler
   */
  function init() {
    // If we're not on the unfamiliar page, return
    if (!document.getElementById('process-file-btn')) {
      return;
    }
    
    // Load the next file if not already loaded
    if (!currentFile) {
      loadNextFile();
    }
    
    // Set up event listeners
    setupEventListeners();
  }
  
  /**
   * Set up all event listeners
   */
  function setupEventListeners() {
    // Process file button
    const processBtn = document.getElementById('process-file-btn');
    if (processBtn) {
      processBtn.addEventListener('click', generatePrompt);
    }
    
    // Skip file button
    const skipBtn = document.getElementById('skip-file-btn');
    if (skipBtn) {
      skipBtn.addEventListener('click', skipFile);
    }
    
    // Save response button
    const saveBtn = document.getElementById('save-response-btn');
    if (saveBtn) {
      saveBtn.addEventListener('click', saveResponse);
    }
  }
  
  /**
   * Load the next file needing a summary
   */
  function loadNextFile() {
    // Show loading state
    document.getElementById('file-path').textContent = 'Loading...';
    document.getElementById('file-tokens').textContent = '0';
    
    // Get the next file from the API
    fetch('/api/get_next_unsummarized_file')
      .then(response => {
        if (!response.ok) {
          if (response.status === 404) {
            // No more files to process
            showNoFilesState();
            return null;
          }
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json();
      })
      .then(data => {
        if (data) {
          // Store the current file data
          currentFile = data;
          
          // Update UI
          document.getElementById('file-path').textContent = data.file_path;
          document.getElementById('file-tokens').textContent = data.token_count;
          
          // Show the next file section
          document.getElementById('next-file-section').classList.remove('d-none');
          document.getElementById('no-files-section').classList.add('d-none');
          
          // Hide the prompt and response sections
          document.getElementById('prompt-section').classList.add('d-none');
          document.getElementById('response-section').classList.add('d-none');
        }
      })
      .catch(error => {
        console.error('Error loading next file:', error);
        document.getElementById('file-path').textContent = 'Error loading file';
      });
  }
  
  /**
   * Generate prompt for the current file
   */
  function generatePrompt() {
    // If no current file, return
    if (!currentFile) {
      alert('No file loaded. Please refresh the page.');
      return;
    }
    
    // Build the prompt based on the current file
    const promptContent = document.getElementById('prompt-content');
    
    // Generate summary prompt with file content
    const prompt = generateSummaryPrompt(
      currentFile.file_path,
      currentFile.content,
      currentFile.language_type
    );
    
    // Set the prompt content
    promptContent.value = prompt;
    
    // Show the prompt section
    document.getElementById('prompt-section').classList.remove('d-none');
    
    // Auto-select the prompt text for easy copying
    promptContent.select();
  }
  
  /**
   * Generate a summary prompt for AI
   */
  function generateSummaryPrompt(filePath, fileContent, languageType) {
    return `Please analyze the following ${languageType} file and extract key information about its structure and purpose.

File: ${filePath}

\`\`\`${languageType}
${fileContent}
\`\`\`

Extract and parse the file content into the following format:

<FILE>
<PATH>${filePath}</PATH>
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
5. Don't add any explanation or notes outside the XML structure`;
  }
  
  /**
   * Skip the current file
   */
  function skipFile() {
    // If no current file, return
    if (!currentFile) {
      alert('No file loaded. Please refresh the page.');
      return;
    }
    
    // Confirm skipping
    if (!confirm(`Are you sure you want to skip ${currentFile.file_path}? This file will be marked as processed but won't have a detailed summary.`)) {
      return;
    }
    
    // Create form data
    const formData = new FormData();
    formData.append('file_path', currentFile.file_path);
    
    // Send skip request
    fetch('/api/skip_file', {
      method: 'POST',
      body: formData
    })
      .then(response => {
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json();
      })
      .then(data => {
        // Update the remaining count
        updateRemainingCount(data.remaining_count);
        
        // Show success message
        showStatusMessage('process-status', 'File skipped successfully.', 'success');
        
        // Load the next file
        loadNextFile();
      })
      .catch(error => {
        console.error('Error skipping file:', error);
        showStatusMessage('process-status', `Error skipping file: ${error.message}`, 'danger');
      });
  }
  
  /**
   * Save the AI response and update the file summary
   */
  function saveResponse() {
    // If no current file, return
    if (!currentFile) {
      alert('No file loaded. Please refresh the page.');
      return;
    }
    
    // Get the AI response
    const responseText = document.getElementById('ai-response').value;
    
    // Check if response is empty
    if (!responseText.trim()) {
      showStatusMessage('process-status', 'Please paste the AI\'s response first.', 'danger');
      return;
    }
    
    // Show loading status
    showStatusMessage('process-status', 'Processing response...', 'info');
    
    // Try to parse the response to extract summary data
    try {
      // Extract data from AI response
      const fileMatch = responseText.match(/<FILE>\s*([\s\S]*?)\s*<\/FILE>/);
      if (!fileMatch) {
        showStatusMessage('process-status', 'Could not find <FILE> tags in the response. Please check the format.', 'danger');
        return;
      }
      
      const fileContent = fileMatch[1];
      
      // Extract summary
      const summaryMatch = fileContent.match(/<SUMMARY>\s*([\s\S]*?)\s*<\/SUMMARY>/);
      if (!summaryMatch) {
        showStatusMessage('process-status', 'Could not find <SUMMARY> tags in the response.', 'danger');
        return;
      }
      const summary = summaryMatch[1].trim();
      
      // Extract tree
      const treeMatch = fileContent.match(/<TREE>\s*([\s\S]*?)\s*<\/TREE>/);
      if (!treeMatch) {
        showStatusMessage('process-status', 'Could not find <TREE> tags in the response.', 'danger');
        return;
      }
      const tree = treeMatch[1].trim();
      
      // Extract dependencies
      const depsMatch = fileContent.match(/<DEPENDENCIES>\s*([\s\S]*?)\s*<\/DEPENDENCIES>/);
      if (!depsMatch) {
        showStatusMessage('process-status', 'Could not find <DEPENDENCIES> tags in the response.', 'danger');
        return;
      }
      const dependencies = depsMatch[1].trim();
      
      // Create form data
      const formData = new FormData();
      formData.append('file_path', currentFile.file_path);
      formData.append('summary', summary);
      formData.append('tree', tree);
      formData.append('dependencies', dependencies);
      
      // Send update request
      fetch('/api/update_file_summary', {
        method: 'POST',
        body: formData
      })
        .then(response => {
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }
          return response.json();
        })
        .then(data => {
          // Update the remaining count
          updateRemainingCount(data.remaining_count);
          
          // Show success message
          showStatusMessage('process-status', 'File summary updated successfully!', 'success');
          
          // Clear the response textarea
          document.getElementById('ai-response').value = '';
          
          // Load the next file
          setTimeout(() => {
            loadNextFile();
          }, 1000);
        })
        .catch(error => {
          console.error('Error updating file summary:', error);
          showStatusMessage('process-status', `Error updating file summary: ${error.message}`, 'danger');
        });
    } catch (error) {
      console.error('Error parsing AI response:', error);
      showStatusMessage('process-status', `Error parsing AI response: ${error.message}`, 'danger');
    }
  }
  
  /**
   * Update the remaining files count
   */
  function updateRemainingCount(count) {
    // Update the counter on the page
    const countElement = document.getElementById('remaining-files');
    if (countElement) {
      countElement.textContent = count;
    }
    
    // Update the unfamiliar files button count
    const unfamiliarBtns = document.querySelectorAll('.unfamiliar-files-btn');
    unfamiliarBtns.forEach(btn => {
      const countElement = btn.querySelector('.unfamiliar-count');
      if (countElement) {
        countElement.textContent = count;
      }
      
      // Update the title/tooltip
      btn.setAttribute('title', `${count} unfamiliar file${count !== 1 ? 's' : ''}`);
      
      // Show/hide based on count
      if (count > 0) {
        btn.classList.remove('d-none');
      } else {
        btn.classList.add('d-none');
      }
    });
  }
  
  /**
   * Show the "no files" state when all files have been processed
   */
  function showNoFilesState() {
    document.getElementById('next-file-section').classList.add('d-none');
    document.getElementById('prompt-section').classList.add('d-none');
    document.getElementById('response-section').classList.add('d-none');
    document.getElementById('no-files-section').classList.remove('d-none');
    
    // Reset current file
    currentFile = null;
    
    // Update remaining count to 0
    updateRemainingCount(0);
  }
  
  /**
   * Show a status message
   */
  function showStatusMessage(elementId, message, type) {
    const statusElement = document.getElementById(elementId);
    if (statusElement) {
      statusElement.textContent = message;
      statusElement.classList.remove('d-none', 'alert-success', 'alert-danger', 'alert-info', 'alert-warning');
      statusElement.classList.add(`alert-${type}`);
    }
  }
  
  // Return public methods
  return {
    init: init,
    loadNextFile: loadNextFile,
    generatePrompt: generatePrompt,
    skipFile: skipFile,
    saveResponse: saveResponse
  };
})();

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
  UnfamiliarHandler.init();
});
