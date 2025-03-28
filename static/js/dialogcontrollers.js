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
    // Default callbacks
    const defaultCallbacks = {
      onSubmit: function (fileData) {
        // Update state with file selection data
        StateManager.updateDialogState("fileSelector", {
          selectedFiles: fileData.files,
          selectedFolders: fileData.folders,
          tokenCount: fileData.tokenCount,
        });

        // Transition to generate dialog
        StateManager.setCurrentDialog("generate");
        renderCurrentDialog();
      },
      onBack: function () {
        // Go back to prompt dialog
        StateManager.setCurrentDialog("prompt");
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
        console.log("Prompt data submitted:", promptData);
        // Update state with prompt data
        StateManager.updateDialogState("promptDialog", {
          userPrompt: promptData.prompt,
          includeCodingPrompt: promptData.includeCodingPrompt,
          includeDirectoryStructure: promptData.includeDirectoryStructure,
        });

        // Transition to file selector
        StateManager.setCurrentDialog("fileSelector");
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
      ApiService.fetchDirectoryStructure().then((data) => {
        StateManager.updateDialogState("fileSelector", { directoryStructure: data });

        const mainContent = document.getElementById("main-content");
        mainContent.innerHTML = FileSelector.render(state.fileSelectorState);

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

    // If generated content not created yet, generate it first
    if (!state.generateDialogState.generatedContent) {
      const options = {
        selectedFiles: state.fileSelectorState.selectedFiles,
        selectedFolders: state.fileSelectorState.selectedFolders,
        userPrompt: state.promptDialogState.userPrompt,
        includeCodingPrompt: state.promptDialogState.includeCodingPrompt,
        includeDirectoryStructure: state.promptDialogState.includeDirectoryStructure,
      };

      ApiService.generateCombinedContent(options).then((data) => {
        StateManager.updateDialogState("generate", {
          generatedContent: data.combined_content,
        });

        const mainContent = document.getElementById("main-content");
        mainContent.innerHTML = GenerateDialog.render(state.generateDialogState);

        document.getElementById("prompt-content").value = data.combined_content;

        GenerateDialog.setupEventListeners({
          onBack: function () {
            // Go back to file selection
            StateManager.setCurrentDialog("fileSelector");
            renderCurrentDialog();
          },
          onRestart: function () {
            // Clear state and go back to prompt dialog
            StateManager.resetState();
            StateManager.setCurrentDialog("prompt");
            renderCurrentDialog();
          },
          onCopy: function () {
            // After copying, navigate to the response dialog
            StateManager.setCurrentDialog("response");
            renderCurrentDialog();
          },
        });
      });
    } else {
      // Generated content already exists
      const mainContent = document.getElementById("main-content");
      mainContent.innerHTML = GenerateDialog.render(state.generateDialogState);

      document.getElementById("prompt-content").value = state.generateDialogState.generatedContent;

      GenerateDialog.setupEventListeners({
        onBack: function () {
          // Go back to file selection
          StateManager.setCurrentDialog("fileSelector");
          renderCurrentDialog();
        },
        onRestart: function () {
          // Clear state and go back to prompt dialog
          StateManager.resetState();
          StateManager.setCurrentDialog("prompt");
          renderCurrentDialog();
        },
        onCopy: function () {
          // After copying, navigate to the response dialog
          StateManager.setCurrentDialog("response");
          renderCurrentDialog();
        },
      });
    }
  }

  /**
   * Render the response dialog
   */
  function renderResponseDialog() {
    const mainContent = document.getElementById("main-content");
    const state = StateManager.getState();
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
    ApiService.processClaudeResponse(response).then((data) => {
      // Update state with processing results
      StateManager.updateDialogState("response", { processingResults: data });

      // Re-render the response dialog to reflect updated state
      renderResponseDialog();
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
  };
})();
