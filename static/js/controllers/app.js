/**
 * Main Application Module
 * Handles initialization and rendering of the current dialog
 */
const App = (function () {
  /**
   * Initialize the application
   */
  function init() {
    // Update default dialog to generate
    StateManager.setCurrentDialog("generate");
    renderCurrentDialog();
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
