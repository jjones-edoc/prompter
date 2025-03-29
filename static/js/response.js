const ResponseDialog = (function () {
  function render(state) {
    return `
      <div class="card shadow-sm mb-4">
        <div class="card-header card-header-themed d-flex justify-content-between align-items-center">
          <h2 class="h4 mb-0">Claude's Response</h2>
        </div>
        <div class="card-body">
          <div class="mb-4">
            <textarea id="claude-response" class="form-control" rows="15" placeholder="Paste Claude's response here...">${state.claudeResponse || ""}</textarea>
          </div>

          <div class="d-flex flex-wrap gap-2 justify-content-between">
            <div>
              <button id="paste-from-clipboard-btn" class="btn btn-primary">
                <i class="fas fa-paste me-1"></i> Paste from Clipboard
              </button>
              <button id="process-button" class="btn btn-primary ms-2">
                <i class="fas fa-cogs me-1"></i> Process Response
              </button>
              <button id="done-button" class="btn btn-secondary ms-2">
                <i class="fas fa-check me-1"></i> Back to Prompt
              </button>
            </div>
            <a href="https://claude.ai/new" class="btn btn-success" id="claude-button" target="_blank">
              <i class="fas fa-external-link-alt me-1"></i> Open Claude
            </a>
          </div>

          <!-- Removed inline alert -->
          <div id="process-results" class="mt-3">
            ${renderProcessingResults(state.processingResults)}
          </div>
        </div>
      </div>
    `;
  }

  function renderProcessingResults(data) {
    if (!data) return "";
    
    // Log data being processed for UI rendering
    console.log('Rendering response processing results:', data);

    let statusType = "success";
    let statusMessage = "";

    if (data.success) {
      // Create a detailed status message
      statusMessage = `<strong>${data.message}</strong><br>`;

      // Add list of edited files if any
      if (data.edited_files && data.edited_files.length > 0) {
        statusMessage += "<div class='mt-2'>Edited files:</div><ul>";
        data.edited_files.forEach((file) => {
          statusMessage += `<li>${file}</li>`;
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
      // Error case
      statusType = "danger";
      statusMessage = `<strong>Error:</strong> ${data.error || "An unknown error occurred."}`;
    }

    // Return the HTML string
    return `
      <div class="alert alert-${statusType}">
        ${statusMessage}
      </div>
    `;
  }

  function setupEventListeners(callbacks) {
    // Paste from clipboard button
    Utilities.setupClipboardPaste("paste-from-clipboard-btn", "claude-response");

    // Process button
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

    // Done button
    Utilities.setupButtonListener("done-button", function () {
      if (callbacks && callbacks.onDone) {
        callbacks.onDone();
      }
    });
  }

  // Public API
  return {
    render: render,
    setupEventListeners: setupEventListeners,
  };
})();
