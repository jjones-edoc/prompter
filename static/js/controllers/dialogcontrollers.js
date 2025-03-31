/**
 * DialogControllers.js
 * Contains controller functions for all dialogs
 */
const DialogControllers = (function () {
  /**
   * Setup file selector event listeners with standardized callbacks
   * @param {Object} customCallbacks - Custom callback overrides
   * @returns {Object} Standard callback object with custom overrides
   */
  function createFileSelectorCallbacks(customCallbacks = {}) {
    const state = StateManager.getState();

    // Default callbacks
    const defaultCallbacks = {
      onSubmit: function (fileData) {
        // Update state with file selection data
        StateManager.updateDialogState("fileSelector", {
          selectedFiles: fileData.files,
          selectedFolders: fileData.folders,
          tokenCount: fileData.tokenCount,
        });

        const editingElementIndex = state.fileSelectorState.editingElementIndex;
        const isCreatingNew = state.fileSelectorState.isCreatingNew;

        // Only proceed if files or folders were selected
        if ((fileData.files && fileData.files.length > 0) || (fileData.folders && fileData.folders.length > 0)) {
          // Check if we're editing an existing files element
          if (!isCreatingNew && editingElementIndex !== undefined && editingElementIndex !== null && editingElementIndex >= 0) {
            // Update existing element
            StateManager.updatePromptElement(editingElementIndex, {
              files: fileData.files,
              folders: fileData.folders,
              tokenCount: fileData.tokenCount,
            });
          } else {
            // Add new files element
            StateManager.addPromptElement({
              type: "selectedFiles",
              id: `selectedFiles-${Date.now()}`,
              files: fileData.files,
              folders: fileData.folders,
              tokenCount: fileData.tokenCount,
            });
          }
        }

        // Reset editing state
        StateManager.updateDialogState("fileSelector", {
          editingElementIndex: null,
          isCreatingNew: false,
        });

        // Go back to generate dialog
        StateManager.setCurrentDialog("generate");
        renderCurrentDialog();
      },
      onBack: function () {
        // Reset editing state before returning to generate dialog
        StateManager.updateDialogState("fileSelector", {
          editingElementIndex: null,
          isCreatingNew: false,
        });

        // Go back to generate dialog without saving changes
        StateManager.setCurrentDialog("generate");
        renderCurrentDialog();
      },
      onSelectionChange: function (selectionData) {
        // Update state with latest selection data without changing dialog
        StateManager.updateDialogState("fileSelector", {
          selectedFiles: selectionData.files,
          selectedFolders: selectionData.folders,
          tokenCount: selectionData.tokenCount,
        });
      },
      onSearch: function (query) {
        performSearch(query);
      },
      onClearSearch: function () {
        clearSearch();
      },
      onFolderTokenRequest: function (folderPath, tokenBadgeElement) {
        updateFolderTokenCount(folderPath, tokenBadgeElement);
      },
    };

    // Merge default and custom callbacks
    return { ...defaultCallbacks, ...customCallbacks };
  }

  /**
   * Render the prompt dialog
   */
  function renderPromptDialog() {
    const mainContent = document.getElementById("main-content");
    const state = StateManager.getState();
    mainContent.innerHTML = PromptDialog.render(state.promptDialogState);

    PromptDialog.setupEventListeners({
      onSubmit: function (promptData) {
        const editingElementIndex = state.promptDialogState.editingElementIndex;
        const isCreatingNew = state.promptDialogState.isCreatingNew;

        // Only proceed if the prompt has content
        if (promptData.prompt && promptData.prompt.trim() !== "") {
          // Check if we're editing an existing prompt element
          if (!isCreatingNew && editingElementIndex !== undefined && editingElementIndex !== null && editingElementIndex >= 0) {
            // Update existing element
            StateManager.updatePromptElement(editingElementIndex, {
              content: promptData.prompt,
            });
          } else {
            // Add new user prompt element
            StateManager.addPromptElement({
              type: "userPrompt",
              id: `userPrompt-${Date.now()}`,
              content: promptData.prompt,
            });
          }
        }

        // Reset editing state
        StateManager.updateDialogState("promptDialog", {
          editingElementIndex: null,
          isCreatingNew: false,
        });

        // Go back to generate dialog
        StateManager.setCurrentDialog("generate");
        renderCurrentDialog();
      },

      onCancel: function () {
        // Reset editing state before returning to generate dialog
        StateManager.updateDialogState("promptDialog", {
          editingElementIndex: null,
          isCreatingNew: false,
        });

        // Go back to generate dialog without saving changes
        StateManager.setCurrentDialog("generate");
        renderCurrentDialog();
      },
    });
  }

  /**
   * Render the file selector dialog
   */
  function renderFileSelectorDialog() {
    const state = StateManager.getState();

    // If directory structure not loaded yet, fetch it first
    if (!state.fileSelectorState.directoryStructure) {
      // Show loading state in the UI
      const mainContent = document.getElementById("main-content");
      mainContent.innerHTML = `
      <div class="card shadow-sm mb-4">
        <div class="card-header card-header-themed">
          <h2 class="h4 mb-0">Select Files for Your Prompt</h2>
        </div>
        <div class="card-body">
          <div class="text-center py-4">
            <i class="fas fa-spinner fa-spin me-2"></i> Loading file structure...
          </div>
        </div>
      </div>
    `;

      // Using the correct API method to load the complete directory tree
      ApiService.fetchDirectoryStructure().then((data) => {
        if (data.error) {
          Utilities.showSnackBar(`Error: ${data.error}`, "error");
          return;
        }

        // Save the directory structure to state
        StateManager.updateDialogState("fileSelector", { directoryStructure: data });

        // Now render the file selector with the loaded data
        const mainContent = document.getElementById("main-content");
        mainContent.innerHTML = FileSelector.render(state.fileSelectorState);

        // Set up event listeners for user interaction
        FileSelector.setupEventListeners(createFileSelectorCallbacks());
      });
    } else {
      // Directory structure already loaded
      const mainContent = document.getElementById("main-content");
      mainContent.innerHTML = FileSelector.render(state.fileSelectorState);

      FileSelector.setupEventListeners(createFileSelectorCallbacks());
    }
  }

  /**
   * Perform search in file selector
   * @param {string} query - Search query
   */
  function performSearch(query) {
    // Show loading state
    document.getElementById("search-stats").innerHTML = `<i class="fas fa-spinner fa-spin me-2"></i> Searching for "${query}"...`;
    document.getElementById("search-status").classList.remove("d-none");

    // Show info snackbar
    Utilities.showSnackBar(`Searching for "${query}"...`, "info", 2000);

    ApiService.searchFiles(query).then((data) => {
      const state = StateManager.getState();

      if (data.error) {
        // Store search results in state
        StateManager.updateDialogState("fileSelector", {
          searchResults: {
            error: data.error,
            query: query,
          },
        });
      } else {
        // Store search results in state
        // Adjust property names to match the API response
        StateManager.updateDialogState("fileSelector", {
          searchResults: {
            query: query,
            count: data.count,
            matching_files: data.matching_files,
          },
        });
      }

      // Update UI with search results
      FileSelector.updateSearchResults(StateManager.getState().fileSelectorState.searchResults, state.fileSelectorState.selectedFiles);

      // Rebind checkbox events by re-setting up event listeners
      FileSelector.setupEventListeners(createFileSelectorCallbacks());

      // Update select all button
      FileSelector.updateSelectAllButton();
    });
  }

  /**
   * Clear search in file selector
   */
  function clearSearch() {
    // Clear search input and results
    const searchInput = document.getElementById("search-input");
    if (searchInput) searchInput.value = "";

    // Reset search state
    StateManager.updateDialogState("fileSelector", { searchResults: null });

    // Re-render file selector with full tree
    renderFileSelectorDialog();
  }

  /**
   * Update folder token count
   * @param {string} folderPath - Path of folder
   * @param {HTMLElement} badgeElement - Badge element to update
   */
  function updateFolderTokenCount(folderPath, badgeElement) {
    badgeElement.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';

    ApiService.fetchFolderTokenCount(folderPath).then((data) => {
      if (data.error) {
        console.error("Error fetching token count:", data.error);
        badgeElement.textContent = "0 tokens";
      } else {
        badgeElement.textContent = `${data.token_count} tokens`;
        badgeElement.setAttribute("data-folder-tokens", data.token_count);

        // Recalculate total tokens
        const totalTokens = calculateTotalTokens();
        StateManager.updateDialogState("fileSelector", { tokenCount: totalTokens });
      }
    });
  }

  /**
   * Calculate total tokens based on selection
   * @returns {number} Total token count
   */
  function calculateTotalTokens() {
    // This is a placeholder - in practice, you would use the FileSelector's calculateTotalTokens method
    return FileSelector.calculateTotalTokens();
  }

  /**
   * Render the generate dialog
   */
  function renderGenerateDialog() {
    const state = StateManager.getState();
    const mainContent = document.getElementById("main-content");

    // Render the dialog with current state
    mainContent.innerHTML = GenerateDialog.render(state.generateDialogState);

    // Set up event listeners with callbacks
    GenerateDialog.setupEventListeners({
      // Add a new element to the prompt
      onAddElement: function (element) {
        StateManager.addPromptElement(element);

        // If it's a user prompt element, go to prompt dialog to edit it
        if (element.type === "userPrompt") {
          StateManager.setCurrentDialog("prompt");
          renderCurrentDialog();
        }
        // If it's a file selection element, go to file selector dialog
        else if (element.type === "selectedFiles") {
          StateManager.setCurrentDialog("fileSelector");
          renderCurrentDialog();
        } else {
          // For other element types, just re-render
          renderGenerateDialog();
        }
      },

      // Remove element from prompt
      onRemoveElement: function (index) {
        StateManager.removePromptElement(index);
        renderGenerateDialog();
      },

      // Edit an existing element
      onEditElement: function (index) {
        const elements = state.generateDialogState.promptElements;
        if (index >= 0 && index < elements.length) {
          const element = elements[index];

          // Handle each element type differently
          if (element.type === "userPrompt") {
            // Go to prompt dialog to edit user prompt
            StateManager.updateDialogState("promptDialog", {
              userPrompt: element.content || "",
              editingElementIndex: index,
            });
            StateManager.setCurrentDialog("prompt");
            renderCurrentDialog();
          } else if (element.type === "selectedFiles") {
            // Go to file selector dialog to edit selected files
            // First update file selector state with current selections
            StateManager.updateDialogState("fileSelector", {
              selectedFiles: element.files || [],
              selectedFolders: element.folders || [],
              editingElementIndex: index,
            });
            StateManager.setCurrentDialog("fileSelector");
            renderCurrentDialog();
          } else {
            // Other element types don't need editing for now
            Utilities.showSnackBar(`No editor available for ${element.type} elements`, "info");
          }
        }
      },

      // Move element position
      onMoveElement: function (oldIndex, newIndex) {
        StateManager.reorderPromptElements(oldIndex, newIndex);
        renderGenerateDialog();
      },

      // Generate the final prompt
      onGeneratePrompt: function (callback) {
        generatePromptContent(callback);
      },

      // Go to prompt dialog to edit user prompt
      onEditPrompt: function (isCreatingNew = false) {
        // Find if there's an existing user prompt element
        const elements = state.generateDialogState.promptElements;
        let userPromptIndex = elements.findIndex((el) => el.type === "userPrompt");

        if (userPromptIndex >= 0 && !isCreatingNew) {
          // Edit existing prompt element
          StateManager.updateDialogState("promptDialog", {
            userPrompt: elements[userPromptIndex].content || "",
            editingElementIndex: userPromptIndex,
            isCreatingNew: false,
          });
        } else {
          // Creating a new prompt element
          StateManager.updateDialogState("promptDialog", {
            userPrompt: "",
            editingElementIndex: -1,
            isCreatingNew: true,
          });
        }

        StateManager.setCurrentDialog("prompt");
        renderCurrentDialog();
      },

      // Go to file selector
      onSelectFiles: function (isCreatingNew = false) {
        // Find if there's an existing files element
        const elements = state.generateDialogState.promptElements;
        let filesElementIndex = elements.findIndex((el) => el.type === "selectedFiles");

        if (filesElementIndex >= 0 && !isCreatingNew) {
          // Edit existing files element
          StateManager.updateDialogState("fileSelector", {
            selectedFiles: elements[filesElementIndex].files || [],
            selectedFolders: elements[filesElementIndex].folders || [],
            editingElementIndex: filesElementIndex,
            isCreatingNew: false,
          });
        } else {
          // Create new files element
          StateManager.updateDialogState("fileSelector", {
            selectedFiles: [],
            selectedFolders: [],
            editingElementIndex: -1,
            isCreatingNew: true,
          });
        }

        StateManager.setCurrentDialog("fileSelector");
        renderCurrentDialog();
      },

      // Go to response dialog
      onGoToResponse: function () {
        StateManager.setCurrentDialog("response");
        renderCurrentDialog();
      },

      // Copy prompt to clipboard
      onCopy: function () {
        // After copying, navigate to the response dialog
        StateManager.setCurrentDialog("response");
        renderCurrentDialog();
      },

      // Send the prompt to AI model
      onSendToAI: function (promptContent) {
        // Show loading snackbar
        Utilities.showSnackBar("Sending prompt to AI model...", "info");

        // Update response dialog state to prepare for streaming
        StateManager.updateDialogState("responseDialog", {
          claudeResponse: "",
          processingResults: null, // Reset any previous processing results
          isStreaming: true, // Add streaming flag
        });

        // Go to response dialog immediately
        StateManager.setCurrentDialog("response");
        renderCurrentDialog();

        // Then start the streaming process
        const streamController = ApiService.streamPromptToAI(
          promptContent,
          "anthropic", // Default provider
          "medium", // Default reasoning effort
          // On chunk callback
          (chunk) => {
            // Get current response text
            const state = StateManager.getState();
            const currentText = state.responseDialogState.claudeResponse || "";
            
            // Update response dialog state with new chunk
            StateManager.updateDialogState("responseDialog", {
              claudeResponse: currentText + chunk,
            });
            
            // Update textarea if it exists (in case user is already on response page)
            const textArea = document.getElementById("claude-response");
            if (textArea) {
              textArea.value = currentText + chunk;
              // Scroll to bottom to follow the new content
              textArea.scrollTop = textArea.scrollHeight;
            }
          },
          // On complete callback
          () => {
            // Update the streaming flag
            StateManager.updateDialogState("responseDialog", {
              isStreaming: false,
            });
            
            // Show success message
            Utilities.showSnackBar("AI response received successfully!", "success");
            
            // Re-render to update UI elements that depend on streaming state
            renderResponseDialog();
          },
          // On error callback
          (error) => {
            // Update streaming flag
            StateManager.updateDialogState("responseDialog", {
              isStreaming: false,
            });
            
            // Show error message
            Utilities.showSnackBar("Error streaming AI response: " + error, "error");
            
            // Re-render to update UI elements
            renderResponseDialog();
          }
        );
        
        // Store stream controller in state so it can be canceled if needed
        StateManager.updateDialogState("responseDialog", {
          streamController: streamController,
        });
      },
    });

    // If we have generated content, populate the textarea
    if (state.generateDialogState.generatedContent) {
      const promptContent = document.getElementById("prompt-content");
      if (promptContent) {
        promptContent.value = state.generateDialogState.generatedContent;
      }
    }
  }

  /**
   * Generate prompt content based on the current elements
   * @param {Function} callback - Optional callback to run after generation completes
   */
  function generatePromptContent(callback) {
    const state = StateManager.getState();
    const elements = state.generateDialogState.promptElements;

    if (!elements || elements.length === 0) {
      Utilities.showSnackBar("Please add at least one element to generate a prompt", "warning");
      return;
    }

    // Show loading snackbar
    Utilities.showSnackBar("Generating prompt...", "info");

    // Determine what to include in API call based on elements
    let userPrompt = "";
    let selectedFiles = [];
    let selectedFolders = [];
    let includePlanningPrompt = false;
    let includeCodeEditingPrompt = false;
    let includeDirectoryStructure = false;

    elements.forEach((element) => {
      switch (element.type) {
        case "userPrompt":
          userPrompt = element.content || "";
          break;
        case "selectedFiles":
          selectedFiles = element.files || [];
          selectedFolders = element.folders || [];
          break;
        case "codingPrompt":
          includeCodeEditingPrompt = true;
          break;
        case "planningPrompt":
          includePlanningPrompt = true;
          break;
        case "directoryStructure":
          includeDirectoryStructure = true;
          break;
      }
    });

    const options = {
      selectedFiles: selectedFiles,
      selectedFolders: selectedFolders,
      userPrompt: userPrompt,
      includePlanningPrompt: includePlanningPrompt,
      includeEditingPrompt: includeCodeEditingPrompt, // Renamed variable but keeping API parameter name the same
      includeDirectoryStructure: includeDirectoryStructure,
    };

    // Function to handle API response
    const handleGeneratedContent = (data) => {
      if (data.error) {
        Utilities.showSnackBar("Error generating prompt: " + data.error, "error");
        return;
      }

      // Update state with generated content
      StateManager.updateDialogState("generate", {
        generatedContent: data.combined_content,
      });

      // Update textarea
      const promptContent = document.getElementById("prompt-content");
      if (promptContent) {
        promptContent.value = data.combined_content;
      }

      // Do NOT automatically show the prompt section or change button text
      // Let the toggle button continue to control visibility

      // Show success snackbar
      Utilities.showSnackBar("Prompt generated successfully!", "success");

      // Execute callback if provided
      if (typeof callback === "function") {
        callback();
      }
    };

    // Call API to generate content
    ApiService.generateModularContent(options).then(handleGeneratedContent);
  }

  /**
   * Render the response dialog
   */
  function renderResponseDialog() {
    const mainContent = document.getElementById("main-content");
    const state = StateManager.getState();
    console.log("Rendering response dialog, state:", state.responseDialogState);
    mainContent.innerHTML = ResponseDialog.render(state.responseDialogState);

    ResponseDialog.setupEventListeners({
      onProcess: function (data) {
        // Process Claude's response
        if (data && data.claudeResponse) {
          StateManager.updateDialogState("response", {
            claudeResponse: data.claudeResponse,
          });

          processClaudeResponse(data.claudeResponse);
        }
      },
      onDone: function () {
        // Go back to generate dialog
        StateManager.setCurrentDialog("generate");
        renderCurrentDialog();
      },
    });
  }

  /**
   * Process Claude's response
   * @param {string} response - Claude's response text
   */
  function processClaudeResponse(response) {
    // Show processing status
    const processResults = document.getElementById("process-results");
    if (processResults) {
      processResults.innerHTML = `
        <div class="alert alert-info">
          <i class="fas fa-spinner fa-spin me-2"></i> Processing response...
        </div>
      `;
    }

    // Show info snackbar
    Utilities.showSnackBar("Processing Claude's response...", "info");

    ApiService.processClaudeResponse(response)
      .then((data) => {
        // Update state with processing results
        StateManager.updateDialogState("responseDialog", { processingResults: data });

        // Show success or error message
        if (data.success) {
          Utilities.showSnackBar(`Successfully processed ${data.success_count} edit(s)`, "success");
        } else if (data.error) {
          Utilities.showSnackBar(`Error: ${data.error}`, "error");
        } else if (data.error_count > 0) {
          Utilities.showSnackBar(`Completed with ${data.error_count} error(s)`, "warning");
        }

        // Re-render the response dialog to reflect updated state
        renderResponseDialog();
      })
      .catch((error) => {
        console.error("Error processing response:", error);

        // Show error in the UI
        if (processResults) {
          processResults.innerHTML = `
          <div class="alert alert-danger">
            <strong>Error:</strong> Failed to process response. See console for details.
          </div>
        `;
        }

        Utilities.showSnackBar("Failed to process response", "error");
      });
  }

  // Public API
  return {
    renderPromptDialog,
    renderFileSelectorDialog,
    renderGenerateDialog,
    renderResponseDialog,
    performSearch,
    clearSearch,
    updateFolderTokenCount,
    processClaudeResponse,
    generatePromptContent,
  };
})();
