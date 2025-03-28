const PromptDialog = (function () {
  function render(state) {
    // Determine if we're editing or creating a new prompt
    const isEditing = state.editingElementIndex !== undefined && state.editingElementIndex !== null && state.editingElementIndex >= 0;
    const headerText = isEditing ? "Edit Your Prompt" : "Create Your Prompt";
    const submitButtonText = isEditing ? "Save Changes" : "Save Prompt";
    
    return `
      <div class="card shadow-sm mb-4">
        <div class="card-header card-header-themed d-flex justify-content-between align-items-center">
          <h2 class="h4 mb-0">${headerText}</h2>
        </div>
        <div class="card-body">
          <form id="prompt-form">
            <div class="mb-4">
              <textarea id="prompt-text" class="form-control" rows="10" 
                placeholder="Enter your instructions for Claude here...">${state.userPrompt || ""}</textarea>
            </div>

            <div class="d-flex justify-content-between">
              <button type="button" id="cancel-button" class="btn btn-outline-secondary">
                <i class="fas fa-times me-1"></i> Cancel
              </button>
              <button type="submit" class="btn btn-primary">
                <i class="fas fa-save me-1"></i> ${submitButtonText}
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
          Utilities.showSnackBar("Please enter a prompt before continuing.", "error");
          return;
        }

        // Use the onSubmit callback
        if (callbacks && callbacks.onSubmit) {
          callbacks.onSubmit({
            prompt: promptText
          });
        }
      });
    }

    // Cancel button
    Utilities.setupButtonListener("cancel-button", function() {
      if (callbacks && callbacks.onCancel) {
        callbacks.onCancel();
      }
    });
  }

  // Public API
  return {
    render: render,
    setupEventListeners: setupEventListeners,
  };
})();
