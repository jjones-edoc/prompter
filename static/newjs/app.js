/**
 * Main application controller for the Prompter Modern UI
 * Handles state management and dialog navigation
 */

const App = (function () {
  // Application state
  let state = {
    userPrompt: "",
    includeCodingPrompt: false,
    includeDirectoryStructure: false,
    selectedFiles: [],
    selectedFolders: [],
    tokenCount: 0,
  };

  /**
   * Initialize the application
   */
  function init() {
    // Start with the prompt dialog
    showPromptDialog();

    // Check for unsummarized files count
    fetchUnsummarizedFilesCount();
  }

  /**
   * Show the prompt input dialog
   */
  function showPromptDialog() {
    const mainContent = document.getElementById("main-content");
    mainContent.innerHTML = PromptDialog.render(state);
    PromptDialog.setupEventListeners(handlePromptSubmit);
  }

  /**
   * Show the file selector dialog
   */
  function showFileSelector() {
    const mainContent = document.getElementById("main-content");
    mainContent.innerHTML = '<div class="text-center py-4"><i class="fas fa-spinner fa-spin me-2"></i> Loading files...</div>';

    // Fetch data needed for file selector
    fetchDirectoryStructure().then(() => {
      mainContent.innerHTML = FileSelector.render(state);
      FileSelector.setupEventListeners(handleFileSelection);
    });
  }

  /**
   * Show the generate dialog
   */
  function showGenerateDialog() {
    const mainContent = document.getElementById("main-content");
    mainContent.innerHTML = '<div class="text-center py-4"><i class="fas fa-spinner fa-spin me-2"></i> Generating prompt...</div>';

    console.log("Starting content generation process");

    // Generate the combined content
    generateCombinedContent().then((combinedContent) => {
      console.log("Content generation completed:", {
        contentReceived: !!combinedContent,
        contentLength: combinedContent ? combinedContent.length : 0,
      });

      state.combinedContent = combinedContent;

      console.log("Updated state with combined content");

      mainContent.innerHTML = GenerateDialog.render(state);
      document.getElementById("prompt-content").value = combinedContent;
      GenerateDialog.setupEventListeners(handleGenerateActions);

      // Verify the content was properly set in the textarea
      const promptTextarea = document.getElementById("prompt-content");
      if (promptTextarea) {
        console.log("Textarea content check:", {
          textareaExists: true,
          valueLength: promptTextarea.value ? promptTextarea.value.length : 0,
          isEmpty: !promptTextarea.value || promptTextarea.value.trim() === "",
          isHidden: promptTextarea.classList.contains("d-none"),
        });
      } else {
        console.log("Textarea element not found after rendering");
      }
    });
  }

  /**
   * Fetch directory structure from the server
   */
  function fetchDirectoryStructure() {
    return Utilities.fetchJSON(
      "/api/get_complete_folder_tree",
      {
        method: "POST",
        body: new FormData(), // Empty form data for root path
      },
      (data) => {
        state.directoryStructure = data;
        return data;
      },
      (error) => {
        console.error("Error fetching directory structure:", error);
        Utilities.showError("Failed to load directory structure. Please try again.");
      }
    );
  }

  /**
   * Generate the combined content for the prompt
   */
  function generateCombinedContent() {
    const formData = new FormData();

    console.log("Generating combined content with:", {
      selectedFiles: state.selectedFiles,
      selectedFolders: state.selectedFolders,
      promptLength: state.userPrompt.length,
    });

    // Add selected files
    state.selectedFiles.forEach((file) => {
      formData.append("selected_files", file);
    });

    // Add selected folders
    state.selectedFolders.forEach((folder) => {
      formData.append("selected_folder", folder);
    });

    // Add prompt options
    formData.append("user_prompt", state.userPrompt);
    formData.append("include_coding_prompt", state.includeCodingPrompt ? "1" : "0");
    formData.append("include_directory_structure", state.includeDirectoryStructure ? "1" : "0");

    return Utilities.fetchJSON(
      "/api/generate",
      {
        method: "POST",
        body: formData,
      },
      (data) => {
        console.log("Data received:", {
          hasError: !!data.error,
          contentLength: data.combined_content ? data.combined_content.length : 0,
          contentPreview: data.combined_content ? data.combined_content.substring(0, 100) + "..." : "No content",
        });

        if (data.error) {
          throw new Error(data.error);
        }
        return data.combined_content;
      },
      (error) => {
        console.error("Error generating content:", error);
        Utilities.showError("Failed to generate content. Please try again.");
        return "";
      }
    );
  }

  /**
   * Fetch count of unsummarized files
   */
  function fetchUnsummarizedFilesCount() {
    Utilities.fetchJSON(
      "/api/count_unsummarized_files",
      {},
      (data) => {
        const count = data.count || 0;
        updateUnsummarizedCount(count);
      },
      (error) => {
        console.error("Error fetching unsummarized files count:", error);
      }
    );
  }

  /**
   * Update the UI with unsummarized files count
   */
  function updateUnsummarizedCount(count) {
    const unfamiliarBtns = document.querySelectorAll(".unfamiliar-files-btn");

    unfamiliarBtns.forEach((btn) => {
      const countElement = btn.querySelector(".unfamiliar-count");
      if (countElement) {
        countElement.textContent = count;
      }

      if (count > 0) {
        btn.classList.remove("d-none");
        btn.setAttribute("title", `${count} unfamiliar file${count !== 1 ? "s" : ""}`);
      } else {
        btn.classList.add("d-none");
      }
    });
  }

  /**
   * Handle prompt form submission
   * @param {Object} promptData - Data from the prompt form
   */
  function handlePromptSubmit(promptData) {
    // Update state with prompt data
    state.userPrompt = promptData.prompt;
    state.includeCodingPrompt = promptData.includeCodingPrompt;
    state.includeDirectoryStructure = promptData.includeDirectoryStructure;

    // Store in session via API
    const formData = new FormData();
    formData.append("prompt", promptData.prompt);
    if (promptData.includeCodingPrompt) {
      formData.append("include_coding_prompt", "on");
    }
    if (promptData.includeDirectoryStructure) {
      formData.append("include_directory_structure", "on");
    }

    Utilities.fetchJSON(
      "/selection_method",
      {
        method: "POST",
        body: formData,
      },
      () => {
        // Move to file selection
        showFileSelector();
      },
      (error) => {
        console.error("Error storing prompt data:", error);
        Utilities.showError("Failed to save prompt. Please try again.");
      }
    );
  }

  /**
   * Handle file selection submission
   * @param {Object} fileData - Selected files and folders
   */
  function handleFileSelection(fileData) {
    // Update state with selected files and folders
    state.selectedFiles = fileData.files;
    state.selectedFolders = fileData.folders;
    state.tokenCount = fileData.tokenCount;

    // Move to generate dialog
    showGenerateDialog();
  }

  /**
   * Handle actions from the generate dialog
   * @param {string} action - The action to perform
   * @param {Object} data - Additional data for the action
   */
  function handleGenerateActions(action, data) {
    switch (action) {
      case "copy":
        // Copy to clipboard functionality is handled in the GenerateDialog module
        break;

      case "process":
        // Logic for processing Claude's response
        if (data && data.claudeResponse) {
          processClaudeResponse(data.claudeResponse);
        }
        break;

      case "back":
        // Go back to file selection
        showFileSelector();
        break;

      case "restart":
        // Clear state and go back to prompt dialog
        resetState();
        showPromptDialog();
        break;
    }
  }

  /**
   * Process Claude's response
   * @param {string} response - Claude's response text
   */
  function processClaudeResponse(response) {
    // Show processing state
    const resultsContainer = document.getElementById("process-results");
    if (resultsContainer) {
      resultsContainer.innerHTML = `
            <div class="alert alert-info">
              <i class="fas fa-spinner fa-spin me-2"></i> Processing response...
            </div>
          `;
    }

    // Send to backend for processing
    Utilities.fetchJSON(
      "/api/process_claude_response",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          claude_response: response,
        }),
      },
      (data) => {
        // Update UI with results
        GenerateDialog.updateProcessingResults(data);
      },
      (error) => {
        console.error("Error processing response:", error);
        GenerateDialog.showError("Error processing response: " + error.message);
      }
    );
  }

  /**
   * Reset application state
   */
  function resetState() {
    state = {
      userPrompt: "",
      includeCodingPrompt: false,
      includeDirectoryStructure: false,
      selectedFiles: [],
      selectedFolders: [],
      tokenCount: 0,
    };
  }

  // Public API
  return {
    init: init,
    showPromptDialog: showPromptDialog,
    showFileSelector: showFileSelector,
    showGenerateDialog: showGenerateDialog,
  };
})();
