/**
 * Generate Feature API Module
 * Handles all API calls specific to prompt generation functionality
 */
const GenerateAPI = (function () {
  /**
   * Fetch directory structure from the server specifically for prompt generation
   * @returns {Promise} Promise resolving to directory structure data for prompt generation
   */
  function fetchDirectoryStructureForPrompt() {
    // Use the directory-structure endpoint which already provides formatted output
    return fetch("/api/directory-structure", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        max_depth: 5, // Use default depth of 5
      }),
    })
      .then((response) => response.json())
      .then((data) => {
        // The directory structure is already formatted properly by the backend
        return data.directory_structure;
      })
      .catch((error) => {
        console.error("Error fetching directory structure for prompt:", error);
        return { error: "Failed to load directory structure for prompt." };
      });
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
    return GeneratePrompts.getEditingPrompt();
  }

  /**
   * Fetch editing prompt from the server
   * @returns {Promise} Promise resolving to editing prompt
   */
  function fetchEditingPrompt() {
    return GeneratePrompts.getPlanningPrompt();
  }

  /**
   * Generate content using the modular endpoints
   * @param {Object} options - Options for generating content
   * @returns {Promise} Promise resolving to combined content
   */
  function generateModularContent(options) {
    // Create an array to hold all our promises
    const promises = [];
    let promiseResults = {};

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
      promises.push(
        fetchFileData({
          selectedFiles: options.selectedFiles,
          selectedFolders: options.selectedFolders,
        }).then((data) => {
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
        if (options.includePlanningPrompt) {
          combinedContent += GeneratePrompts.getPlanningPrompt() + "\n\n";
        }

        // Add editing prompt if requested
        if (options.includeEditingPrompt) {
          combinedContent += GeneratePrompts.getEditingPrompt() + "\n\n";
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

        // Add user prompt if available
        if (options.userPrompt && options.userPrompt.trim() !== "") {
          // Add user prompt at the end or wherever appropriate in your workflow
          combinedContent += "### User Instructions:\n\n";
          combinedContent += options.userPrompt + "\n\n";
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
   * Send prompt to AI model and get response
   * @param {string} prompt - The prompt to send to the AI model
   * @param {string} provider - The AI provider to use (default: 'anthropic')
   * @param {string} reasoningEffort - Reasoning effort level (default: 'medium')
   * @returns {Promise} Promise resolving to AI response
   */
  function sendPromptToAI(prompt, provider = "anthropic", reasoningEffort = "medium") {
    const requestData = {
      prompt: prompt,
      provider: provider,
      reasoning_effort: reasoningEffort,
    };

    return fetch("/api/get_ai_response", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestData),
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json();
      })
      .catch((error) => {
        console.error("Error getting AI response:", error);
        return { error: `Failed to get AI response: ${error.message}` };
      });
  }

  /**
   * Stream prompt to AI model and get response in real-time
   * @param {string} prompt - The prompt to send to the AI model
   * @param {string} provider - The AI provider to use (default: 'anthropic')
   * @param {string} reasoningEffort - Reasoning effort level (default: 'medium')
   * @param {Function} onChunk - Callback for each chunk of text received
   * @param {Function} onComplete - Callback when streaming is complete
   * @param {Function} onError - Callback when an error occurs
   * @returns {Object} Object with close method to cancel the stream
   */
  function streamPromptToAI(prompt, provider = "anthropic", reasoningEffort = "medium", onChunk, onComplete, onError) {
    console.log("Streaming prompt with settings:", { provider, reasoningEffort });
    const requestData = {
      prompt: prompt,
      provider: provider,
      reasoning_effort: reasoningEffort,
    };

    // Create a fetch request to set up the event stream
    const controller = new AbortController();
    const { signal } = controller;

    fetch("/api/stream_ai_response", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestData),
      signal,
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`HTTP error! Status: ${response.status}`);
        }

        // We need to process the stream manually
        const reader = response.body.getReader();
        const decoder = new TextDecoder("utf-8");

        // Storage for incomplete event data
        let buffer = "";

        // Function to process the stream
        function processStream() {
          return reader
            .read()
            .then(({ done, value }) => {
              // If the stream is done, call the completion callback
              if (done) {
                if (onComplete) onComplete();
                return;
              }

              // Decode the chunk and add it to our buffer
              buffer += decoder.decode(value, { stream: true });

              // Process complete events in the buffer
              let eventEnd = buffer.indexOf("\n\n");
              while (eventEnd >= 0) {
                const eventData = buffer.substring(0, eventEnd);
                buffer = buffer.substring(eventEnd + 2);

                // Parse the event data
                const eventLines = eventData.split("\n");
                let event = "message";
                let data = "";

                for (const line of eventLines) {
                  if (line.startsWith("event: ")) {
                    event = line.substring(7);
                  } else if (line.startsWith("data: ")) {
                    data = line.substring(6);
                  }
                }

                // Handle different event types
                if (event === "message" && data && onChunk) {
                  onChunk(data);
                } else if (event === "metrics" && data) {
                  try {
                    const metrics = JSON.parse(data);
                    console.log("Stream metrics:", metrics);
                  } catch (e) {
                    console.error("Error parsing metrics:", e);
                  }
                } else if (event === "error" && data && onError) {
                  onError(data);
                } else if (event === "done" && onComplete) {
                  onComplete();
                }

                // Look for the next event
                eventEnd = buffer.indexOf("\n\n");
              }

              // Continue processing the stream
              return processStream();
            })
            .catch((error) => {
              if (onError) onError(error.message);
            });
        }

        // Start processing the stream
        processStream();
      })
      .catch((error) => {
        if (onError) onError(error.message);
      });

    // Return an object that can be used to cancel the stream
    return {
      close: () => {
        controller.abort();
      },
    };
  }

  // Public API
  return {
    fetchDirectoryStructureForPrompt,
    fetchFileData,
    fetchPlanningPrompt,
    fetchEditingPrompt,
    generateModularContent,
    sendPromptToAI,
    streamPromptToAI,
  };
})();
