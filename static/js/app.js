const App = (function () {
  // Centralized application state
  let state = {
    // Prompt dialog state
    promptDialogState: {
      userPrompt: "",
      includeCodingPrompt: false,
      includeDirectoryStructure: false,
    },

    // File selector state
    fileSelectorState: {
      directoryStructure: null,
      selectedFiles: [],
      selectedFolders: [],
      tokenCount: 0,
      searchResults: null, // Add this property
    },

    // Generate dialog state
    generateDialogState: {
      generatedContent: "",
    },

    // Response dialog state
    responseDialogState: {
      claudeResponse: "",
      processingResults: null,
    },

    // Current active dialog
    currentDialog: "prompt", // "prompt", "fileSelector", "generate", "response"
  };

  function init() {
    renderCurrentDialog();
  }

  // Central function to render the current dialog
  function renderCurrentDialog() {
    const mainContent = document.getElementById("main-content");

    // Show loading state during transitions
    mainContent.innerHTML = '<div class="text-center py-4"><i class="fas fa-spinner fa-spin me-2"></i> Loading...</div>';

    switch (state.currentDialog) {
      case "prompt":
        renderPromptDialog();
        break;
      case "fileSelector":
        renderFileSelectorDialog();
        break;
      case "generate":
        renderGenerateDialog();
        break;
      case "response":
        renderResponseDialog();
        break;
    }
  }

  // Individual dialog rendering functions with appropriate callbacks
  function renderPromptDialog() {
    const mainContent = document.getElementById("main-content");
    mainContent.innerHTML = PromptDialog.render(state.promptDialogState);

    PromptDialog.setupEventListeners({
      onSubmit: function (promptData) {
        // Update state with prompt data
        state.promptDialogState.userPrompt = promptData.prompt;
        state.promptDialogState.includeCodingPrompt = promptData.includeCodingPrompt;
        state.promptDialogState.includeDirectoryStructure = promptData.includeDirectoryStructure;

        // Transition to file selector
        state.currentDialog = "fileSelector";
        renderCurrentDialog();
      },
    });
  }

  function renderFileSelectorDialog() {
    // If directory structure not loaded yet, fetch it first
    if (!state.fileSelectorState.directoryStructure) {
      fetchDirectoryStructure().then(() => {
        const mainContent = document.getElementById("main-content");
        mainContent.innerHTML = FileSelector.render(state.fileSelectorState);

        FileSelector.setupEventListeners({
          onSubmit: function (fileData) {
            // Update state with file selection data
            state.fileSelectorState.selectedFiles = fileData.files;
            state.fileSelectorState.selectedFolders = fileData.folders;
            state.fileSelectorState.tokenCount = fileData.tokenCount;

            // Transition to generate dialog
            state.currentDialog = "generate";
            renderCurrentDialog();
          },
          onBack: function () {
            // Go back to prompt dialog
            state.currentDialog = "prompt";
            renderCurrentDialog();
          },
          onSelectionChange: function (selectionData) {
            // Update state with latest selection data without changing dialog
            state.fileSelectorState.selectedFiles = selectionData.files;
            state.fileSelectorState.selectedFolders = selectionData.folders;
            state.fileSelectorState.tokenCount = selectionData.tokenCount;
          },
          onSearch: function (query) {
            performSearch(query);
          },
          onClearSearch: function () {
            clearSearch();
          },
          onFolderTokenRequest: function (folderPath, tokenBadgeElement) {
            fetchFolderTokenCount(folderPath, tokenBadgeElement);
          },
        });
      });
    } else {
      // Directory structure already loaded
      const mainContent = document.getElementById("main-content");
      mainContent.innerHTML = FileSelector.render(state.fileSelectorState);

      FileSelector.setupEventListeners({
        onSubmit: function (fileData) {
          // Update state with file selection data
          state.fileSelectorState.selectedFiles = fileData.files;
          state.fileSelectorState.selectedFolders = fileData.folders;
          state.fileSelectorState.tokenCount = fileData.tokenCount;

          // Transition to generate dialog
          state.currentDialog = "generate";
          renderCurrentDialog();
        },
        onBack: function () {
          // Go back to prompt dialog
          state.currentDialog = "prompt";
          renderCurrentDialog();
        },
        onSelectionChange: function (selectionData) {
          // Update state with latest selection data without changing dialog
          state.fileSelectorState.selectedFiles = selectionData.files;
          state.fileSelectorState.selectedFolders = selectionData.folders;
          state.fileSelectorState.tokenCount = selectionData.tokenCount;
        },
        onSearch: function (query) {
          performSearch(query);
        },
        onClearSearch: function () {
          clearSearch();
        },
        onFolderTokenRequest: function (folderPath, tokenBadgeElement) {
          fetchFolderTokenCount(folderPath, tokenBadgeElement);
        },
      });
    }
  }

  function performSearch(query) {
    // Show loading state
    document.getElementById("search-stats").innerHTML = `<i class="fas fa-spinner fa-spin me-2"></i> Searching for "${query}"...`;
    document.getElementById("search-status").classList.remove("d-none");

    // Create form data and fetch
    const formData = new FormData();
    formData.append("search_query", query);

    Utilities.fetchJSON(
      "/api/search_files",
      { method: "POST", body: formData },
      (data) => {
        if (data.error) {
          // Store search results in state
          state.fileSelectorState.searchResults = {
            error: data.error,
            query: query,
          };
        } else {
          // Store search results in state
          state.fileSelectorState.searchResults = {
            query: query,
            count: data.count,
            matching_files: data.matching_files,
          };
        }

        // Update UI with search results
        FileSelector.updateSearchResults(state.fileSelectorState.searchResults, state.fileSelectorState.selectedFiles);

        // Rebind checkbox events by re-setting up event listeners
        FileSelector.setupEventListeners({
          onSubmit: function (fileData) {
            // Update state with file selection data
            state.fileSelectorState.selectedFiles = fileData.files;
            state.fileSelectorState.selectedFolders = fileData.folders;
            state.fileSelectorState.tokenCount = fileData.tokenCount;

            // Transition to generate dialog
            state.currentDialog = "generate";
            renderCurrentDialog();
          },
          onBack: function () {
            // Go back to prompt dialog
            state.currentDialog = "prompt";
            renderCurrentDialog();
          },
          onSelectionChange: function (selectionData) {
            // Update state with latest selection data without changing dialog
            state.fileSelectorState.selectedFiles = selectionData.files;
            state.fileSelectorState.selectedFolders = selectionData.folders;
            state.fileSelectorState.tokenCount = selectionData.tokenCount;
          },
          onSearch: function (query) {
            performSearch(query);
          },
          onClearSearch: function () {
            clearSearch();
          },
          onFolderTokenRequest: function (folderPath, tokenBadgeElement) {
            fetchFolderTokenCount(folderPath, tokenBadgeElement);
          },
        });

        // Update select all button
        FileSelector.updateSelectAllButton();
      },
      (error) => {
        console.error("Error searching files:", error);
        state.fileSelectorState.searchResults = {
          error: error.message || "Unknown error occurred",
          query: query,
        };
        FileSelector.updateSearchResults(state.fileSelectorState.searchResults, state.fileSelectorState.selectedFiles);
      }
    );
  }

  function clearSearch() {
    // Clear search input and results
    const searchInput = document.getElementById("search-input");
    if (searchInput) searchInput.value = "";

    // Reset search state
    state.fileSelectorState.searchResults = null;

    // Re-render file selector with full tree
    renderFileSelectorDialog();
  }

  function fetchFolderTokenCount(folderPath, badgeElement) {
    badgeElement.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';

    const formData = new FormData();
    formData.append("folder_path", folderPath);

    Utilities.fetchJSON(
      "/api/get_folder_token_count",
      { method: "POST", body: formData },
      (data) => {
        if (data.error) {
          console.error("Error fetching token count:", data.error);
          badgeElement.textContent = "0 tokens";
        } else {
          badgeElement.textContent = `${data.token_count} tokens`;
          badgeElement.setAttribute("data-folder-tokens", data.token_count);

          // Update token count in UI
          const totalTokens = FileSelector.calculateTotalTokens();
          state.fileSelectorState.tokenCount = totalTokens;
        }
      },
      (error) => {
        console.error("Error fetching folder token count:", error);
        badgeElement.textContent = "0 tokens";
      }
    );
  }

  function renderGenerateDialog() {
    // If generated content not created yet, generate it first
    if (!state.generateDialogState.generatedContent) {
      generateCombinedContent().then((combinedContent) => {
        state.generateDialogState.generatedContent = combinedContent.combined_content;

        const mainContent = document.getElementById("main-content");
        mainContent.innerHTML = GenerateDialog.render(state.generateDialogState);

        document.getElementById("prompt-content").value = state.generateDialogState.generatedContent;

        GenerateDialog.setupEventListeners({
          onBack: function () {
            // Go back to file selection
            state.currentDialog = "fileSelector";
            renderCurrentDialog();
          },
          onRestart: function () {
            // Clear state and go back to prompt dialog
            resetState();
            state.currentDialog = "prompt";
            renderCurrentDialog();
          },
          onCopy: function () {
            // After copying, navigate to the response dialog
            state.currentDialog = "response";
            renderCurrentDialog();
          },
        });
      });
    } else {
      // Generated content already exists
      const mainContent = document.getElementById("main-content");
      mainContent.innerHTML = GenerateDialog.render(state.generateDialogState);

      GenerateDialog.setupEventListeners({
        onBack: function () {
          // Go back to file selection
          state.currentDialog = "fileSelector";
          renderCurrentDialog();
        },
        onRestart: function () {
          // Clear state and go back to prompt dialog
          resetState();
          state.currentDialog = "prompt";
          renderCurrentDialog();
        },
        onCopy: function () {
          // After copying, navigate to the response dialog
          state.currentDialog = "response";
          renderCurrentDialog();
        },
      });
    }
  }

  function renderResponseDialog() {
    const mainContent = document.getElementById("main-content");
    mainContent.innerHTML = ResponseDialog.render(state.responseDialogState);

    ResponseDialog.setupEventListeners({
      onProcess: function (data) {
        // Process Claude's response
        if (data && data.claudeResponse) {
          state.responseDialogState.claudeResponse = data.claudeResponse;
          processClaudeResponse(data.claudeResponse);
        }
      },
      onDone: function () {
        // Go back to generate dialog
        state.currentDialog = "generate";
        renderCurrentDialog();
      },
    });
  }

  // Utility functions remain mostly the same but update state instead of relying on external modules

  function fetchDirectoryStructure() {
    return Utilities.fetchJSON(
      "/api/get_complete_folder_tree",
      {
        method: "POST",
        body: new FormData(),
      },
      (data) => {
        state.fileSelectorState.directoryStructure = data;
        return data;
      },
      (error) => {
        console.error("Error fetching directory structure:", error);
        Utilities.showError("Failed to load directory structure. Please try again.");
      }
    );
  }

  function generateCombinedContent() {
    const formData = new FormData();

    // Add selected files
    state.fileSelectorState.selectedFiles.forEach((file) => {
      formData.append("selected_files", file);
    });

    // Add selected folders
    state.fileSelectorState.selectedFolders.forEach((folder) => {
      formData.append("selected_folder", folder);
    });

    // Add prompt options
    formData.append("user_prompt", state.promptDialogState.userPrompt);
    formData.append("include_coding_prompt", state.promptDialogState.includeCodingPrompt ? "1" : "0");
    formData.append("include_directory_structure", state.promptDialogState.includeDirectoryStructure ? "1" : "0");

    return Utilities.fetchJSON(
      "/api/generate",
      {
        method: "POST",
        body: formData,
      },
      (data) => {
        if (data.error) {
          throw new Error(data.error);
        }
        return data;
      },
      (error) => {
        console.error("Error generating content:", error);
        Utilities.showError("Failed to generate content. Please try again.");
        return "";
      }
    );
  }

  function processClaudeResponse(response) {
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
        // Update state with processing results
        state.responseDialogState.processingResults = data;

        // Re-render the response dialog to reflect updated state
        renderResponseDialog();
      },
      (error) => {
        console.error("Error processing response:", error);
        Utilities.showError("Failed to process response: " + (error.message || "Unknown error"));
      }
    );
  }

  function resetState() {
    state = {
      promptDialogState: {
        userPrompt: "",
        includeCodingPrompt: false,
        includeDirectoryStructure: false,
      },
      fileSelectorState: {
        directoryStructure: null, // Preserve directory structure to avoid reloading
        selectedFiles: [],
        selectedFolders: [],
        tokenCount: 0,
      },
      generateDialogState: {
        generatedContent: "",
      },
      responseDialogState: {
        claudeResponse: "",
        processingResults: null,
      },
      currentDialog: "prompt",
    };
  }

  // Public API
  return {
    init: init,
  };
})();
