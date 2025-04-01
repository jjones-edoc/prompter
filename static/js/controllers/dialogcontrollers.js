/**
 * DialogControllers.js
 * Contains controller functions for all dialogs
 */
const DialogControllers = (function () {
  // renderPromptDialog has been moved to PromptHandlers.renderPromptDialog

  /**
   * Render the response dialog
   */
  function renderResponseDialog() {
    const mainContent = document.getElementById("main-content");
    const state = StateManager.getState();

    // Add settings info to response dialog state
    const responseState = {
      ...state.responseDialogState,
      provider: state.settingsDialogState.defaultProvider,
      reasoningEffort: state.settingsDialogState.reasoningEffort,
    };

    console.log("Rendering response dialog, state:", responseState);
    mainContent.innerHTML = ResponseDialog.render(responseState);

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

  /**
   * Render the settings dialog
   * @deprecated Use SettingsHandlers.renderSettingsDialog() instead
   */
  function renderSettingsDialog() {
    // Forward to the new handler module
    SettingsHandlers.renderSettingsDialog();
  }

  // Public API
  return {
    renderResponseDialog,
    renderSettingsDialog, // Kept for backward compatibility
    processClaudeResponse,
  };
})();
