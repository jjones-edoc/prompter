/**
 * Utilities Module
 * Common functions used across the application
 */

const Utilities = (function () {
  /**
   * Show an error message
   * @param {string} message - Error message to display
   * @param {string} containerId - ID of the container to insert the error (optional)
   * @param {string} errorId - ID for the error element (optional)
   * @param {number} autoCloseMs - Auto-close time in milliseconds, 0 for no auto-close (optional)
   */
  function showError(message, containerId = "main-content", errorId = null, autoCloseMs = 5000) {
    // Get container element
    const container = document.getElementById(containerId);
    if (!container) return;

    // Create error element ID if not provided
    const errId = errorId || `error-${Date.now()}`;

    // Check if error element already exists with the specified ID
    let errorElement = document.getElementById(errId);

    if (!errorElement) {
      // Create error element
      errorElement = document.createElement("div");
      errorElement.id = errId;
      errorElement.className = "alert alert-danger alert-dismissible fade show my-3";
      errorElement.innerHTML = `
          ${message}
          <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
        `;

      // Insert at the top of the container
      container.insertBefore(errorElement, container.firstChild);
    } else {
      // Update existing error element
      errorElement.innerHTML = `
          ${message}
          <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
        `;
    }

    // Auto dismiss if specified
    if (autoCloseMs > 0) {
      setTimeout(() => {
        if (errorElement.parentNode) {
          // Check if element is still in the DOM
          const alert = new bootstrap.Alert(errorElement);
          alert.close();
        }
      }, autoCloseMs);
    }

    return errorElement;
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
   * Fetch data from the server with JSON response
   * @param {string} url - API endpoint
   * @param {Object} options - Fetch options (optional)
   * @param {Function} onSuccess - Success callback (optional)
   * @param {Function} onError - Error callback (optional)
   * @returns {Promise} Fetch promise
   */
  function fetchJSON(url, options = {}, onSuccess = null, onError = null) {
    return fetch(url, options)
      .then((response) => {
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json();
      })
      .then((data) => {
        if (onSuccess) onSuccess(data);
        return data;
      })
      .catch((error) => {
        console.error(`Error fetching from ${url}:`, error);
        if (onError) onError(error);
        throw error;
      });
  }

  // Public API
  return {
    showError,
    formatFileSize,
    copyToClipboard,
    fetchJSON,
  };
})();
