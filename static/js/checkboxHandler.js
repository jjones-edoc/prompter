/**
 * Checkbox handling functionality for files and folders
 */

// Create a namespace for checkbox handling
var CheckboxHandler = (function() {
  /**
   * Handle file checkbox changes for token counting
   * @param {Event} event - The change event
   */
  function handleFileCheckboxChange() {
    const tokenEstimate = parseInt(this.getAttribute("data-token-estimate") || 0);

    if (this.checked) {
      TokenCounter.addTokens(tokenEstimate);
    } else {
      TokenCounter.subtractTokens(tokenEstimate);
    }
  }

  /**
   * Handle folder checkbox changes
   * @param {Event} event - The change event
   */
  function handleFolderCheckboxChange() {
    const checkbox = this;
    const folderPath = checkbox.getAttribute("data-folder-path");
    const folderItem = checkbox.closest(".folder-item");
    const folderTokenCountBadge = folderItem.querySelector(".folder-token-count .token-badge");

    if (checkbox.checked) {
      // Mark the folder as selected
      folderItem.classList.add("selected-folder");

      // Create a hidden input for the folder
      const form = checkbox.closest("form");
      const hiddenInput = document.createElement("input");
      hiddenInput.type = "hidden";
      hiddenInput.name = "selected_folder";
      hiddenInput.value = folderPath;
      hiddenInput.className = "hidden-folder-input";
      hiddenInput.dataset.folderPath = folderPath;
      form.appendChild(hiddenInput);

      // Estimate tokens for this folder
      TokenCounter.fetchFolderTokenCount(folderPath, folderTokenCountBadge);
    } else {
      // Remove the selected class
      folderItem.classList.remove("selected-folder");

      // Remove any hidden inputs for this folder
      const form = checkbox.closest("form");
      const hiddenInputs = form.querySelectorAll(`.hidden-folder-input[data-folder-path="${folderPath}"]`);
      hiddenInputs.forEach((input) => input.remove());

      // Subtract tokens for this folder
      const folderTokens = parseInt(folderTokenCountBadge.getAttribute("data-folder-tokens") || 0);
      TokenCounter.subtractTokens(folderTokens);
      folderTokenCountBadge.textContent = "0 tokens";
      folderTokenCountBadge.setAttribute("data-folder-tokens", "0");
    }

    // Also check/uncheck all visible child files
    const folderContents = folderItem.querySelector(".folder-contents");
    const fileCheckboxes = folderContents.querySelectorAll(".file-checkbox");

    fileCheckboxes.forEach((fileCheckbox) => {
      if (fileCheckbox.checked !== checkbox.checked) {
        fileCheckbox.checked = checkbox.checked;
      }
    });
  }

  /**
   * Set up checkbox event listeners
   * @param {HTMLElement} parentElement - The parent element containing checkboxes
   */
  function setupCheckboxes(parentElement) {
    // Initialize event listeners for file checkboxes
    parentElement.querySelectorAll(".file-checkbox").forEach((checkbox) => {
      checkbox.addEventListener("change", handleFileCheckboxChange);
    });

    // Initialize event listeners for folder checkboxes
    parentElement.querySelectorAll(".folder-checkbox").forEach((checkbox) => {
      checkbox.addEventListener("change", handleFolderCheckboxChange);
    });
  }

  /**
   * Initialize the select all button functionality
   */
  function initSelectAllButton() {
    const selectAllBtn = document.getElementById("select-all-btn");
    if (selectAllBtn) {
      selectAllBtn.addEventListener("click", function () {
        const allCheckables = document.querySelectorAll(".file-checkbox, .folder-checkbox");
        const allChecked = Array.from(allCheckables).every((cb) => cb.checked);

        allCheckables.forEach((checkbox) => {
          checkbox.checked = !allChecked;

          // Trigger change event
          const event = new Event("change", { bubbles: true });
          checkbox.dispatchEvent(event);
        });

        // Update button text
        this.innerHTML = allChecked ? '<i class="fas fa-check-square me-1"></i> Select All' : '<i class="fas fa-square me-1"></i> Deselect All';
      });
    }
  }

  // Return public functions
  return {
    handleFileCheckboxChange: handleFileCheckboxChange,
    handleFolderCheckboxChange: handleFolderCheckboxChange,
    setupCheckboxes: setupCheckboxes,
    initSelectAllButton: initSelectAllButton
  };
})();