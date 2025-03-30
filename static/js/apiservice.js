/**
 * API Service
 * Handles all communication with the backend API
 */
const ApiService = (function () {
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
   * Fetch directory structure from the server specifically for prompt generation
   * This is different from fetchDirectoryStructure() which is used for file selection
   * @returns {Promise} Promise resolving to directory structure data for prompt generation
   */
  function fetchDirectoryStructureForPrompt() {
    // For complete directory tree, we should use get_complete_folder_tree endpoint
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
        // Convert the tree format to the string format expected by the prompt
        return formatDirectoryStructure(data);
      })
      .catch((error) => {
        console.error("Error fetching directory structure for prompt:", error);
        return { error: "Failed to load directory structure for prompt." };
      });
  }

  /**
   * Format directory structure into a string representation
   * @param {Object} tree - Directory tree structure
   * @param {string} indent - Current indentation level
   * @returns {string} Formatted directory structure
   */
  function formatDirectoryStructure(tree, indent = "") {
    let result = `${indent}${tree.name}/\n`;

    // Add all directories
    if (tree.dirs && tree.dirs.length > 0) {
      tree.dirs.forEach((dir) => {
        result += formatDirectoryStructure(dir, indent + "  ");
      });
    }

    // Add all files
    if (tree.files && tree.files.length > 0) {
      tree.files.forEach((file) => {
        result += `${indent}  ${file.name}\n`;
      });
    }

    return result;
  }

  /**
   * Fetch file data from the server
   * @param {Object} options - Options for generating content
   * @returns {Promise} Promise resolving to file data
   */
  function fetchFileData(options) {
    const formData = new FormData();

    // Add selected files
    if (options.selectedFiles && options.selectedFiles.length > 0) {
      options.selectedFiles.forEach((file) => {
        formData.append("selected_files", file);
      });
    }

    // Add selected folders
    if (options.selectedFolders && options.selectedFolders.length > 0) {
      options.selectedFolders.forEach((folder) => {
        formData.append("selected_folder", folder);
      });
    }

    return fetch("/api/file-data", {
      method: "POST",
      body: formData,
    })
      .then((response) => response.json())
      .catch((error) => {
        console.error("Error fetching file data:", error);
        return { error: "Failed to load file data." };
      });
  }

  /**
   * Fetch planning prompt from the server
   * @returns {Promise} Promise resolving to planning prompt
   */
  function fetchPlanningPrompt() {
    return fetch("/api/planning-prompt")
      .then((response) => response.json())
      .catch((error) => {
        console.error("Error fetching planning prompt:", error);
        return { error: "Failed to load planning prompt." };
      });
  }

  /**
   * Fetch editing prompt from the server
   * @returns {Promise} Promise resolving to editing prompt
   */
  function fetchEditingPrompt() {
    return fetch("/api/editing-prompt")
      .then((response) => response.json())
      .catch((error) => {
        console.error("Error fetching editing prompt:", error);
        return { error: "Failed to load editing prompt." };
      });
  }

  // generateCombinedContent function removed as it's no longer used

  /**
   * Generate content using the new modular endpoints
   * @param {Object} options - Options for generating content
   * @returns {Promise} Promise resolving to combined content
   */
  function generateModularContent(options) {
    // Create an array to hold all our promises
    const promises = [];
    let promiseResults = {};

    // Add promises for the elements we need
    if (options.includePlanningPrompt) {
      promises.push(
        fetchPlanningPrompt().then((data) => {
          promiseResults.planningPrompt = data.planning_prompt || "";
          return data;
        })
      );
    }

    if (options.includeEditingPrompt) {
      promises.push(
        fetchEditingPrompt().then((data) => {
          promiseResults.editingPrompt = data.editing_prompt || "";
          return data;
        })
      );
    }

    if (options.includeDirectoryStructure) {
      promises.push(
        fetchDirectoryStructureForPrompt().then((directoryStructure) => {
          promiseResults.directoryStructure = directoryStructure;
          return directoryStructure;
        })
      );
    }

    // Only fetch file data if we have files or folders
    if ((options.selectedFiles && options.selectedFiles.length > 0) || (options.selectedFolders && options.selectedFolders.length > 0)) {
      const formData = new FormData();

      // Add selected files
      if (options.selectedFiles && options.selectedFiles.length > 0) {
        options.selectedFiles.forEach((file) => {
          formData.append("selected_files", file);
        });
      }

      // Add selected folders
      if (options.selectedFolders && options.selectedFolders.length > 0) {
        options.selectedFolders.forEach((folder) => {
          formData.append("selected_folder", folder);
        });
      }

      promises.push(
        fetch("/api/file-data", {
          method: "POST",
          body: formData,
        })
          .then((response) => response.json())
          .then((data) => {
            promiseResults.fileData = data.files || [];
            return data;
          })
      );
    }

    // Wait for all promises to resolve
    return Promise.all(promises)
      .then(() => {
        // Construct the combined content
        let combinedContent = "";

        // Add planning prompt if requested
        if (options.includePlanningPrompt && promiseResults.planningPrompt) {
          combinedContent += promiseResults.planningPrompt + "\n\n";
        }

        // Add editing prompt if requested
        if (options.includeEditingPrompt && promiseResults.editingPrompt) {
          combinedContent += promiseResults.editingPrompt + "\n\n";
        }

        // Add directory structure if requested
        if (options.includeDirectoryStructure && promiseResults.directoryStructure) {
          combinedContent += "### Project Structure:\n\n```\n";
          combinedContent += promiseResults.directoryStructure;
          combinedContent += "\n```\n\n";
        }

        // Add file data if available
        if (promiseResults.fileData && promiseResults.fileData.length > 0) {
          combinedContent += "### List of files:\n\n";
          promiseResults.fileData.forEach((file) => {
            combinedContent += `File: ${file.path}\n\`\`\`${file.language}\n${file.content}\n\`\`\`\n\n`;
          });
        }

        // Return the combined content
        return {
          combined_content: combinedContent,
          token_estimate: combinedContent.length / 4, // Simple token estimate
        };
      })
      .catch((error) => {
        console.error("Error generating modular content:", error);
        return { error: "Failed to generate content using modular endpoints." };
      });
  }

  /**
 * Process Claude's response
 * @param {string} claudeResponse - Claude's response
 * @returns {Promise} Promise resolving to processing results
 */
function processClaudeResponse(claudeResponse) {
  const formData = new FormData();
  formData.append("claude_response", claudeResponse);

  return fetch("/api/process_claude_response", {
    method: "POST",
    body: formData,
  })
    .then((response) => {
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return response.json();
    })
    .catch((error) => {
      console.error("Error processing Claude's response:", error);
      return { error: `Failed to process Claude's response: ${error.message}` };
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
    fetchDirectoryStructureForPrompt,
    fetchFileData,
    fetchPlanningPrompt,
    fetchEditingPrompt,
    generateModularContent,
    processClaudeResponse,
    searchFiles,
    fetchFolderTokenCount,
  };
})();
