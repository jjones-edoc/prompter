/**
 * Generate Dialog module
 * Handles prompt generation and processing Claude's response
 */

const GenerateDialog = (function () {
  /**
   * Render the generate dialog
   * @returns {string} HTML content for the generate dialog
   */
  function render() {
    return `
          <div class="card shadow-sm mb-4">
            <div class="card-header card-header-themed d-flex justify-content-between align-items-center">
              <h2 class="h4 mb-0">Your Generated Prompt</h2>
            </div>
            <div class="card-body">
              <div class="mb-4">
                <textarea id="prompt-content" class="form-control bg-light d-none" rows="15"></textarea>
              </div>
    
              <div class="d-flex flex-wrap gap-2 justify-content-between">
                <div>
                  <button id="toggle-prompt-btn" class="btn btn-primary"><i class="fas fa-eye me-1"></i> Show Prompt</button>
                  <button id="copy-button" class="btn btn-primary ms-2"><i class="fas fa-copy me-1"></i> Copy to Clipboard</button>
                  <button id="back-button" class="btn btn-secondary ms-2"><i class="fas fa-arrow-left me-1"></i> Back</button>
                  <button id="restart-button" class="btn btn-secondary ms-2"><i class="fas fa-redo me-1"></i> Start New</button>
                </div>
                <a href="https://claude.ai/new" class="btn btn-success" id="claude-button" target="_blank">
                  <i class="fas fa-external-link-alt me-1"></i> Open Claude
                </a>
              </div>
    
              <div id="copy-status" class="alert mt-3 d-none"></div>
            </div>
          </div>
    
          <div class="card shadow-sm mb-4">
            <div class="card-header card-header-themed d-flex justify-content-between align-items-center">
              <h2 class="h4 mb-0">Paste Claude Response</h2>
            </div>
            <div class="card-body">
              <div class="mb-4">
                <textarea id="claude-response" class="form-control" rows="10" placeholder="Paste Claude's response here..."></textarea>
              </div>
    
              <div class="d-flex flex-wrap gap-2">
                <button id="process-button" class="btn btn-primary">
                  <i class="fas fa-cogs me-1"></i> Process Response
                </button>
              </div>
    
              <div id="process-results" class="mt-3"></div>
            </div>
          </div>
        `;
  }

  /**
   * Set up event listeners for the generate dialog
   * @param {Function} actionCallback - Callback for dialog actions
   */
  function setupEventListeners(actionCallback) {
    // Toggle prompt visibility
    const togglePromptBtn = document.getElementById("toggle-prompt-btn");
    const promptContent = document.getElementById("prompt-content");

    if (togglePromptBtn && promptContent) {
      togglePromptBtn.addEventListener("click", function () {
        if (promptContent.classList.contains("d-none")) {
          // Show the prompt
          promptContent.classList.remove("d-none");
          this.innerHTML = '<i class="fas fa-eye-slash me-1"></i> Hide Prompt';
        } else {
          // Hide the prompt
          promptContent.classList.add("d-none");
          this.innerHTML = '<i class="fas fa-eye me-1"></i> Show Prompt';
        }
      });
    }

    // Copy to clipboard
    const copyButton = document.getElementById("copy-button");
    if (copyButton && promptContent) {
      copyButton.addEventListener("click", function () {
        // Save current visibility state
        const wasHidden = promptContent.classList.contains("d-none");

        // If hidden, temporarily show it to allow selection
        if (wasHidden) {
          promptContent.classList.remove("d-none");
        }

        const copyStatus = document.getElementById("copy-status");

        Utilities.copyToClipboard(
          promptContent.value,
          () => {
            copyStatus.textContent = "Copied to clipboard!";
            copyStatus.classList.remove("d-none", "alert-danger");
            copyStatus.classList.add("alert-success");

            // Clear the status after 3 seconds
            setTimeout(function () {
              copyStatus.classList.add("d-none");
            }, 3000);
          },
          (err) => {
            copyStatus.textContent = "Copy failed: " + err;
            copyStatus.classList.remove("d-none", "alert-success");
            copyStatus.classList.add("alert-danger");
          }
        );

        // If it was hidden, hide it again
        if (wasHidden) {
          promptContent.classList.add("d-none");
        }

        // Notify parent that copy action was performed
        if (actionCallback) {
          actionCallback("copy");
        }
      });
    }

    // Back button
    const backButton = document.getElementById("back-button");
    if (backButton) {
      backButton.addEventListener("click", function () {
        if (actionCallback) {
          actionCallback("back");
        }
      });
    }

    // Restart button
    const restartButton = document.getElementById("restart-button");
    if (restartButton) {
      restartButton.addEventListener("click", function () {
        if (actionCallback) {
          actionCallback("restart");
        }
      });
    }

    // Process button
    const processButton = document.getElementById("process-button");
    const claudeResponse = document.getElementById("claude-response");

    if (processButton && claudeResponse) {
      processButton.addEventListener("click", function () {
        const responseText = claudeResponse.value.trim();

        if (!responseText) {
          Utilities.showError("Please paste Claude's response first.", "process-results");
          return;
        }

        if (actionCallback) {
          actionCallback("process", { claudeResponse: responseText });
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
