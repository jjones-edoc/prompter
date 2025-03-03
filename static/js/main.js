/**
 * Main entry point for the Prompter application
 */

// Import utilities using script tags instead of ES6 modules
// Other scripts should be loaded before this one in the HTML

/**
 * Initialize the application when the DOM is loaded
 */
document.addEventListener("DOMContentLoaded", function () {
  // Initialize the token counter
  TokenCounter.initTokenCounter();

  // Load complete folder tree when page loads
  const rootFolderContents = document.getElementById("root-folder-contents");
  if (rootFolderContents) {
    // Get current path from URL
    const urlParams = new URLSearchParams(window.location.search);
    const currentPath = urlParams.get("path") || "";

    // Load the complete folder tree
    console.log("Loading complete folder tree with root path:", currentPath);
    TreeView.loadCompleteTree(currentPath, rootFolderContents);
  }

  // Initialize the select all button
  CheckboxHandler.initSelectAllButton();
  
  // Export functions to make them available for dynamically loaded content
  window.setupCheckboxes = CheckboxHandler.setupCheckboxes;
});