/**
 * Utility functions for the Prompter application
 */

// Create a namespace for utilities
var Utils = (function() {
  /**
   * Toggle the caret icon direction
   * @param {HTMLElement} iconElement - The icon element to toggle
   * @param {boolean} isExpanded - Whether the section is expanded or not
   */
  function toggleCaretIcon(iconElement, isExpanded) {
    if (isExpanded) {
      iconElement.classList.remove("fa-caret-down");
      iconElement.classList.add("fa-caret-right");
    } else {
      iconElement.classList.remove("fa-caret-right");
      iconElement.classList.add("fa-caret-down");
    }
  }

  // Return public functions
  return {
    toggleCaretIcon: toggleCaretIcon
  };
})();

/**
 * Event blocking utility to prevent multiple change events from firing
 */
var BlockEvents = (function() {
  // Private variables
  let isBlocking = false;
  
  /**
   * Start blocking events
   */
  function startBlocking() {
    isBlocking = true;
  }
  
  /**
   * Stop blocking events
   */
  function stopBlocking() {
    isBlocking = false;
  }
  
  /**
   * Check if events are currently being blocked
   * @returns {boolean} - Whether events are being blocked
   */
  function isCurrentlyBlocking() {
    return isBlocking;
  }
  
  // Return public functions
  return {
    startBlocking: startBlocking,
    stopBlocking: stopBlocking,
    isCurrentlyBlocking: isCurrentlyBlocking
  };
})();
