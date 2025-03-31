/**
 * API Service
 * Handles common API calls that are used across multiple features
 */
const ApiService = (function () {
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

  /* Stream prompt to AI model and get response in real-time
   * @param {string} prompt - The prompt to send to the AI model
   * @param {string} provider - The AI provider to use (default: 'anthropic')
   * @param {string} reasoningEffort - Reasoning effort level (default: 'medium')
   * @param {Function} onChunk - Callback for each chunk of text received
   * @param {Function} onComplete - Callback when streaming is complete
   * @param {Function} onError - Callback when an error occurs
   * @returns {EventSource} The event source object that can be closed to cancel the stream
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
    processClaudeResponse,
    sendPromptToAI,
    streamPromptToAI,
  };
})();
