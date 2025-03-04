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
  
  // Reset token counter state on index page only if there's no token count parameter
  if ((window.location.pathname === "/" || window.location.pathname === "/index") &&
      !new URLSearchParams(window.location.search).has("token_count")) {
    TokenCounter.setTotalTokens(0);
  }
  
  // Save token count when navigating away from index page
  if (window.location.pathname === "/" || window.location.pathname === "/index") {
    const form = document.querySelector("form");
    if (form) {
      form.addEventListener("submit", function() {
        const hiddenTokenInput = document.getElementById("hidden-token-count");
        if (hiddenTokenInput) {
          hiddenTokenInput.value = document.getElementById("total-tokens").textContent.replace(/,/g, '');
        }
      });
    }
  }
  
  // Add event listener to recalculate tokens when DOM is fully loaded
  document.addEventListener("DOMContentLoaded", function() {
    // Wait a moment for all checkboxes to be ready
    setTimeout(() => {
      TokenCounter.recalculateTokens();
    }, 500);
  });

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
  
  // Initialize search functionality
  SearchHandler.initSearch();
  
  // Set up next button to save token count
  const nextButton = document.getElementById("next-button");
  if (nextButton) {
    nextButton.addEventListener("click", function() {
      const hiddenTokenInput = document.getElementById("hidden-token-count");
      const totalTokensElement = document.getElementById("total-tokens");
      if (hiddenTokenInput && totalTokensElement) {
        hiddenTokenInput.value = totalTokensElement.textContent.replace(/,/g, '');
        console.log("Saved token count to hidden input:", hiddenTokenInput.value);
      }
    });
  }
  
  // Export functions to make them available for dynamically loaded content
  window.setupCheckboxes = CheckboxHandler.setupCheckboxes;
});