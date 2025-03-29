const GenerateDialog = (function () {
  function render(state) {
    const promptElements = state.promptElements || [];
    const availableElementTypes = state.availableElementTypes || [];

    return `
      <div class="card shadow-sm mb-4">
        <div class="card-header card-header-themed d-flex justify-content-between align-items-center">
          <h2 class="h4 mb-0">Prompt Builder</h2>
          <div>
            <button id="generate-prompt-btn" class="btn btn-primary btn-sm">
              <i class="fas fa-wand-magic-sparkles me-1"></i> Generate Prompt
            </button>
          </div>
        </div>
        <div class="card-body">
          <!-- Element Management Section -->
          <div class="element-manager mb-4">
            <div class="row">
              <div class="col-md-6">
                <div class="card border h-100">
                  <div class="card-header bg-light">
                    <h3 class="h5 mb-0">Prompt Elements</h3>
                  </div>
                  <div class="card-body p-0 d-flex flex-column">
                    <ul id="prompt-elements-list" class="list-group list-group-flush flex-grow-1" style="overflow-y: auto;">
                      ${renderPromptElements(promptElements)}
                    </ul>
                  </div>
                </div>
              </div>
              <div class="col-md-6">
                <div class="card border">
                  <div class="card-header bg-light">
                    <h3 class="h5 mb-0">Available Elements</h3>
                  </div>
                  <div class="card-body p-0">
                    <div class="list-group list-group-flush">
                      ${renderAvailableElements(availableElementTypes)}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Generated Prompt Section -->
          <div class="generated-prompt mb-4">
            <div class="card border">
              <div class="card-header bg-light d-flex justify-content-between align-items-center">
                <h3 class="h5 mb-0">Generated Prompt</h3>
                <div>
                  <button id="toggle-prompt-btn" class="btn btn-outline-secondary btn-sm">
                    <i class="fas fa-eye me-1"></i> Show
                  </button>
                </div>
              </div>
              <div class="card-body">
                <textarea id="prompt-content" class="form-control bg-light d-none" rows="15">${state.generatedContent || ""}</textarea>
              </div>
            </div>
          </div>

          <!-- Action Buttons -->
          <div class="d-flex flex-wrap gap-2 justify-content-between">
            <div>
              <button id="copy-button" class="btn btn-primary">
                <i class="fas fa-copy me-1"></i> Copy to Clipboard
              </button>
            </div>
            <div>
              <button id="response-button" class="btn btn-success">
                <i class="fas fa-reply me-1"></i> Enter Response
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  function renderPromptElements(elements) {
    if (!elements || elements.length === 0) {
      return `
        <li class="list-group-item text-center text-muted py-4">
          <i class="fas fa-info-circle me-2"></i> No elements added yet
        </li>
      `;
    }

    let html = "";
    elements.forEach((element, index) => {
      html += `
        <li class="list-group-item d-flex justify-content-between align-items-center" data-element-index="${index}">
          <div class="element-info">
            <div class="d-flex align-items-center">
              <i class="fas ${getElementIcon(element.type)} me-2"></i>
              <strong>${getElementTitle(element)}</strong>
            </div>
            <div class="small text-muted">${getElementDescription(element)}</div>
          </div>
          <div class="element-controls">
            ${
              index > 0
                ? `<button class="btn btn-sm btn-outline-secondary move-up-btn" title="Move Up">
                <i class="fas fa-arrow-up"></i>
              </button>`
                : ""
            }
            ${
              index < elements.length - 1
                ? `<button class="btn btn-sm btn-outline-secondary move-down-btn" title="Move Down">
                <i class="fas fa-arrow-down"></i>
              </button>`
                : ""
            }
            <button class="btn btn-sm btn-outline-secondary edit-element-btn ms-1" title="Edit">
              <i class="fas fa-edit"></i>
            </button>
            <button class="btn btn-sm btn-outline-danger remove-element-btn ms-1" title="Remove">
              <i class="fas fa-times"></i>
            </button>
          </div>
        </li>
      `;
    });

    return html;
  }

  function renderAvailableElements(elementTypes) {
    if (!elementTypes || elementTypes.length === 0) {
      return `
        <div class="list-group-item text-center text-muted py-4">
          <i class="fas fa-info-circle me-2"></i> No element types available
        </div>
      `;
    }

    let html = "";
    elementTypes.forEach((elementType) => {
      if (elementType.enabled) {
        html += `
          <button class="list-group-item list-group-item-action element-type-btn" data-element-type="${elementType.id}">
            <div class="d-flex justify-content-between align-items-center">
              <div>
                <i class="fas ${getElementTypeIcon(elementType.id)} me-2"></i>
                <strong>${elementType.name}</strong>
                <div class="small text-muted">${elementType.description}</div>
              </div>
              <i class="fas fa-plus text-success"></i>
            </div>
          </button>
        `;
      }
    });

    return html;
  }

  function getElementIcon(type) {
    switch (type) {
      case "userPrompt":
        return "fa-comment-alt";
      case "selectedFiles":
        return "fa-file-code";
      case "codingPrompt":
        return "fa-code";
      case "planningPrompt":
        return "fa-sitemap";
      case "editingPrompt":
        return "fa-edit";
      case "directoryStructure":
        return "fa-folder-tree";
      default:
        return "fa-puzzle-piece";
    }
  }

  function getElementTypeIcon(type) {
    return getElementIcon(type);
  }

  function getElementTitle(element) {
    switch (element.type) {
      case "userPrompt":
        return "User Prompt";
      case "selectedFiles":
        return "Selected Files";
      case "codingPrompt":
        return "Coding Prompt";
      case "planningPrompt":
        return "Planning Prompt";
      case "editingPrompt":
        return "Editing Prompt";
      case "directoryStructure":
        return "Directory Structure";
      default:
        return "Unknown Element";
    }
  }

  function getElementDescription(element) {
    switch (element.type) {
      case "userPrompt":
        return element.content ? `${element.content.substring(0, 50)}${element.content.length > 50 ? "..." : ""}` : "No content yet";
      case "selectedFiles":
        const fileCount = element.files ? element.files.length : 0;
        const folderCount = element.folders ? element.folders.length : 0;
        if (fileCount === 0 && folderCount === 0) {
          return "No files selected";
        }
        let desc = "";
        if (fileCount > 0) {
          desc += `${fileCount} file${fileCount !== 1 ? "s" : ""}`;
        }
        if (folderCount > 0) {
          desc += `${desc ? ", " : ""}${folderCount} folder${folderCount !== 1 ? "s" : ""}`;
        }
        return desc;
      case "codingPrompt":
        return "Expert code editing instructions";
      case "planningPrompt":
        return "Instructions for planning complex code changes";
      case "editingPrompt":
        return "Instructions for implementing code changes";
      case "directoryStructure":
        return "Project directory/file structure";
      default:
        return "";
    }
  }

  function setupEventListeners(callbacks) {

    // Element type buttons
    document.querySelectorAll(".element-type-btn").forEach((button) => {
      button.addEventListener("click", function () {
        const elementType = this.getAttribute("data-element-type");
        handleElementTypeClick(elementType, callbacks);
      });
    });

    // Element control buttons (move up/down, edit, remove)
    setupElementControlButtons(callbacks);

    // Generate prompt button
    Utilities.setupButtonListener("generate-prompt-btn", function () {
      if (callbacks && callbacks.onGeneratePrompt) {
        callbacks.onGeneratePrompt();
      }
    });

    // Toggle prompt visibility
    Utilities.setupButtonListener("toggle-prompt-btn", function () {
      const promptContent = document.getElementById("prompt-content");
      if (promptContent.classList.contains("d-none")) {
        // Show the prompt
        promptContent.classList.remove("d-none");
        this.innerHTML = '<i class="fas fa-eye-slash me-1"></i> Hide';
      } else {
        // Hide the prompt
        promptContent.classList.add("d-none");
        this.innerHTML = '<i class="fas fa-eye me-1"></i> Show';
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

      Utilities.copyToClipboard(
        promptContent.value,
        () => {
          // Show success snackbar
          Utilities.showSnackBar("Copied to clipboard!", "success");

          // Call the onCopy callback
          if (callbacks && callbacks.onCopy) {
            callbacks.onCopy();
          }
        },
        (err) => {
          // Show error snackbar
          Utilities.showSnackBar("Copy failed: " + err, "error");
        }
      );

      // If it was hidden, hide it again
      if (wasHidden) {
        promptContent.classList.add("d-none");
      }
    });


    // Go to response button
    Utilities.setupButtonListener("response-button", function () {
      if (callbacks && callbacks.onGoToResponse) {
        callbacks.onGoToResponse();
      }
    });

  }

  function setupElementControlButtons(callbacks) {
    // Move up buttons
    document.querySelectorAll(".move-up-btn").forEach((button) => {
      button.addEventListener("click", function () {
        const listItem = this.closest("li");
        const index = parseInt(listItem.getAttribute("data-element-index"));

        if (callbacks && callbacks.onMoveElement) {
          callbacks.onMoveElement(index, index - 1);
        }
      });
    });

    // Move down buttons
    document.querySelectorAll(".move-down-btn").forEach((button) => {
      button.addEventListener("click", function () {
        const listItem = this.closest("li");
        const index = parseInt(listItem.getAttribute("data-element-index"));

        if (callbacks && callbacks.onMoveElement) {
          callbacks.onMoveElement(index, index + 1);
        }
      });
    });

    // Edit element buttons
    document.querySelectorAll(".edit-element-btn").forEach((button) => {
      button.addEventListener("click", function () {
        const listItem = this.closest("li");
        const index = parseInt(listItem.getAttribute("data-element-index"));

        if (callbacks && callbacks.onEditElement) {
          callbacks.onEditElement(index);
        }
      });
    });

    // Remove element buttons
    document.querySelectorAll(".remove-element-btn").forEach((button) => {
      button.addEventListener("click", function () {
        const listItem = this.closest("li");
        const index = parseInt(listItem.getAttribute("data-element-index"));

        if (callbacks && callbacks.onRemoveElement) {
          callbacks.onRemoveElement(index);
        }
      });
    });
  }


  /**
   * Handle click on element type button
   * @param {string} elementType - Type of element clicked
   * @param {Object} callbacks - Callback functions
   */
  function handleElementTypeClick(elementType, callbacks) {
    switch (elementType) {
      case "userPrompt":
        // Navigate directly to prompt dialog without adding element
        if (callbacks && callbacks.onEditPrompt) {
          callbacks.onEditPrompt(true); // Pass true to indicate creating new element
        }
        break;
        
      case "selectedFiles":
        // Navigate directly to file selector without adding element
        if (callbacks && callbacks.onSelectFiles) {
          callbacks.onSelectFiles(true); // Pass true to indicate creating new element
        }
        break;
        
      default:
        // For other element types (like codingPrompt, planningPrompt, etc.)
        // Create and add element immediately since they don't require additional user input
        let newElement = {
          type: elementType,
          id: `element-${Date.now()}`,
        };
        
        if (callbacks && callbacks.onAddElement) {
          callbacks.onAddElement(newElement);
        }
        break;
    }
  }

  // Public API
  return {
    render: render,
    setupEventListeners: setupEventListeners,
  };
})();
