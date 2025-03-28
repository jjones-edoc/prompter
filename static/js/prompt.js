const PromptDialog = (function () {
  function render(state) {
    return `
      <div class="card shadow-sm mb-4">
        <div class="card-header card-header-themed d-flex justify-content-between align-items-center">
          <h2 class="h4 mb-0">Enter Your Prompt</h2>
        </div>
        <div class="card-body">
          <form id="prompt-form">
            <div class="mb-3">
              <div class="row">
                <div class="col-12 col-md-6 mb-2">
                  <div class="form-check">
                    <input class="form-check-input" type="checkbox" id="include-coding-prompt" 
                      ${state.includeCodingPrompt ? "checked" : ""} />
                    <label class="form-check-label" for="include-coding-prompt">Include Coding Prompt</label>
                    <small class="form-text text-muted d-block">Adds expert code editing instructions before your prompt</small>
                  </div>
                </div>
                <div class="col-12 col-md-6 mb-2">
                  <div class="form-check">
                    <input class="form-check-input" type="checkbox" id="include-directory-structure" 
                      ${state.includeDirectoryStructure ? "checked" : ""} />
                    <label class="form-check-label" for="include-directory-structure">Include Directory Structure</label>
                    <small class="form-text text-muted d-block">Adds project directory/file structure to provide context</small>
                  </div>
                </div>
              </div>
            </div>

            <div class="mb-4">
              <label for="prompt-text" class="form-label fw-medium">Your Prompt:</label>
              <textarea id="prompt-text" class="form-control" rows="10" 
                placeholder="Enter your instructions for Claude here...">${state.userPrompt || ""}</textarea>
            </div>

            <div class="d-flex justify-content-end">
              <button type="submit" class="btn btn-primary">
                <i class="fas fa-arrow-right me-1"></i> Select Files
              </button>
            </div>
          </form>
        </div>
      </div>
    `;
  }

  function setupEventListeners(callbacks) {
    // Auto-resize textarea
    const promptTextarea = document.getElementById("prompt-text");
    if (promptTextarea) {
      promptTextarea.addEventListener("input", function () {
        this.style.height = "auto";
        this.style.height = this.scrollHeight + "px";
      });

      // Initialize height
      setTimeout(() => {
        promptTextarea.style.height = "auto";
        promptTextarea.style.height = promptTextarea.scrollHeight + "px";
      }, 10);
    }

    // Handle form submission
    const promptForm = document.getElementById("prompt-form");
    if (promptForm) {
      promptForm.addEventListener("submit", function (event) {
        event.preventDefault();

        // Get form values
        const promptText = document.getElementById("prompt-text").value;

        // Validate
        if (!promptText.trim()) {
          Utilities.showError("Please enter a prompt before continuing.", "prompt-form", "prompt-error");
          return;
        }

        // Use the onSubmit callback
        if (callbacks && callbacks.onSubmit) {
          callbacks.onSubmit({
            prompt: promptText,
            includeCodingPrompt: document.getElementById("include-coding-prompt").checked,
            includeDirectoryStructure: document.getElementById("include-directory-structure").checked,
          });
        }
      });
    }
  }

  // Public API
  return {
    render: render,
    setupEventListeners: setupEventListeners,
  };
})();
