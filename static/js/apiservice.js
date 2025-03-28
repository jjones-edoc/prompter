/**
 * Handles all API interactions for the application
 */
const ApiService = (function () {
  /**
   * Fetch the complete directory structure
   * @returns {Promise} Promise that resolves to directory structure data
   */
  function fetchDirectoryStructure() {
    return Utilities.fetchJSON(
      "/api/get_complete_folder_tree",
      {
        method: "POST",
        body: new FormData(),
      },
      (data) => data,
      (error) => {
        console.error("Error fetching directory structure:", error);
        Utilities.showError("Failed to load directory structure. Please try again.");
      }
    );
  }

  /**
   * Fetch token count for a folder
   * @param {string} folderPath - Path of folder to get token count for
   * @returns {Promise} Promise that resolves to token count data
   */
  function fetchFolderTokenCount(folderPath) {
    const formData = new FormData();
    formData.append("folder_path", folderPath);

    return Utilities.fetchJSON(
      "/api/get_folder_token_count",
      { method: "POST", body: formData },
      (data) => data,
      (error) => {
        console.error("Error fetching folder token count:", error);
        return { error: error.message || "Failed to fetch token count" };
      }
    );
  }

  /**
   * Search files by query
   * @param {string} query - Search query
   * @returns {Promise} Promise that resolves to search results
   */
  function searchFiles(query) {
    const formData = new FormData();
    formData.append("search_query", query);

    return Utilities.fetchJSON(
      "/api/search_files",
      { method: "POST", body: formData },
      (data) => data,
      (error) => {
        console.error("Error searching files:", error);
        return {
          error: error.message || "Unknown error occurred",
          query: query,
        };
      }
    );
  }

  /**
   * Generate combined content for prompt
   * @param {Object} options - Generation options
   * @returns {Promise} Promise that resolves to generated content
   */
  function generateCombinedContent(options) {
    const formData = new FormData();

    // Add selected files
    options.selectedFiles.forEach((file) => {
      formData.append("selected_files", file);
    });

    // Add selected folders
    options.selectedFolders.forEach((folder) => {
      formData.append("selected_folder", folder);
    });

    // Add prompt options
    formData.append("user_prompt", options.userPrompt);
    formData.append("include_coding_prompt", options.includeCodingPrompt ? "1" : "0");
    formData.append("include_directory_structure", options.includeDirectoryStructure ? "1" : "0");

    return Utilities.fetchJSON(
      "/api/generate",
      {
        method: "POST",
        body: formData,
      },
      (data) => {
        if (data.error) {
          throw new Error(data.error);
        }
        return data;
      },
      (error) => {
        console.error("Error generating content:", error);
        Utilities.showError("Failed to generate content. Please try again.");
        return { error: error.message || "Failed to generate content" };
      }
    );
  }

  /**
   * Process Claude's response
   * @param {string} response - Claude's response text
   * @returns {Promise} Promise that resolves to processing results
   */
  function processClaudeResponse(response) {
    return Utilities.fetchJSON(
      "/api/process_claude_response",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          claude_response: response,
        }),
      },
      (data) => data,
      (error) => {
        console.error("Error processing response:", error);
        return { error: error.message || "Failed to process response" };
      }
    );
  }

  // Public API
  return {
    fetchDirectoryStructure,
    fetchFolderTokenCount,
    searchFiles,
    generateCombinedContent,
    processClaudeResponse,
  };
})();
