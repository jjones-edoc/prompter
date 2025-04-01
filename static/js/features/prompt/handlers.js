/**
 * Prompt Feature Handlers Module
 * Contains business logic and event handlers for prompt functionality
 */
const PromptHandlers = (function () {
  /**
   * Render the prompt dialog
   */
  function renderPromptDialog() {
    const mainContent = document.getElementById("main-content");
    const state = StateManager.getState();
    
    // Render dialog with current state
    mainContent.innerHTML = PromptDialog.render(state.promptDialogState);

    // Set up event listeners
    setupPromptEventListeners();
  }

  /**
   * Set up event listeners for the prompt dialog
   */
  function setupPromptEventListeners() {
    PromptDialog.setupEventListeners({
      onSubmit: function (promptData) {
        const state = StateManager.getState();
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
        window.renderCurrentDialog();
      },

      onCancel: function () {
        // Reset editing state before returning to generate dialog
        StateManager.updateDialogState("promptDialog", {
          editingElementIndex: null,
          isCreatingNew: false,
        });

        // Go back to generate dialog without saving changes
        StateManager.setCurrentDialog("generate");
        window.renderCurrentDialog();
      },
    });
  }

  // Public API
  return {
    renderPromptDialog,
  };
})();
