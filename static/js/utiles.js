/**
 * Utility functions for the Prompter application
 */

// Create a namespace for utilities
var Utils = (function() {
  /**
   * Function to toggle the caret icon for folders
   * @param {Element} icon - The icon element to toggle
   * @param {boolean} isExpanded - Whether the folder is expanded
   */
  function toggleCaretIcon(icon, isExpanded) {
    if (isExpanded) {
      icon.classList.remove("fa-caret-down");
      icon.classList.add("fa-caret-right");
    } else {
      icon.classList.remove("fa-caret-right");
      icon.classList.add("fa-caret-down");
    }
  }

  // Return public functions
  return {
    toggleCaretIcon: toggleCaretIcon
  };
})();