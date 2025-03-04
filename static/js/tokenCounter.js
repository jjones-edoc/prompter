/**
 * Token counting functionality for the Prompter application
 */

// Create a namespace for token counting
var TokenCounter = (function() {
  // Private variables
  let totalTokens = 0;
  let totalTokensElement = null;
  
  /**
   * Recalculate the total token count based on all selected files and folders
   */
  function recalculateTokens() {
    console.log("Recalculating total tokens...");
    // Reset the token count
    totalTokens = 0;
    
    // Track all file paths we've already counted to avoid duplicates
    const countedFilePaths = new Set();
    
    // Get all checked folder checkboxes first - these take precedence
    const checkedFolderCheckboxes = document.querySelectorAll('.folder-checkbox:checked');
    checkedFolderCheckboxes.forEach(checkbox => {
      const folderItem = checkbox.closest(".folder-item");
      const tokenBadge = folderItem.querySelector(".token-badge");
      const folderPath = checkbox.getAttribute("data-folder-path");
      
      // If folder has a token count, use it and mark all its files as counted
      if (tokenBadge) {
        const folderTokens = parseInt(tokenBadge.getAttribute("data-folder-tokens") || 0);
        if (!isNaN(folderTokens) && folderTokens > 0) {
          totalTokens += folderTokens;
          
          // Mark all files in this folder as counted
          const fileCheckboxes = folderItem.querySelectorAll(".file-checkbox");
          fileCheckboxes.forEach(fileCheckbox => {
            countedFilePaths.add(fileCheckbox.value);
          });
        }
      }
    });
    
    // Now add tokens for any checked files that aren't in counted folders
    const checkedFileCheckboxes = document.querySelectorAll('.file-checkbox:checked');
    checkedFileCheckboxes.forEach(checkbox => {
      const filePath = checkbox.value;
      
      // Skip if this file was already counted as part of a folder
      if (countedFilePaths.has(filePath)) {
        return;
      }
      
      const tokenEstimate = parseInt(checkbox.getAttribute("data-token-estimate") || 0);
      if (!isNaN(tokenEstimate)) {
        totalTokens += tokenEstimate;
      }
    });
    
    console.log(`Recalculated total tokens: ${totalTokens}`);
    updateTotalTokens();
  }

  /**
   * Initialize the token counter
   */
  function initTokenCounter() {
    totalTokensElement = document.getElementById("total-tokens");
    updateTotalTokens();
  }

  /**
   * Add tokens to the total count
   * @param {number} amount - The number of tokens to add
   */
  function addTokens(amount) {
    if (isNaN(amount)) {
      console.warn("Attempted to add NaN tokens");
      return;
    }
    amount = parseInt(amount);
    totalTokens += amount;
    console.log(`Added ${amount} tokens, new total: ${totalTokens}`);
    updateTotalTokens();
  }

  /**
   * Subtract tokens from the total count
   * @param {number} amount - The number of tokens to subtract
   */
  function subtractTokens(amount) {
    totalTokens -= amount;
    updateTotalTokens();
  }

  /**
   * Set the total tokens to a specific value
   * @param {number} amount - The new total token count
   */
  function setTotalTokens(amount) {
    if (isNaN(amount)) {
      console.warn("Attempted to set tokens to NaN");
      return;
    }
    amount = parseInt(amount);
    totalTokens = amount;
    console.log(`Set total tokens to: ${totalTokens}`);
    updateTotalTokens();
  }

  /**
   * Update the total tokens display in the UI
   */
  function updateTotalTokens() {
    if (totalTokensElement) {
      totalTokensElement.textContent = totalTokens.toLocaleString();

      const badgeElement = totalTokensElement.closest(".badge");
      if (!badgeElement) return;

      // Change color based on token count
      if (totalTokens > 100000) {
        badgeElement.classList.remove("bg-info", "text-dark", "bg-warning");
        badgeElement.classList.add("bg-danger", "text-white");
      } else if (totalTokens > 50000) {
        badgeElement.classList.remove("bg-info", "text-dark", "bg-danger");
        badgeElement.classList.add("bg-warning", "text-dark");
      } else {
        badgeElement.classList.remove("bg-warning", "bg-danger", "text-white");
        badgeElement.classList.add("bg-info", "text-dark");
      }
    }
    
    // Update hidden form field if it exists
    const hiddenTokenInput = document.getElementById("hidden-token-count");
    if (hiddenTokenInput) {
      hiddenTokenInput.value = totalTokens;
    }
  }

  /**
   * Fetch token count for a folder from the server
   * @param {string} folderPath - The path of the folder
   * @param {HTMLElement} badgeElement - The badge element to update
   * @returns {Promise} - Promise that resolves with the token count
   */
  function fetchFolderTokenCount(folderPath, badgeElement) {
    // Create form data for the request
    const formData = new FormData();
    formData.append("folder_path", folderPath);

    return fetch("/api/get_folder_token_count", {
      method: "POST",
      body: formData,
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json();
      })
      .then((data) => {
        if (data.error) {
          console.error("Error fetching token count:", data.error);
          return 0;
        }

        // Update the badge with the token count
        badgeElement.textContent = `${data.token_count} tokens`;
        badgeElement.setAttribute("data-folder-tokens", data.token_count);

        // Recalculate total tokens instead of just adding
        recalculateTokens();
        
        return data.token_count;
      })
      .catch((error) => {
        console.error("Error fetching folder token count:", error);
        return 0;
      });
  }

  // Return public functions
  return {
    initTokenCounter: initTokenCounter,
    addTokens: addTokens,
    subtractTokens: subtractTokens,
    setTotalTokens: setTotalTokens,
    fetchFolderTokenCount: fetchFolderTokenCount,
    recalculateTokens: recalculateTokens
  };
})();