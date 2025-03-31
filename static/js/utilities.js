/**
 * Utilities Module
 * Common functions used across the application
 */

const Utilities = (function () {
  /**
   * Show a snack bar message
   * @param {string} message - Message to display
   * @param {string} type - Type of snack bar: 'error', 'success', 'info', 'warning'
   * @param {number} durationMs - Duration in milliseconds before auto-close
   * @returns {HTMLElement} The created snack bar element
   */
  function showSnackBar(message, type = "info", durationMs = 3000) {
    // Get or create snack bar container
    let snackBarContainer = document.getElementById("snack-bar-container");
    if (!snackBarContainer) {
      snackBarContainer = document.createElement("div");
      snackBarContainer.id = "snack-bar-container";
      snackBarContainer.className = "snack-bar-container";
      document.body.appendChild(snackBarContainer);
    }

    // Create snack bar element
    const snackBar = document.createElement("div");
    snackBar.className = `snack-bar snack-bar-${type} show-snack-bar`;

    // Set icon based on type
    let icon = "info-circle";
    switch (type) {
      case "error":
        icon = "exclamation-circle";
        break;
      case "success":
        icon = "check-circle";
        break;
      case "info":
        icon = "exclamation-triangle";
        break;
    }

    snackBar.innerHTML = `
      <div class="snack-bar-content">
        <i class="fas fa-${icon} me-2"></i>
        <span>${message}</span>
      </div>
      <button type="button" class="snack-bar-close">
        <i class="fas fa-times"></i>
      </button>
    `;

    // Add to container
    snackBarContainer.appendChild(snackBar);

    // Add close button functionality
    const closeButton = snackBar.querySelector(".snack-bar-close");
    closeButton.addEventListener("click", () => {
      snackBar.classList.remove("show-snack-bar");
      snackBar.classList.add("hide-snack-bar");

      // Remove from DOM after animation
      setTimeout(() => {
        if (snackBar.parentNode) {
          snackBar.parentNode.removeChild(snackBar);
        }
      }, 300);
    });

    // Auto-close after duration
    if (durationMs > 0) {
      setTimeout(() => {
        if (snackBar.parentNode) {
          snackBar.classList.remove("show-snack-bar");
          snackBar.classList.add("hide-snack-bar");

          // Remove from DOM after animation
          setTimeout(() => {
            if (snackBar.parentNode) {
              snackBar.parentNode.removeChild(snackBar);
            }
          }, 300);
        }
      }, durationMs);
    }

    return snackBar;
  }

  /**
   * Show an error message
   * @param {string} message - Error message to display
   * @param {number} durationMs - Duration in milliseconds before auto-close
   * @returns {HTMLElement} The created snack bar element
   */
  function showError(message, durationMs = 3000) {
    return showSnackBar(message, "error", durationMs);
  }

  /**
   * Format file size in human-readable format
   * @param {number} size - File size in bytes
   * @returns {string} Formatted file size
   */
  function formatFileSize(size) {
    if (size < 1024) {
      return size + " B";
    } else if (size < 1048576) {
      return (size / 1024).toFixed(1) + " KB";
    } else {
      return (size / 1048576).toFixed(1) + " MB";
    }
  }

  /**
   * Copy text to clipboard
   * @param {string} text - Text to copy
   * @param {Function} onSuccess - Callback on success (optional)
   * @param {Function} onError - Callback on error (optional)
   * @returns {boolean} Success status
   */
  function copyToClipboard(text, onSuccess = null, onError = null) {
    let success = false;

    try {
      // Try execCommand approach first (older browsers)
      const textArea = document.createElement("textarea");
      textArea.value = text;
      textArea.style.position = "fixed"; // Avoid scrolling to bottom
      document.body.appendChild(textArea);
      textArea.select();

      success = document.execCommand("copy");
      document.body.removeChild(textArea);

      if (success && onSuccess) onSuccess();
    } catch (err) {
      if (onError) onError(err);
      console.error("Copy failed with execCommand:", err);
    }

    // Try clipboard API as fallback (modern browsers)
    if (!success && navigator.clipboard) {
      navigator.clipboard
        .writeText(text)
        .then(() => {
          success = true;
          if (onSuccess) onSuccess();
        })
        .catch((err) => {
          if (onError) onError(err);
          console.error("Failed to copy using Clipboard API:", err);
        });
    }

    return success;
  }

  /**
   * Create and set up a button click event listener
   * @param {string} buttonId - Button element ID
   * @param {Function} callback - Click event callback
   * @returns {HTMLElement|null} - The button element or null if not found
   */
  function setupButtonListener(buttonId, callback) {
    const button = document.getElementById(buttonId);
    if (button) {
      button.addEventListener("click", callback);
    }
    return button;
  }

  /**
   * Set up clipboard paste functionality
   * @param {string} buttonId - Paste button ID
   * @param {string} targetId - Target textarea ID
   * @returns {boolean} - True if setup was successful
   */
  function setupClipboardPaste(buttonId, targetId) {
    const pasteButton = document.getElementById(buttonId);
    const targetElement = document.getElementById(targetId);

    if (!pasteButton || !targetElement) {
      return false;
    }

    pasteButton.addEventListener("click", async function () {
      try {
        // Clear the textarea first
        targetElement.value = "";

        // Request clipboard read permission and get text
        const text = await navigator.clipboard.readText();

        // Set the textarea value to the clipboard content
        targetElement.value = text;

        // Show success message
        showSnackBar("Content pasted from clipboard", "success");
      } catch (err) {
        // Handle errors (e.g., clipboard permission denied)
        showSnackBar(`Could not access clipboard: ${err.message}`, "error");
      }
    });

    return true;
  }

  // Public API
  return {
    showError,
    showSnackBar,
    formatFileSize,
    copyToClipboard,
    setupButtonListener,
    setupClipboardPaste,
  };
})();
