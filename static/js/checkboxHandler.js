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
    // Instead of adding/subtracting individual tokens, recalculate the total
    TokenCounter.recalculateTokens();
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

      // Reset folder token count display
      folderTokenCountBadge.textContent = "0 tokens";
      folderTokenCountBadge.setAttribute("data-folder-tokens", "0");
      
      // Instead of subtracting tokens directly, we'll recalculate all tokens
      TokenCounter.recalculateTokens();
    }

    // Also check/uncheck all visible child files
    const folderContents = folderItem.querySelector(".folder-contents");
    const fileCheckboxes = folderContents.querySelectorAll(".file-checkbox");

    // Block triggering individual change events while checking/unchecking files
    const isBlocking = fileCheckboxes.length > 0;
    if (isBlocking) {
      BlockEvents.startBlocking();
    }
    
    fileCheckboxes.forEach((fileCheckbox) => {
      if (fileCheckbox.checked !== checkbox.checked) {
        fileCheckbox.checked = checkbox.checked;
      }
    });
    
    if (isBlocking) {
      BlockEvents.stopBlocking();
    }
    
    // Recalculate total token count after all files have been checked/unchecked
    TokenCounter.recalculateTokens();
  }

  /**
   * Set up checkbox event listeners
   * @param {HTMLElement} parentElement - The parent element containing checkboxes
   */
  function setupCheckboxes(parentElement) {
    // Initialize event listeners for file checkboxes
    parentElement.querySelectorAll(".file-checkbox").forEach((checkbox) => {
      checkbox.addEventListener("change", function(event) {
        // Only handle the event if we're not currently blocking events
        if (!BlockEvents.isCurrentlyBlocking()) {
          handleFileCheckboxChange.call(this, event);
        }
      });
    });

    // Initialize event listeners for folder checkboxes
    parentElement.querySelectorAll(".folder-checkbox").forEach((checkbox) => {
      checkbox.addEventListener("change", function(event) {
        // Only handle the event if we're not currently blocking events
        if (!BlockEvents.isCurrentlyBlocking()) {
          handleFolderCheckboxChange.call(this, event);
        }
      });
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

        // First update all checkboxes without triggering individual events
        allCheckables.forEach((checkbox) => {
          checkbox.checked = !allChecked;
        });
        
        // For folders, we need to handle the special case of clearing or adding folder metadata
        document.querySelectorAll(".folder-checkbox").forEach((checkbox) => {
          const folderItem = checkbox.closest(".folder-item");
          if (!checkbox.checked) {
            // If we're deselecting, remove the selected class
            folderItem.classList.remove("selected-folder");
            
            // Reset token count display
            const tokenBadge = folderItem.querySelector(".token-badge");
            if (tokenBadge) {
              tokenBadge.textContent = "0 tokens";
              tokenBadge.setAttribute("data-folder-tokens", "0");
            }
            
            // Remove hidden inputs
            const form = checkbox.closest("form");
            if (form) {
              const folderPath = checkbox.getAttribute("data-folder-path");
              const hiddenInputs = form.querySelectorAll(`.hidden-folder-input[data-folder-path="${folderPath}"]`);
              hiddenInputs.forEach((input) => input.remove());
            }
          } else {
            // If we're selecting, add the selected class
            folderItem.classList.add("selected-folder");
          }
        });

        // Then do a single recalculation of tokens
        setTimeout(() => {
          if (allChecked) {
            // If deselecting all, just set to 0
            TokenCounter.setTotalTokens(0);
          } else {
            // If selecting all, recalculate
            TokenCounter.recalculateTokens();
          }
        }, 50);

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