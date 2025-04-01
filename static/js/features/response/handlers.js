/**
 * Response Feature Handlers Module
 * Contains business logic and event handlers for response functionality
 */
const ResponseHandlers = (function () {
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
          StateManager.updateDialogState("responseDialog", {
            claudeResponse: data.claudeResponse,
          });

          processClaudeResponse(data.claudeResponse);
        }
      },
      onDone: function () {
        // Go back to generate dialog
        StateManager.setCurrentDialog("generate");
        window.renderCurrentDialog();
      },
      onRender: function() {
        // Re-render the response dialog
        renderResponseDialog();
      }
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
   * Start streaming a response from the AI
   * @param {string} promptContent - The prompt content to send to the AI
   */
  function startResponseStreaming(promptContent) {
    // Show loading snackbar
    Utilities.showSnackBar("Sending prompt to AI model...", "info");

    // Get settings from state
    const settings = StateManager.getState().settingsDialogState;
    const provider = settings.defaultProvider || "anthropic";
    const reasoningEffort = settings.reasoningEffort || "medium";

    // Update response dialog state to prepare for streaming
    StateManager.updateDialogState("responseDialog", {
      claudeResponse: "",
      processingResults: null, // Reset any previous processing results
      isStreaming: true, // Add streaming flag
    });

    // Go to response dialog immediately
    StateManager.setCurrentDialog("response");
    window.renderCurrentDialog();

    // Then start the streaming process
    const streamController = ApiService.streamPromptToAI(
      promptContent,
      provider, // Use selected provider from settings
      reasoningEffort, // Use selected reasoning effort from settings
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
        window.renderCurrentDialog();
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
        window.renderCurrentDialog();
      }
    );

    // Store stream controller in state so it can be canceled if needed
    StateManager.updateDialogState("responseDialog", {
      streamController: streamController,
    });
  }

  // Public API
  return {
    renderResponseDialog,
    processClaudeResponse,
    startResponseStreaming
  };
})();
