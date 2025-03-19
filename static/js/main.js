/**
 * Main entry point for the Prompter application
 */

// Import utilities using script tags instead of ES6 modules
// Other scripts should be loaded before this one in the HTML

// Function to clear preselected files
function clearPreselectedFiles() {
  // Clear any preselected files
  if (window.preselectedFiles) {
    window.preselectedFiles = [];
  }

  // Uncheck all checkboxes
  const fileCheckboxes = document.querySelectorAll(".file-checkbox");

  // Use BlockEvents to prevent multiple recalculations
  if (typeof BlockEvents !== "undefined") {
    BlockEvents.startBlocking();
  }

  fileCheckboxes.forEach((checkbox) => {
    checkbox.checked = false;
  });

  // Stop blocking events
  if (typeof BlockEvents !== "undefined") {
    BlockEvents.stopBlocking();
  }

  // Clear from session
  fetch("/api/clear_preselected_files")
    .then((response) => response.json())
    .then((data) => {
      if (data.success) {
        // Recalculate tokens
        setTimeout(() => {
          TokenCounter.recalculateTokens();
        }, 100);

        // Hide the alert
        const alert = document.querySelector(".alert-info");
        if (alert) {
          alert.classList.remove("show");
          setTimeout(() => {
            alert.remove();
          }, 300);
        }
      }
    })
    .catch((err) => console.error("Error clearing preselected files:", err));
}

/**
 * Initialize the application when the DOM is loaded
 */
