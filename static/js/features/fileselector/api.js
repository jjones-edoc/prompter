/**
 * FileSelector API Module
 * Handles all API calls specific to file selection functionality
 */
const FileSelectorAPI = (function () {
  /**
   * Fetch directory structure from the server
   * @returns {Promise} Promise resolving to directory structure data
   */
  function fetchDirectoryStructure() {
    // Using the correct endpoint from routes.py: /api/get_complete_folder_tree
    // This will get all nested directories and files in one request
    return fetch("/api/get_complete_folder_tree", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        root_path: "", // Empty string for root directory
      }),
    })
      .then((response) => response.json())
      .then((data) => {
        // The response is already in the format expected by the FileSelector
        return data;
      })
      .catch((error) => {
        console.error("Error fetching directory structure:", error);
        return { error: "Failed to load directory structure." };
      });
  }

  /**
   * Search files for the given query
   * @param {string} query - Search query
   * @returns {Promise} Promise resolving to search results
   */
  function searchFiles(query) {
    const formData = new FormData();
    formData.append("search_query", query);

    return fetch("/api/search_files", {
      method: "POST",
      body: formData,
    })
      .then((response) => response.json())
      .catch((error) => {
        console.error("Error searching files:", error);
        return { error: "Failed to search files." };
      });
  }

  /**
   * Fetch token count for a folder
   * @param {string} folderPath - Path to folder
   * @returns {Promise} Promise resolving to token count
   */
  function fetchFolderTokenCount(folderPath) {
    const formData = new FormData();
    formData.append("folder_path", folderPath);

    return fetch("/api/get_folder_token_count", {
      method: "POST",
      body: formData,
    })
      .then((response) => response.json())
      .catch((error) => {
        console.error("Error fetching folder tokens:", error);
        return { error: "Failed to get folder token count." };
      });
  }

  // Public API
  return {
    fetchDirectoryStructure,
    searchFiles,
    fetchFolderTokenCount,
  };
})();
