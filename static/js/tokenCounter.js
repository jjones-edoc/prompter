/**
 * Token counting functionality for the Prompter application
 */

// Create a namespace for token counting
var TokenCounter = (function() {
  // Private variables
  let totalTokens = 0;
  let totalTokensElement = null;

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
    totalTokens += amount;
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
    totalTokens = amount;
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

        // Add to total tokens
        addTokens(data.token_count);
        
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
    fetchFolderTokenCount: fetchFolderTokenCount
  };
})();