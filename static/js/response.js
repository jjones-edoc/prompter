/**
 * Response Dialog module
 * Handles displaying and processing Claude's response
 */

const ResponseDialog = (function () {
  /**
   * Render the response dialog
   * @param {string} claudeResponse - Claude's response text (optional)
   * @returns {string} HTML content for the response dialog
   */
  function render(claudeResponse = '') {
    return `
      <div class="card shadow-sm mb-4">
        <div class="card-header card-header-themed d-flex justify-content-between align-items-center">
          <h2 class="h4 mb-0">Claude's Response</h2>
        </div>
        <div class="card-body">
          <div class="mb-4">
            <textarea id="claude-response" class="form-control" rows="15" placeholder="Paste Claude's response here...">${claudeResponse}</textarea>
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

          <div id="copy-status" class="alert mt-3 d-none"></div>
          <div id="process-results" class="mt-3"></div>
        </div>
      </div>
    `;
  }

  /**
   * Set up event listeners for the response dialog
   * @param {Function} actionCallback - Callback for dialog actions
   */
  function setupEventListeners(actionCallback) {
    // Paste from clipboard button
    const pasteFromClipboardBtn = document.getElementById("paste-from-clipboard-btn");
    const claudeResponseTextarea = document.getElementById("claude-response");

    if (pasteFromClipboardBtn && claudeResponseTextarea) {
      pasteFromClipboardBtn.addEventListener("click", async function () {
        try {
          // Clear the textarea first
          claudeResponseTextarea.value = "";
          
          // Request clipboard read permission and get text
          const text = await navigator.clipboard.readText();

          // Set the textarea value to the clipboard content
          claudeResponseTextarea.value = text;

          // Show success message
          const processResults = document.getElementById("process-results");
          if (processResults) {
            processResults.innerHTML = `
              <div class="alert alert-success">
                <strong>Success!</strong> Content pasted from clipboard.
              </div>
            `;

            // Clear the message after 3 seconds
            setTimeout(function () {
              processResults.innerHTML = "";
            }, 3000);
          }
        } catch (err) {
          // Handle errors (e.g., clipboard permission denied)
          const processResults = document.getElementById("process-results");
          if (processResults) {
            processResults.innerHTML = `
              <div class="alert alert-danger">
                <strong>Error:</strong> Could not access clipboard. ${err.message}
              </div>
            `;
          }
        }
      });
    }

    // Process button
    const processButton = document.getElementById("process-button");
    if (processButton && claudeResponseTextarea) {
      processButton.addEventListener("click", function () {
        const responseText = claudeResponseTextarea.value.trim();

        if (!responseText) {
          Utilities.showError("Please paste Claude's response first.", "process-results");
          return;
        }

        if (actionCallback) {
          actionCallback("process", { claudeResponse: responseText });
        }
      });
    }

    // Done button (back to prompt)
    const doneButton = document.getElementById("done-button");
    if (doneButton) {
      doneButton.addEventListener("click", function () {
        if (actionCallback) {
          actionCallback("done");
        }
      });
    }
  }

  /**
   * Update the processing results section
   * @param {Object} data - Processing results data
   */
  function updateProcessingResults(data) {
    const resultsContainer = document.getElementById("process-results");
    if (!resultsContainer) return;

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

    // Update the results container
    resultsContainer.innerHTML = `
      <div class="alert alert-${statusType}">
        ${statusMessage}
      </div>
    `;
  }

  // Public API
  return {
    render: render,
    setupEventListeners: setupEventListeners,
    updateProcessingResults: updateProcessingResults,
  };
})();
