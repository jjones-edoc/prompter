/**
 * FileSelector Handlers Module
 * Contains business logic and event handlers for file selector functionality
 */
const FileSelectorHandlers = (function () {
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
      FileSelectorAPI.fetchDirectoryStructure().then((data) => {
        if (data.error) {
          Utilities.showSnackBar(`Error: ${data.error}`, "error");
          return;
        }

        // Save the directory structure to state
        StateManager.updateDialogState("fileSelector", { directoryStructure: data });

        // Now render the file selector with the loaded data
        const mainContent = document.getElementById("main-content");
        mainContent.innerHTML = FileSelectorDialog.render(state.fileSelectorState);

        // Set up event listeners for user interaction
        FileSelectorDialog.setupEventListeners(createFileSelectorCallbacks());
      });
    } else {
      // Directory structure already loaded
      const mainContent = document.getElementById("main-content");
      mainContent.innerHTML = FileSelectorDialog.render(state.fileSelectorState);

      FileSelectorDialog.setupEventListeners(createFileSelectorCallbacks());
    }
  }

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
   * Perform search in file selector
   * @param {string} query - Search query
   */
  function performSearch(query) {
    // Show loading state
    document.getElementById("search-stats").innerHTML = `<i class="fas fa-spinner fa-spin me-2"></i> Searching for "${query}"...`;
    document.getElementById("search-status").classList.remove("d-none");

    // Show info snackbar
    Utilities.showSnackBar(`Searching for "${query}"...`, "info", 2000);

    FileSelectorAPI.searchFiles(query).then((data) => {
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
      FileSelectorDialog.updateSearchResults(StateManager.getState().fileSelectorState.searchResults, state.fileSelectorState.selectedFiles);

      // Remove any existing event listeners before re-setting up
      cleanupEventListeners();
      
      // Rebind checkbox events by re-setting up event listeners
      FileSelectorDialog.setupEventListeners(createFileSelectorCallbacks());

      // Update select all button
      FileSelectorDialog.updateSelectAllButton();
      
      // Reset the select all button text based on the search results
      const selectAllBtn = document.getElementById("select-all-btn");
      if (selectAllBtn && data.count > 0) {
        selectAllBtn.innerHTML = '<i class="fas fa-check-square me-1"></i> Select All';
      }
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
    
    // Clean up event listeners before re-rendering
    cleanupEventListeners();

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

    FileSelectorAPI.fetchFolderTokenCount(folderPath).then((data) => {
      if (data.error) {
        console.error("Error fetching token count:", data.error);
        badgeElement.textContent = "0 tokens";
      } else {
        badgeElement.textContent = `${data.token_count} tokens`;
        badgeElement.setAttribute("data-folder-tokens", data.token_count);

        // Recalculate total tokens
        const totalTokens = FileSelectorDialog.calculateTotalTokens();
        StateManager.updateDialogState("fileSelector", { tokenCount: totalTokens });
      }
    });
  }

  /**
   * Clean up event listeners before re-binding
   * Prevents duplicate event handlers
   */
  function cleanupEventListeners() {
    // Clean up select all button
    const selectAllBtn = document.getElementById("select-all-btn");
    if (selectAllBtn) {
      const clone = selectAllBtn.cloneNode(true);
      selectAllBtn.parentNode.replaceChild(clone, selectAllBtn);
    }
    
    // Clean up search button
    const searchButton = document.getElementById("search-button");
    if (searchButton) {
      const clone = searchButton.cloneNode(true);
      searchButton.parentNode.replaceChild(clone, searchButton);
    }
    
    // Clean up clear search button
    const clearSearchBtn = document.getElementById("clear-search");
    if (clearSearchBtn) {
      const clone = clearSearchBtn.cloneNode(true);
      clearSearchBtn.parentNode.replaceChild(clone, clearSearchBtn);
    }
    
    // Clean up back button
    const backButton = document.getElementById("back-button");
    if (backButton) {
      const clone = backButton.cloneNode(true);
      backButton.parentNode.replaceChild(clone, backButton);
    }
  }

  // Public API
  return {
    renderFileSelectorDialog,
    performSearch,
    clearSearch,
    updateFolderTokenCount,
    createFileSelectorCallbacks,
    cleanupEventListeners,
  };
})();
