/**
 * Handler for the unfamiliar files page functionality
 */

var UnfamiliarHandler = (function () {
  // Keep track of the current file(s) being processed
  var currentFile = null;
  var multipleFiles = [];
  var currentMode = "single"; // 'single' or 'multi'

  /**
   * Initialize the unfamiliar files handler
   */
  function init() {
    // If we're not on the unfamiliar page, return
    if (!document.getElementById("process-file-btn")) {
      return;
    }

    // Initialize mode from radio buttons
    currentMode = document.querySelector('input[name="processing-mode"]:checked').value;

    // Load initial files based on mode
    if (currentMode === "single") {
      loadNextFile();
    } else {
      loadMultipleFiles();
    }

    // Set up event listeners
    setupEventListeners();
  }

  /**
   * Set up all event listeners
   */
  function setupEventListeners() {
    // Process file button
    const processBtn = document.getElementById("process-file-btn");
    if (processBtn) {
      processBtn.addEventListener("click", generatePrompt);
    }

    // Skip file button
    const skipBtn = document.getElementById("skip-file-btn");
    if (skipBtn) {
      skipBtn.addEventListener("click", skipFile);
    }

    // Save response button
    const saveBtn = document.getElementById("save-response-btn");
    if (saveBtn) {
      saveBtn.addEventListener("click", saveResponse);
    }

    // Mode selection radio buttons
    const modeRadios = document.querySelectorAll('input[name="processing-mode"]');
    modeRadios.forEach((radio) => {
      radio.addEventListener("change", function () {
        currentMode = this.value;
        toggleModeDisplay();
      });
    });
  }

  /**
   * Toggle display based on selected mode
   */
  function toggleModeDisplay() {
    const singleFileDisplay = document.getElementById("single-file-display");
    const multiFileDisplay = document.getElementById("multi-file-display");
    const processBtnText = document.getElementById("process-btn-text");
    const skipBtnText = document.getElementById("skip-btn-text");
    const saveBtnText = document.getElementById("save-btn-text");

    if (currentMode === "single") {
      singleFileDisplay.classList.remove("d-none");
      multiFileDisplay.classList.add("d-none");
      processBtnText.textContent = "Generate Summary Prompt";
      skipBtnText.textContent = "Skip This File";
      saveBtnText.textContent = "Save & Process Next File";

      // Load next file if needed
      if (!currentFile) {
        loadNextFile();
      }
    } else {
      singleFileDisplay.classList.add("d-none");
      multiFileDisplay.classList.remove("d-none");
      processBtnText.textContent = "Generate Multi-File Prompt";
      skipBtnText.textContent = "Skip These Files";
      saveBtnText.textContent = "Save & Load More Files";

      // Load multiple files if needed
      if (multipleFiles.length === 0) {
        loadMultipleFiles();
      }
    }

    // Hide prompt and response sections when switching modes
    document.getElementById("prompt-section").classList.add("d-none");
    document.getElementById("response-section").classList.add("d-none");
  }

  /**
   * Load the next file needing a summary
   */
  function loadNextFile() {
    // Show loading state
    document.getElementById("file-path").textContent = "Loading...";
    document.getElementById("file-tokens").textContent = "0";

    // Get the next file from the API
    fetch("/api/get_next_unsummarized_file")
      .then((response) => {
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
      .then((data) => {
        if (data) {
          // Store the current file data
          currentFile = data;

          // Update UI
          document.getElementById("file-path").textContent = data.file_path;
          document.getElementById("file-tokens").textContent = data.token_count;

          // Show the next file section
          document.getElementById("next-file-section").classList.remove("d-none");
          document.getElementById("no-files-section").classList.add("d-none");

          // Hide the prompt and response sections
          document.getElementById("prompt-section").classList.add("d-none");
          document.getElementById("response-section").classList.add("d-none");
        }
      })
      .catch((error) => {
        console.error("Error loading next file:", error);
        document.getElementById("file-path").textContent = "Error loading file";
      });
  }

  /**
   * Load multiple files needing summaries
   */
  function loadMultipleFiles() {
    // Show loading state in the file list
    const fileList = document.getElementById("file-list");
    fileList.innerHTML = `
      <div class="text-center p-3 text-muted">
        <i class="fas fa-spinner fa-spin me-2"></i> Loading files...
      </div>
    `;

    // Reset counters
    document.getElementById("selected-file-count").textContent = "0";
    document.getElementById("total-tokens").textContent = "0";

    // Get multiple files from the API
    fetch("/api/get_multiple_unsummarized_files?token_limit=4000")
      .then((response) => {
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
      .then((data) => {
        if (data && data.files && data.files.length > 0) {
          // Store the files data
          multipleFiles = data.files;

          // Update UI
          renderFileList(multipleFiles);
          document.getElementById("selected-file-count").textContent = multipleFiles.length;
          document.getElementById("total-tokens").textContent = data.total_tokens;

          // Show the next file section
          document.getElementById("next-file-section").classList.remove("d-none");
          document.getElementById("no-files-section").classList.add("d-none");

          // Hide the prompt and response sections
          document.getElementById("prompt-section").classList.add("d-none");
          document.getElementById("response-section").classList.add("d-none");
        } else {
          // No files found
          fileList.innerHTML = `
            <div class="text-center p-3 text-muted">
              No unsummarized files found.
            </div>
          `;
        }
      })
      .catch((error) => {
        console.error("Error loading multiple files:", error);
        fileList.innerHTML = `
          <div class="text-center p-3 text-danger">
            <i class="fas fa-exclamation-triangle me-2"></i> Error loading files: ${error.message}
          </div>
        `;
      });
  }

  /**
   * Render the file list for multiple files mode
   */
  function renderFileList(files) {
    const fileList = document.getElementById("file-list");

    if (!files || files.length === 0) {
      fileList.innerHTML = `
        <div class="text-center p-3 text-muted">
          No unsummarized files found.
        </div>
      `;
      return;
    }

    // Create file list HTML
    let html = "";
    files.forEach((file, index) => {
      html += `
        <div class="d-flex align-items-center border-bottom p-2">
          <div class="me-3">
            <i class="fas fa-file-code text-primary"></i>
          </div>
          <div class="flex-grow-1">
            <div class="text-break">${file.file_path}</div>
            <small class="text-muted">${file.token_count} tokens</small>
          </div>
        </div>
      `;
    });

    fileList.innerHTML = html;
  }

  /**
   * Generate prompt based on current mode
   */
  function generatePrompt() {
    if (currentMode === "single") {
      generateSingleFilePrompt();
    } else {
      generateMultiFilePrompt();
    }
  }

  /**
   * Generate prompt for the current file
   */
  function generateSingleFilePrompt() {
    // If no current file, return
    if (!currentFile) {
      alert("No file loaded. Please refresh the page.");
      return;
    }

    // Use the pre-generated prompt from the API response
    const promptContent = document.getElementById("prompt-content");

    // Check if we have a pre-generated prompt from the API
    if (currentFile.prompt) {
      // Use the pre-generated prompt that includes repository structure
      promptContent.value = currentFile.prompt;
    } else {
      // Fallback to simple prompt generation (should not happen with updated API)
      promptContent.value = `Please analyze the following ${currentFile.language_type} file and extract key information about its structure and purpose.

File: ${currentFile.file_path}

\`\`\`${currentFile.language_type}
${currentFile.content}
\`\`\`

Extract and parse the file content into the following format:

<FILE>
<PATH>${currentFile.file_path}</PATH>
<SUMMARY>
[Provide a concise 2-4 sentence description of the file's purpose and functionality. Focus on what this file does, what components it defines, and its role in the overall system. Be specific and technical, but clear.]
</SUMMARY>
<TREE>
[List all significant classes, interfaces, functions, methods, and constants defined in this file - one per line. Include only top-level elements and class methods, not local variables or nested utility functions. For each function or method, include a very brief indication of its purpose.]
</TREE>
<DEPENDENCIES>
[ONLY list internal project files that this file imports or depends on - one per line. Do NOT list standard library modules or external packages. If the file has no internal dependencies, leave this section empty or write nothing between the tags]
</DEPENDENCIES>
</FILE>

Important:
1. The SUMMARY should be technical but readable, explaining what this code does and why it exists
2. The TREE should list the key components that make up the file's API surface
3. The DEPENDENCIES section must ONLY list internal project files
4. Maintain the exact XML format with the tags as shown - this will be parsed automatically
5. Don't add any explanation or notes outside the XML structure`;
    }

    // Update the prompt section information
    document.getElementById("prompt-file-count").textContent = "1 file";
    document.getElementById("prompt-token-count").textContent = `${currentFile.token_count} tokens`;

    // Show the prompt section
    document.getElementById("prompt-section").classList.remove("d-none");

    // Auto-select the prompt text for easy copying
    promptContent.select();
  }

  /**
   * Generate prompt for multiple files
   */
  function generateMultiFilePrompt() {
    // If no files loaded, return
    if (!multipleFiles || multipleFiles.length === 0) {
      alert("No files loaded. Please refresh the page.");
      return;
    }

    // Use the API to get the combined prompt
    fetch("/api/get_multiple_unsummarized_files?token_limit=4000")
      .then((response) => {
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json();
      })
      .then((data) => {
        if (data && data.combined_prompt) {
          const promptContent = document.getElementById("prompt-content");
          promptContent.value = data.combined_prompt;

          // Update the prompt section information
          document.getElementById("prompt-file-count").textContent = `${data.file_count} file${data.file_count !== 1 ? "s" : ""}`;
          document.getElementById("prompt-token-count").textContent = `${data.total_tokens} tokens`;

          // Show the prompt section
          document.getElementById("prompt-section").classList.remove("d-none");

          // Auto-select the prompt text for easy copying
          promptContent.select();
        } else {
          alert("Could not generate prompt. No files found.");
        }
      })
      .catch((error) => {
        console.error("Error generating multi-file prompt:", error);
        alert(`Error generating prompt: ${error.message}`);
      });
  }

  /**
   * Skip files based on current mode
   */
  function skipFile() {
    if (currentMode === "single") {
      skipSingleFile();
    } else {
      skipMultipleFiles();
    }
  }

  /**
   * Skip the current file
   */
  function skipSingleFile() {
    // If no current file, return
    if (!currentFile) {
      alert("No file loaded. Please refresh the page.");
      return;
    }

    // Confirm skipping
    if (!confirm(`Are you sure you want to skip ${currentFile.file_path}? This file will be marked as processed but won't have a detailed summary.`)) {
      return;
    }

    // Create form data
    const formData = new FormData();
    formData.append("file_path", currentFile.file_path);

    // Send skip request
    fetch("/api/skip_file", {
      method: "POST",
      body: formData,
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json();
      })
      .then((data) => {
        // Update the remaining count
        updateRemainingCount(data.remaining_count);

        // Show success message
        showStatusMessage("process-status", "File skipped successfully.", "success");

        // Load the next file
        loadNextFile();
      })
      .catch((error) => {
        console.error("Error skipping file:", error);
        showStatusMessage("process-status", `Error skipping file: ${error.message}`, "danger");
      });
  }

  /**
   * Skip multiple files at once
   */
  function skipMultipleFiles() {
    // If no files, return
    if (!multipleFiles || multipleFiles.length === 0) {
      alert("No files loaded. Please refresh the page.");
      return;
    }

    // Confirm skipping
    if (!confirm(`Are you sure you want to skip ${multipleFiles.length} files? They will be marked as processed but won't have detailed summaries.`)) {
      return;
    }

    // Show loading status
    showStatusMessage("process-status", "Skipping files...", "info");

    // Process each file
    let processedCount = 0;
    let errorCount = 0;

    const skipPromises = multipleFiles.map((file) => {
      const formData = new FormData();
      formData.append("file_path", file.file_path);

      return fetch("/api/skip_file", {
        method: "POST",
        body: formData,
      })
        .then((response) => {
          if (!response.ok) {
            errorCount++;
            throw new Error(`HTTP error for ${file.file_path}: ${response.status}`);
          }
          processedCount++;
          return response.json();
        })
        .catch((error) => {
          console.error(`Error skipping file ${file.file_path}:`, error);
          errorCount++;
        });
    });

    // Wait for all skip operations to complete
    Promise.all(skipPromises)
      .then(() => {
        // Get the updated count of unsummarized files
        return fetch("/api/count_unsummarized_files");
      })
      .then((response) => response.json())
      .then((data) => {
        // Update the remaining count
        updateRemainingCount(data.count);

        // Show success message
        showStatusMessage(
          "process-status",
          `Skipped ${processedCount} file(s) successfully. ${errorCount > 0 ? `Failed to skip ${errorCount} file(s).` : ""}`,
          errorCount > 0 ? "warning" : "success"
        );

        // Load new files
        loadMultipleFiles();
      })
      .catch((error) => {
        console.error("Error completing skip operation:", error);
        showStatusMessage("process-status", `Error skipping files: ${error.message}`, "danger");
      });
  }

  /**
   * Save the AI response based on current mode
   */
  function saveResponse() {
    if (currentMode === "single") {
      saveSingleFileResponse();
    } else {
      saveMultiFileResponse();
    }
  }

  /**
   * Save the AI response for a single file
   */
  function saveSingleFileResponse() {
    // If no current file, return
    if (!currentFile) {
      alert("No file loaded. Please refresh the page.");
      return;
    }

    // Get the AI response
    const responseText = document.getElementById("ai-response").value;

    // Check if response is empty
    if (!responseText.trim()) {
      showStatusMessage("process-status", "Please paste the AI's response first.", "danger");
      return;
    }

    // Show loading status
    showStatusMessage("process-status", "Processing response...", "info");

    // Try to parse the response to extract summary data
    try {
      // Extract data from AI response
      const fileMatch = responseText.match(/<FILE>\s*([\s\S]*?)\s*<\/FILE>/);
      if (!fileMatch) {
        showStatusMessage("process-status", "Could not find <FILE> tags in the response. Please check the format.", "danger");
        return;
      }

      const fileContent = fileMatch[1];

      // Extract summary
      const summaryMatch = fileContent.match(/<SUMMARY>\s*([\s\S]*?)\s*<\/SUMMARY>/);
      if (!summaryMatch) {
        showStatusMessage("process-status", "Could not find <SUMMARY> tags in the response.", "danger");
        return;
      }
      const summary = summaryMatch[1].trim();

      // Extract tree
      const treeMatch = fileContent.match(/<TREE>\s*([\s\S]*?)\s*<\/TREE>/);
      if (!treeMatch) {
        showStatusMessage("process-status", "Could not find <TREE> tags in the response.", "danger");
        return;
      }
      let tree = treeMatch[1].trim();
      // Handle "None" in tree - replace with empty string
      if (tree.toLowerCase() === "none") {
        tree = "";
      }

      // Extract dependencies
      const depsMatch = fileContent.match(/<DEPENDENCIES>\s*([\s\S]*?)\s*<\/DEPENDENCIES>/);
      if (!depsMatch) {
        showStatusMessage("process-status", "Could not find <DEPENDENCIES> tags in the response.", "danger");
        return;
      }
      let dependencies = depsMatch[1].trim();
      // Handle "None" in dependencies - replace with empty string
      if (dependencies.toLowerCase() === "none") {
        dependencies = "";
      }

      // Create form data
      const formData = new FormData();
      formData.append("file_path", currentFile.file_path);
      formData.append("summary", summary);
      formData.append("tree", tree);
      formData.append("dependencies", dependencies);

      // Send update request
      fetch("/api/update_file_summary", {
        method: "POST",
        body: formData,
      })
        .then((response) => {
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }
          return response.json();
        })
        .then((data) => {
          // Update the remaining count
          updateRemainingCount(data.remaining_count);

          // Show success message
          showStatusMessage("process-status", "File summary updated successfully!", "success");

          // Clear the response textarea
          document.getElementById("ai-response").value = "";

          // Load the next file
          setTimeout(() => {
            loadNextFile();
          }, 1000);
        })
        .catch((error) => {
          console.error("Error updating file summary:", error);
          showStatusMessage("process-status", `Error updating file summary: ${error.message}`, "danger");
        });
    } catch (error) {
      console.error("Error parsing AI response:", error);
      showStatusMessage("process-status", `Error parsing AI response: ${error.message}`, "danger");
    }
  }

  /**
   * Save the AI response for multiple files
   */
  function saveMultiFileResponse() {
    // If no multiple files, return
    if (!multipleFiles || multipleFiles.length === 0) {
      alert("No files loaded. Please refresh the page.");
      return;
    }

    // Get the AI response
    const responseText = document.getElementById("ai-response").value;

    // Check if response is empty
    if (!responseText.trim()) {
      showStatusMessage("process-status", "Please paste the AI's response first.", "danger");
      return;
    }

    // Show loading status
    showStatusMessage("process-status", "Processing multiple files...", "info");

    // Try to parse the response to extract summaries for all files
    try {
      // Extract all FILE sections from the response
      const fileMatches = responseText.matchAll(/<FILE>\s*([\s\S]*?)\s*<\/FILE>/g);
      const fileData = Array.from(fileMatches).map((match) => match[1]);

      if (fileData.length === 0) {
        showStatusMessage("process-status", "Could not find any <FILE> tags in the response. Please check the format.", "danger");
        return;
      }

      // Process each file section
      const fileSummaries = [];
      for (const content of fileData) {
        // Extract path
        const pathMatch = content.match(/<PATH>\s*(.*?)\s*<\/PATH>/);
        if (!pathMatch) {
          continue; // Skip if no path found
        }
        const filePath = pathMatch[1].trim();

        // Extract summary
        const summaryMatch = content.match(/<SUMMARY>\s*([\s\S]*?)\s*<\/SUMMARY>/);
        if (!summaryMatch) {
          continue; // Skip if no summary found
        }
        const summary = summaryMatch[1].trim();

        // Extract tree
        const treeMatch = content.match(/<TREE>\s*([\s\S]*?)\s*<\/TREE>/);
        let tree = treeMatch ? treeMatch[1].trim() : "";

        // Extract dependencies
        const depsMatch = content.match(/<DEPENDENCIES>\s*([\s\S]*?)\s*<\/DEPENDENCIES>/);
        let dependencies = depsMatch ? depsMatch[1].trim() : "";

        // Add to summaries array
        fileSummaries.push({
          file_path: filePath,
          summary: summary,
          tree: tree,
          dependencies: dependencies,
        });
      }

      // Check if we found any valid file summaries
      if (fileSummaries.length === 0) {
        showStatusMessage("process-status", "Could not extract any valid file summaries from the response.", "danger");
        return;
      }

      // Send update request with all file summaries
      fetch("/api/update_multiple_file_summaries", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(fileSummaries),
      })
        .then((response) => {
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }
          return response.json();
        })
        .then((data) => {
          // Update the remaining count
          updateRemainingCount(data.remaining_count);

          // Show success/warning message
          let statusType = "success";
          let statusMessage = `Updated ${data.success_count} file(s) successfully.`;

          if (data.error_count > 0) {
            statusType = "warning";
            statusMessage += ` Failed to update ${data.error_count} file(s).`;
          }

          showStatusMessage("process-status", statusMessage, statusType);

          // Clear the response textarea
          document.getElementById("ai-response").value = "";

          // Load the next batch of files
          setTimeout(() => {
            loadMultipleFiles();
          }, 1000);
        })
        .catch((error) => {
          console.error("Error updating file summaries:", error);
          showStatusMessage("process-status", `Error updating file summaries: ${error.message}`, "danger");
        });
    } catch (error) {
      console.error("Error parsing AI response:", error);
      showStatusMessage("process-status", `Error parsing AI response: ${error.message}`, "danger");
    }
  }

  /**
   * Update the remaining files count
   */
  function updateRemainingCount(count) {
    // Update the counter on the page
    const countElement = document.getElementById("remaining-files");
    if (countElement) {
      countElement.textContent = count;
    }

    // Update the unfamiliar files button count
    const unfamiliarBtns = document.querySelectorAll(".unfamiliar-files-btn");
    unfamiliarBtns.forEach((btn) => {
      const countElement = btn.querySelector(".unfamiliar-count");
      if (countElement) {
        countElement.textContent = count;
      }

      // Update the title/tooltip
      btn.setAttribute("title", `${count} unfamiliar file${count !== 1 ? "s" : ""}`);

      // Show/hide based on count
      if (count > 0) {
        btn.classList.remove("d-none");
      } else {
        btn.classList.add("d-none");
      }
    });
  }

  /**
   * Show the "no files" state when all files have been processed
   */
  function showNoFilesState() {
    document.getElementById("next-file-section").classList.add("d-none");
    document.getElementById("prompt-section").classList.add("d-none");
    document.getElementById("response-section").classList.add("d-none");
    document.getElementById("no-files-section").classList.remove("d-none");

    // Reset current file data
    currentFile = null;
    multipleFiles = [];

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
      statusElement.classList.remove("d-none", "alert-success", "alert-danger", "alert-info", "alert-warning");
      statusElement.classList.add(`alert-${type}`);
    }
  }

  // Return public methods
  return {
    init: init,
    loadNextFile: loadNextFile,
    loadMultipleFiles: loadMultipleFiles,
    generatePrompt: generatePrompt,
    skipFile: skipFile,
    saveResponse: saveResponse,
  };
})();

// Initialize on page load
document.addEventListener("DOMContentLoaded", function () {
  UnfamiliarHandler.init();
});
