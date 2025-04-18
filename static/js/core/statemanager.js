/**
 * Centralized state management for the application
 */
const StateManager = (function () {
  // Initial application state
  let state = {
    // Prompt dialog state
    promptDialogState: {
      userPrompt: "",
      editingElementIndex: null,
      isCreatingNew: false,
    },

    // File selector state
    fileSelectorState: {
      directoryStructure: null,
      selectedFiles: [],
      selectedFolders: [],
      tokenCount: 0,
      searchResults: null,
      editingElementIndex: null,
      isCreatingNew: false,
    },
    
    // Settings dialog state
    settingsDialogState: {
      theme: "light", // Default theme, will be updated from cookie in init()
      defaultProvider: "anthropic", // Default AI provider
      reasoningEffort: "medium", // Default reasoning effort
      availableModels: {}, // Will be populated from API
    },

    // Generate dialog state - updated for new workflow
    generateDialogState: {
      generatedContent: "",
      // New properties for flexible prompt element management
      // New properties for flexible prompt element management
      promptElements: [], // Array of element objects to be included in the prompt
      availableElementTypes: [
        {
          id: "userPrompt",
          name: "User Prompt",
          description: "Your custom instructions for Claude",
          enabled: true,
        },
        {
          id: "selectedFiles",
          name: "Selected Files",
          description: "Content from specific files you've selected",
          enabled: true,
        },
        {
          id: "codingPrompt",
          name: "Coding Prompt",
          description: "Expert code editing instructions with XML Search/Replace format",
          enabled: true,
        },
        {
          id: "planningPrompt",
          name: "Planning Prompt",
          description: "Instructions for planning complex code changes",
          enabled: true,
        },
        {
          id: "refactoringPrompt",
          name: "Refactoring Prompt",
          description: "Instructions for improving code organization and quality",
          enabled: true,
        },
        {
          id: "directoryStructure",
          name: "Directory Structure",
          description: "Project directory/file structure to provide context",
          enabled: true,
        },
      ],
    },

    // Response dialog state
    responseDialogState: {
      claudeResponse: "",
      processingResults: null,
      isStreaming: false,
      streamController: null,
    },

    // Current active dialog - default changed to "generate" but keeping "prompt" for now for compatibility
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
   * Add a prompt element to the generate dialog
   * @param {Object} element - Element to add
   * @param {number} position - Position to insert (optional, defaults to end)
   */
  function addPromptElement(element, position = null) {
    const elements = [...state.generateDialogState.promptElements];

    if (position !== null && position >= 0 && position <= elements.length) {
      elements.splice(position, 0, element);
    } else {
      elements.push(element);
    }

    state.generateDialogState.promptElements = elements;
  }

  /**
   * Remove a prompt element from the generate dialog
   * @param {number} index - Index of the element to remove
   */
  function removePromptElement(index) {
    const elements = [...state.generateDialogState.promptElements];

    if (index >= 0 && index < elements.length) {
      elements.splice(index, 1);
      state.generateDialogState.promptElements = elements;
    }
  }

  /**
   * Reorder prompt elements
   * @param {number} oldIndex - Current index of the element
   * @param {number} newIndex - New index for the element
   */
  function reorderPromptElements(oldIndex, newIndex) {
    const elements = [...state.generateDialogState.promptElements];

    if (oldIndex >= 0 && oldIndex < elements.length && newIndex >= 0 && newIndex < elements.length && oldIndex !== newIndex) {
      const [element] = elements.splice(oldIndex, 1);
      elements.splice(newIndex, 0, element);
      state.generateDialogState.promptElements = elements;
    }
  }

  /**
   * Update a specific prompt element
   * @param {number} index - Index of the element to update
   * @param {Object} elementData - New element data
   */
  function updatePromptElement(index, elementData) {
    const elements = [...state.generateDialogState.promptElements];

    if (index >= 0 && index < elements.length) {
      elements[index] = { ...elements[index], ...elementData };
      state.generateDialogState.promptElements = elements;
    }
  }

  /**
   * Set the current active dialog
   * @param {string} dialogName - Name of dialog to set active
   */
  function setCurrentDialog(dialogName) {
    // Valid dialogs: "prompt", "fileSelector", "generate", "response", "settings"
    state.currentDialog = dialogName;
  }


  /**
   * Update settings with new values and save to cookies
   * @param {Object} newSettings - New settings to apply
   */
  function updateSettings(newSettings) {
    // Update settings in state
    state.settingsDialogState = { ...state.settingsDialogState, ...newSettings };
    
    // Save settings to cookies for persistence
    if (newSettings.theme) {
      setCookie("theme", newSettings.theme, 365); // Cookie expires in 365 days
    }
    
    // Save other settings if needed
    if (newSettings.defaultProvider) {
      setCookie("defaultProvider", newSettings.defaultProvider, 365);
    }
    
    if (newSettings.reasoningEffort) {
      setCookie("reasoningEffort", newSettings.reasoningEffort, 365);
    }
  }
  
  /**
   * Set a cookie
   * @param {string} name - Cookie name
   * @param {string} value - Cookie value
   * @param {number} days - Days until expiration
   */
  function setCookie(name, value, days) {
    const date = new Date();
    date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
    const expires = "; expires=" + date.toUTCString();
    document.cookie = name + "=" + (value || "") + expires + "; path=/";
  }
  
  /**
   * Get cookie value by name
   * @param {string} name - Cookie name
   * @returns {string|null} Cookie value or null if not found
   */
  function getCookie(name) {
    const nameEQ = name + "=";
    const ca = document.cookie.split(';');
    for (let i = 0; i < ca.length; i++) {
      let c = ca[i];
      while (c.charAt(0) === ' ') c = c.substring(1, c.length);
      if (c.indexOf(nameEQ) === 0) return c.substring(nameEQ.length, c.length);
    }
    return null;
  }

  // Public API
  return {
    getState,
    updateState,
    updateDialogState,
    setCurrentDialog,
    // New methods for prompt element management
    addPromptElement,
    removePromptElement,
    reorderPromptElements,
    updatePromptElement,
    // Settings management
    updateSettings,
    // Cookie management
    setCookie,
    getCookie,
  };
})();
