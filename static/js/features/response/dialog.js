/**
 * Response Dialog Module
 * Handles UI rendering and event setup for the response dialog
 */
const ResponseDialog = (function () {
  /**
   * Render the response dialog
   * @param {Object} state - Current response dialog state
   * @returns {string} HTML content for the response dialog
   */
  function render(state) {
    console.log("Rendering response dialog with state:", state);
    // Check if we're currently streaming a response
    const isStreaming = state.isStreaming === true;
    
    return `
      <div class="card shadow-sm mb-4">
        <div class="card-header card-header-themed d-flex justify-content-between align-items-center">
          <div class="d-flex align-items-center">
            <h2 class="h4 mb-0">Claude's Response</h2>
            ${isStreaming ? '<span class="badge bg-primary ms-2">Streaming...</span>' : ''}
          </div>
          <div class="header-button" id="copy-continuation-prompt-btn" title="Copy Continuation Prompt">
            <i class="fas fa-sync-alt"></i>
          </div>
        </div>
        <div class="card-body">
          <div class="mb-4">
            <textarea id="claude-response" class="form-control" rows="15" placeholder="${isStreaming ? 'Streaming response from AI...' : 'Paste Claude\'s response here...'}" ${isStreaming ? 'readonly' : ''}>${state.claudeResponse || ""}</textarea>
          </div>

          <div class="d-flex flex-wrap gap-2 justify-content-between">
            <div>
              ${isStreaming ? `
                <button id="cancel-stream-btn" class="btn btn-danger">
                  <i class="fas fa-stop-circle me-1"></i> Cancel Stream
                </button>
              ` : `
                <button id="paste-from-clipboard-btn" class="btn btn-primary">
                  <i class="fas fa-paste me-1"></i> Paste from Clipboard
                </button>
                <button id="process-button" class="btn btn-primary ms-2">
                  <i class="fas fa-cogs me-1"></i> Process Response
                </button>
              `}
              <button id="done-button" class="btn btn-secondary ms-2">
                <i class="fas fa-check me-1"></i> Back to Prompt
              </button>
            </div>
            <a href="https://claude.ai/new" class="btn btn-success" id="claude-button" target="_blank">
              <i class="fas fa-external-link-alt me-1"></i> Open Claude
            </a>
          </div>

          <div id="process-results" class="mt-3">
            ${renderProcessingResults(state.processingResults)}
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Render processing results
   * @param {Object} data - Processing results data
   * @returns {string} HTML for processing results
   */
  function renderProcessingResults(data) {
    if (!data) return "";
    
    // Log data being processed for UI rendering
    console.log('Rendering response processing results:', data);

    // Handle error message from API
    if (data.error) {
      return `
        <div class="alert alert-danger">
          <strong>Error:</strong> ${data.error}
        </div>
      `;
    }

    let statusType = "success";
    let statusMessage = "";

    // Handle success case
    if (data.success_count > 0 || data.edited_files?.length > 0 || data.moved_files?.length > 0) {
      // Create a detailed status message
      statusMessage = `<strong>${data.message || "Processing completed successfully"}</strong><br>`;

      // Add list of edited files if any
      if (data.edited_files && data.edited_files.length > 0) {
        statusMessage += "<div class='mt-2'>Edited files:</div><ul>";
        data.edited_files.forEach((file) => {
          statusMessage += `<li>${file}</li>`;
        });
        statusMessage += "</ul>";
      }

      // Add list of moved files if any
      if (data.moved_files && data.moved_files.length > 0) {
        statusMessage += "<div class='mt-2'>Moved files:</div><ul>";
        data.moved_files.forEach((move) => {
          statusMessage += `<li>From: ${move.source} → To: ${move.destination}</li>`;
        });
        statusMessage += "</ul>";
      }

      // Add errors if any
      if (data.errors && data.errors.length > 0) {
        statusType = "warning";
        statusMessage += "<div class='mt-2 text-danger'>Errors:</div><ul class='text-danger'>";
        data.errors.forEach((error) => {
          let errorMsg = `<li>`;
          if (error.file) {
            errorMsg += `<strong>${error.file}</strong>: `;
          } else if (error.source && error.destination) {
            errorMsg += `<strong>Move from ${error.source} to ${error.destination}</strong>: `;
          }
          if (error.line) {
            errorMsg += `(line ${error.line}) `;
          }
          errorMsg += `${error.message}</li>`;
          statusMessage += errorMsg;
        });
        statusMessage += "</ul>";
      }
    } else if (data.error_count > 0) {
      // Only errors occurred
      statusType = "danger";
      statusMessage = `<strong>${data.message || "Processing failed"}</strong><br>`;
      
      if (data.errors && data.errors.length > 0) {
        statusMessage += "<div class='mt-2'>Errors:</div><ul>";
        data.errors.forEach((error) => {
          let errorMsg = `<li>`;
          if (error.file) {
            errorMsg += `<strong>${error.file}</strong>: `;
          } else if (error.source && error.destination) {
            errorMsg += `<strong>Move from ${error.source} to ${error.destination}</strong>: `;
          }
          if (error.line) {
            errorMsg += `(line ${error.line}) `;
          }
          errorMsg += `${error.message}</li>`;
          statusMessage += errorMsg;
        });
        statusMessage += "</ul>";
      }
    } else {
      // No changes made
      statusType = "info";
      statusMessage = "No file changes were made. Check your response format.";
    }

    // Return the HTML string with the results
    return `
      <div class="alert alert-${statusType}">
        ${statusMessage}
      </div>
    `;
  }

  /**
   * Set up event listeners for the response dialog
   * @param {Object} callbacks - Callback functions for dialog actions
   */
  function setupEventListeners(callbacks) {
    // Get current state to check if we're streaming
    const state = StateManager.getState().responseDialogState;
    const isStreaming = state.isStreaming === true;

    // Copy continuation prompt button (always available)
    Utilities.setupButtonListener("copy-continuation-prompt-btn", function () {
      // Get the continuation prompt from the GeneratePrompts module
      const continuationPrompt = GeneratePrompts.getContinuationPrompt();
      
      // Copy to clipboard
      navigator.clipboard.writeText(continuationPrompt)
        .then(() => {
          Utilities.showSnackBar("Continuation prompt copied to clipboard!", "success");
        })
        .catch((err) => {
          console.error('Failed to copy text: ', err);
          Utilities.showSnackBar("Failed to copy to clipboard", "error");
        });
    });
    
    if (!isStreaming) {
      // Paste from clipboard button (only when not streaming)
      Utilities.setupClipboardPaste("paste-from-clipboard-btn", "claude-response");

      // Process button (only when not streaming)
      Utilities.setupButtonListener("process-button", function () {
        const responseText = document.getElementById("claude-response").value.trim();

        if (!responseText) {
          Utilities.showSnackBar("Please paste Claude's response first.", "error");
          return;
        }

        if (callbacks && callbacks.onProcess) {
          callbacks.onProcess({ claudeResponse: responseText });
        }
      });
    } else {
      // Cancel stream button (only when streaming)
      Utilities.setupButtonListener("cancel-stream-btn", function () {
        // Close the stream if we have a controller
        if (state.streamController && typeof state.streamController.close === 'function') {
          state.streamController.close();
        }
        
        // Update streaming state
        StateManager.updateDialogState("responseDialog", {
          isStreaming: false,
          streamController: null,
        });
        
        // Show info message
        Utilities.showSnackBar("Streaming canceled", "info");
        
        // Re-render response dialog
        if (callbacks && callbacks.onRender) {
          callbacks.onRender();
        }
      });
    }

    // Done button (always available)
    Utilities.setupButtonListener("done-button", function () {
      // If we're streaming, cancel the stream first
      if (isStreaming && state.streamController) {
        state.streamController.close();
        StateManager.updateDialogState("responseDialog", {
          isStreaming: false,
          streamController: null,
        });
      }
      
      if (callbacks && callbacks.onDone) {
        callbacks.onDone();
      }
    });
  }

  // Public API
  return {
    render,
    setupEventListeners,
    renderProcessingResults
  };
})();
