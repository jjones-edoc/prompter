/**
 * Centralized state management for the application
 */
const StateManager = (function () {
  // Initial application state
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
      searchResults: null,
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

  /**
   * Get current state
   * @returns {Object} Current application state
   */
  function getState() {
    return state;
  }

  /**
   * Update state with new values
   * @param {Object} newState - Partial state object to merge
   */
  function updateState(newState) {
    // Perform a shallow merge at the top level
    state = { ...state, ...newState };
  }

  /**
   * Update a specific dialog state
   * @param {string} dialogName - Name of dialog state to update
   * @param {Object} dialogState - New dialog state
   */
  function updateDialogState(dialogName, dialogState) {
    const stateKey = `${dialogName}State`;
    if (state[stateKey]) {
      state[stateKey] = { ...state[stateKey], ...dialogState };
    }
  }

  /**
   * Set the current active dialog
   * @param {string} dialogName - Name of dialog to set active
   */
  function setCurrentDialog(dialogName) {
    state.currentDialog = dialogName;
  }

  /**
   * Reset state to initial values
   * Optionally preserve directory structure
   * @param {boolean} preserveDirectoryStructure - Whether to preserve directory structure
   */
  function resetState(preserveDirectoryStructure = true) {
    const directoryStructure = preserveDirectoryStructure ? state.fileSelectorState.directoryStructure : null;

    state = {
      promptDialogState: {
        userPrompt: "",
        includeCodingPrompt: false,
        includeDirectoryStructure: false,
      },
      fileSelectorState: {
        directoryStructure: directoryStructure,
        selectedFiles: [],
        selectedFolders: [],
        tokenCount: 0,
        searchResults: null,
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
    getState,
    updateState,
    updateDialogState,
    setCurrentDialog,
    resetState,
  };
})();