document.addEventListener("DOMContentLoaded", function () {
  // Set up clear preselected button
  const clearPreselectedBtn = document.getElementById("clear-preselected-btn");
  if (clearPreselectedBtn) {
    clearPreselectedBtn.addEventListener("click", clearPreselectedFiles);
  }
  // Initialize the token counter
  TokenCounter.initTokenCounter();

  // Reset token counter state on index page only if there's no token count parameter
  if ((window.location.pathname === "/" || window.location.pathname === "/index") && !new URLSearchParams(window.location.search).has("token_count")) {
    TokenCounter.setTotalTokens(0);
  }

  // Save token count when navigating away from index page
  if (window.location.pathname === "/" || window.location.pathname === "/index") {
    const form = document.querySelector("form");
    if (form) {
      form.addEventListener("submit", function () {
        const hiddenTokenInput = document.getElementById("hidden-token-count");
        if (hiddenTokenInput) {
          hiddenTokenInput.value = document.getElementById("total-tokens").textContent.replace(/,/g, "");
        }
      });
    }
  }

  // Initialize the unfamiliar files counter
  initUnfamiliarFilesCounter();

  // Initialize the unfamiliar files handler if we're on that page
  if (typeof UnfamiliarHandler !== "undefined") {
    UnfamiliarHandler.init();
  }

  // Add event listener to recalculate tokens when DOM is fully loaded
  document.addEventListener("DOMContentLoaded", function () {
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

    // Check for preselected files
    checkForPreselectedFiles();
  }

  // Function to handle preselected files
  function checkForPreselectedFiles() {
    // This function will be called after the tree is loaded
    // It will select files that were preselected by the AI

    // Create a MutationObserver to watch for tree loading completion
    const observer = new MutationObserver((mutations, obs) => {
      const treeRoot = document.getElementById("root-folder-contents");

      // Check if the tree is no longer showing the loading indicator
      if (treeRoot && !treeRoot.querySelector(".fa-spinner")) {
        // Tree is loaded, disconnect observer
        obs.disconnect();

        // Wait a moment for all checkboxes to be properly initialized
        setTimeout(() => {
          selectPreselectedFiles();
        }, 500);
      }
    });

    // Start observing
    observer.observe(document.getElementById("root-folder-contents"), {
      childList: true,
      subtree: true,
    });
  }

  function selectPreselectedFiles() {
    // Get all file checkboxes
    const fileCheckboxes = document.querySelectorAll(".file-checkbox");
    let hasSelectedFiles = false;

    // Check if we need to fetch preselected files from the server
    if (!window.preselectedFiles) {
      // Try to extract from the alert message
      const alertMsg = document.querySelector(".alert-info");
      if (alertMsg) {
        // Fetch preselected files from session
        fetch("/api/get_preselected_files")
          .then((response) => response.json())
          .then((data) => {
            if (data.success && data.files && data.files.length > 0) {
              window.preselectedFiles = data.files;

              // Now select the files
              selectFilesFromList(window.preselectedFiles);
            }
          })
          .catch((err) => console.error("Error fetching preselected files:", err));
      }
    } else {
      // We already have the list, use it directly
      selectFilesFromList(window.preselectedFiles);
    }

    function selectFilesFromList(fileList) {
      if (!fileList || !fileList.length) return;

      // Set BlockEvents to prevent multiple recalculations
      if (typeof BlockEvents !== "undefined") {
        BlockEvents.startBlocking();
      }

      fileCheckboxes.forEach((checkbox) => {
        const filePath = checkbox.value;

        // Check if this file is in the preselected list
        if (fileList.includes(filePath)) {
          checkbox.checked = true;
          hasSelectedFiles = true;
        }
      });

      // Stop blocking events
      if (typeof BlockEvents !== "undefined") {
        BlockEvents.stopBlocking();
      }

      // If any files were selected, recalculate tokens
      if (hasSelectedFiles) {
        setTimeout(() => {
          TokenCounter.recalculateTokens();
        }, 100);
      }
    }
  }

  // Initialize the select all button
  CheckboxHandler.initSelectAllButton();

  // Initialize search functionality
  SearchHandler.initSearch();

  // Set up next button to save token count
  const nextButton = document.getElementById("next-button");
  if (nextButton) {
    nextButton.addEventListener("click", function () {
      const hiddenTokenInput = document.getElementById("hidden-token-count");
      const totalTokensElement = document.getElementById("total-tokens");
      if (hiddenTokenInput && totalTokensElement) {
        hiddenTokenInput.value = totalTokensElement.textContent.replace(/,/g, "");
        console.log("Saved token count to hidden input:", hiddenTokenInput.value);
      }
    });
  }

  // Export functions to make them available for dynamically loaded content
  window.setupCheckboxes = CheckboxHandler.setupCheckboxes;
});
// Theme toggling functionality
document.addEventListener("DOMContentLoaded", function () {
  // Check for saved theme preference or use the system preference
  const savedTheme = localStorage.getItem("theme");
  const systemDarkMode = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;

  // Set theme based on saved preference or system default
  if (savedTheme) {
    document.documentElement.setAttribute("data-bs-theme", savedTheme);
    updateThemeIcon(savedTheme);
  } else if (systemDarkMode) {
    document.documentElement.setAttribute("data-bs-theme", "dark");
    updateThemeIcon("dark");
  }

  // Add event listener to theme toggle buttons (they might be on different pages)
  const themeToggleButtons = document.querySelectorAll(".theme-toggle");
  themeToggleButtons.forEach((button) => {
    button.addEventListener("click", toggleTheme);
  });
});

/**
 * Fetch and update the count of unsummarized files
 */
function initUnfamiliarFilesCounter() {
  // Find all unfamiliar files buttons
  const unfamiliarBtns = document.querySelectorAll(".unfamiliar-files-btn");

  if (unfamiliarBtns.length === 0) {
    return; // No buttons found, exit early
  }

  // Fetch the count from the API
  fetch("/api/count_unsummarized_files")
    .then((response) => {
      if (!response.ok) {
        throw new Error("Network response was not ok");
      }
      return response.json();
    })
    .then((data) => {
      const count = data.count || 0;

      // Update all unfamiliar files buttons
      unfamiliarBtns.forEach((btn) => {
        const countElement = btn.querySelector(".unfamiliar-count");

        if (count > 0) {
          // Update the count
          countElement.textContent = count;

          // Update the title/tooltip
          btn.setAttribute("title", `${count} unfamiliar file${count !== 1 ? "s" : ""}`);

          // Show the button
          btn.classList.remove("d-none");
        } else {
          // Hide the button if count is 0
          btn.classList.add("d-none");
        }
      });
    })
    .catch((error) => {
      console.error("Error fetching unfamiliar files count:", error);
      // Hide buttons on error
      unfamiliarBtns.forEach((btn) => btn.classList.add("d-none"));
    });
}

function toggleTheme() {
  const currentTheme = document.documentElement.getAttribute("data-bs-theme");
  const newTheme = currentTheme === "dark" ? "light" : "dark";

  // Update theme
  document.documentElement.setAttribute("data-bs-theme", newTheme);
  localStorage.setItem("theme", newTheme);

  // Update icons
  updateThemeIcon(newTheme);
}

function updateThemeIcon(theme) {
  const themeToggles = document.querySelectorAll(".theme-toggle");

  themeToggles.forEach((toggle) => {
    const moonIcon = toggle.querySelector(".fa-moon");
    const sunIcon = toggle.querySelector(".fa-sun");

    if (theme === "dark") {
      moonIcon.classList.add("d-none");
      sunIcon.classList.remove("d-none");
    } else {
      sunIcon.classList.add("d-none");
      moonIcon.classList.remove("d-none");
    }
  });
}
