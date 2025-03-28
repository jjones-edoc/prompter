const GenerateDialog = (function () {
  function render(state) {
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
          </div>

          <div id="copy-status" class="alert mt-3 d-none"></div>
        </div>
      </div>
    `;
  }

  function setupEventListeners(callbacks) {
    // Toggle prompt visibility
    Utilities.setupButtonListener("toggle-prompt-btn", function () {
      const promptContent = document.getElementById("prompt-content");
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

    // Copy to clipboard
    Utilities.setupButtonListener("copy-button", function () {
      const promptContent = document.getElementById("prompt-content");
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

          // Call the onCopy callback
          if (callbacks && callbacks.onCopy) {
            callbacks.onCopy();
          }
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
    });

    // Back button
    Utilities.setupButtonListener("back-button", function () {
      if (callbacks && callbacks.onBack) {
        callbacks.onBack();
      }
    });

    // Restart button
    Utilities.setupButtonListener("restart-button", function () {
      if (callbacks && callbacks.onRestart) {
        callbacks.onRestart();
      }
    });
  }

  // Public API
  return {
    render: render,
    setupEventListeners: setupEventListeners,
  };
})();
