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
  
  // Initialize the unfamiliar files counter
  initUnfamiliarFilesCounter();
  
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
// Theme toggling functionality
document.addEventListener('DOMContentLoaded', function() {
  // Check for saved theme preference or use the system preference
  const savedTheme = localStorage.getItem('theme');
  const systemDarkMode = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  
  // Set theme based on saved preference or system default
  if (savedTheme) {
    document.documentElement.setAttribute('data-bs-theme', savedTheme);
    updateThemeIcon(savedTheme);
  } else if (systemDarkMode) {
    document.documentElement.setAttribute('data-bs-theme', 'dark');
    updateThemeIcon('dark');
  }

  // Add event listener to theme toggle buttons (they might be on different pages)
  const themeToggleButtons = document.querySelectorAll('.theme-toggle');
  themeToggleButtons.forEach(button => {
    button.addEventListener('click', toggleTheme);
  });
});

/**
 * Fetch and update the count of unsummarized files
 */
function initUnfamiliarFilesCounter() {
  // Find all unfamiliar files buttons
  const unfamiliarBtns = document.querySelectorAll('.unfamiliar-files-btn');
  
  if (unfamiliarBtns.length === 0) {
    return; // No buttons found, exit early
  }
  
  // Fetch the count from the API
  fetch('/api/count_unsummarized_files')
    .then(response => {
      if (!response.ok) {
        throw new Error('Network response was not ok');
      }
      return response.json();
    })
    .then(data => {
      const count = data.count || 0;
      
      // Update all unfamiliar files buttons
      unfamiliarBtns.forEach(btn => {
        const countElement = btn.querySelector('.unfamiliar-count');
        
        if (count > 0) {
          // Update the count
          countElement.textContent = count;
          
          // Update the title/tooltip
          btn.setAttribute('title', `${count} unfamiliar file${count !== 1 ? 's' : ''}`);
          
          // Show the button
          btn.classList.remove('d-none');
        } else {
          // Hide the button if count is 0
          btn.classList.add('d-none');
        }
      });
    })
    .catch(error => {
      console.error('Error fetching unfamiliar files count:', error);
      // Hide buttons on error
      unfamiliarBtns.forEach(btn => btn.classList.add('d-none'));
    });
}

function toggleTheme() {
  const currentTheme = document.documentElement.getAttribute('data-bs-theme');
  const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
  
  // Update theme
  document.documentElement.setAttribute('data-bs-theme', newTheme);
  localStorage.setItem('theme', newTheme);
  
  // Update icons
  updateThemeIcon(newTheme);
}

function updateThemeIcon(theme) {
  const themeToggles = document.querySelectorAll('.theme-toggle');
  
  themeToggles.forEach(toggle => {
    const moonIcon = toggle.querySelector('.fa-moon');
    const sunIcon = toggle.querySelector('.fa-sun');
    
    if (theme === 'dark') {
      moonIcon.classList.add('d-none');
      sunIcon.classList.remove('d-none');
    } else {
      sunIcon.classList.add('d-none');
      moonIcon.classList.remove('d-none');
    }
  });
}
