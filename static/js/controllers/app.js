/**
 * Main Application Module
 * Handles initialization and rendering of the current dialog
 */
const App = (function () {
  /**
   * Initialize the application
   */
  function init() {
    // Initialize app settings from localStorage
    const storedTheme = localStorage.getItem("theme");
    const storedProvider = localStorage.getItem("defaultProvider");
    const storedReasoningEffort = localStorage.getItem("reasoningEffort");
    
    // Update settings with stored values if available
    StateManager.updateDialogState("settingsDialog", {
      theme: storedTheme || "light",
      defaultProvider: storedProvider || "anthropic",
      reasoningEffort: storedReasoningEffort || "medium"
    });
    
    // Apply theme
    const currentTheme = StateManager.getState().settingsDialogState.theme;
    document.documentElement.setAttribute("data-bs-theme", currentTheme);
    
    // Update default dialog to generate
    StateManager.setCurrentDialog("generate");
    renderCurrentDialog();
    
    // Fetch available models in the background
    fetch("/api/get_available_models")
      .then(response => response.json())
      .then(data => {
        // Update settings state with available models
        StateManager.updateDialogState("settingsDialog", {
          availableModels: data.available_models || {},
          defaultProvider: data.default_provider || StateManager.getState().settingsDialogState.defaultProvider,
          reasoningEffort: data.default_reasoning_effort || StateManager.getState().settingsDialogState.reasoningEffort
        });
      })
      .catch(error => {
        console.error("Error fetching available models:", error);
      });
  }

  /**
   * Central function to render the current dialog
   */
  function renderCurrentDialog() {
    const mainContent = document.getElementById("main-content");
    const state = StateManager.getState();

    // Show loading state during transitions
    mainContent.innerHTML = '<div class="text-center py-4"><i class="fas fa-spinner fa-spin me-2"></i> Loading...</div>';

    switch (state.currentDialog) {
      case "prompt":
        DialogControllers.renderPromptDialog();
        break;
      case "fileSelector":
        DialogControllers.renderFileSelectorDialog();
        break;
      case "generate":
        DialogControllers.renderGenerateDialog();
        break;
      case "response":
        DialogControllers.renderResponseDialog();
        break;
      case "settings":
        DialogControllers.renderSettingsDialog();
        break;
    }
  }

  // Public API
  return {
    init: init,
    renderCurrentDialog: renderCurrentDialog,
  };
})();

// Export renderCurrentDialog to global scope for DialogControllers
window.renderCurrentDialog = App.renderCurrentDialog;
