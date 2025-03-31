/**
 * Generate Feature Handlers Module
 * Contains business logic and event handlers for prompt generation
 */
const GenerateHandlers = (function () {
  /**
   * Render the generate dialog
   */
  function renderGenerateDialog() {
    const state = StateManager.getState();
    const mainContent = document.getElementById("main-content");

    // Render the dialog with current state
    mainContent.innerHTML = GenerateDialog.render(state.generateDialogState);

    // Set up event listeners with callbacks
    GenerateDialog.setupEventListeners(createGenerateCallbacks());
  }

  /**
   * Setup generate dialog event listeners with standardized callbacks
   * @returns {Object} Standard callback object
   */
  function createGenerateCallbacks() {
    // Default callbacks
    return {
      // Add a new element to the prompt
      onAddElement: function (element) {
        StateManager.addPromptElement(element);

        // If it's a user prompt element, go to prompt dialog to edit it
        if (element.type === "userPrompt") {
          StateManager.setCurrentDialog("prompt");
          window.renderCurrentDialog();
        }
        // If it's a file selection element, go to file selector dialog
        else if (element.type === "selectedFiles") {
          StateManager.setCurrentDialog("fileSelector");
          window.renderCurrentDialog();
        } else {
          // For other element types, just re-render
          renderGenerateDialog();
        }
      },

      // Remove element from prompt
      onRemoveElement: function (index) {
        StateManager.removePromptElement(index);
        renderGenerateDialog();
      },

      // Edit an existing element
      onEditElement: function (index) {
        const state = StateManager.getState();
        const elements = state.generateDialogState.promptElements;

        if (index >= 0 && index < elements.length) {
          const element = elements[index];

          // Handle each element type differently
          if (element.type === "userPrompt") {
            // Go to prompt dialog to edit user prompt
            StateManager.updateDialogState("promptDialog", {
              userPrompt: element.content || "",
              editingElementIndex: index,
            });
            StateManager.setCurrentDialog("prompt");
            window.renderCurrentDialog();
          } else if (element.type === "selectedFiles") {
            // Go to file selector dialog to edit selected files
            // First update file selector state with current selections
            StateManager.updateDialogState("fileSelector", {
              selectedFiles: element.files || [],
              selectedFolders: element.folders || [],
              editingElementIndex: index,
            });
            StateManager.setCurrentDialog("fileSelector");
            window.renderCurrentDialog();
          } else {
            // Other element types don't need editing for now
            Utilities.showSnackBar(`No editor available for ${element.type} elements`, "info");
          }
        }
      },

      // Move element position
      onMoveElement: function (oldIndex, newIndex) {
        StateManager.reorderPromptElements(oldIndex, newIndex);
        renderGenerateDialog();
      },

      // Generate the final prompt
      onGeneratePrompt: function (callback) {
        generatePromptContent(callback);
      },

      // Go to prompt dialog to edit user prompt
      onEditPrompt: function (isCreatingNew = false) {
        // Find if there's an existing user prompt element
        const state = StateManager.getState();
        const elements = state.generateDialogState.promptElements;
        let userPromptIndex = elements.findIndex((el) => el.type === "userPrompt");

        if (userPromptIndex >= 0 && !isCreatingNew) {
          // Edit existing prompt element
          StateManager.updateDialogState("promptDialog", {
            userPrompt: elements[userPromptIndex].content || "",
            editingElementIndex: userPromptIndex,
            isCreatingNew: false,
          });
        } else {
          // Creating a new prompt element
          StateManager.updateDialogState("promptDialog", {
            userPrompt: "",
            editingElementIndex: -1,
            isCreatingNew: true,
          });
        }

        StateManager.setCurrentDialog("prompt");
        window.renderCurrentDialog();
      },

      // Go to file selector
      onSelectFiles: function (isCreatingNew = false) {
        // Find if there's an existing files element
        const state = StateManager.getState();
        const elements = state.generateDialogState.promptElements;
        let filesElementIndex = elements.findIndex((el) => el.type === "selectedFiles");

        if (filesElementIndex >= 0 && !isCreatingNew) {
          // Edit existing files element
          StateManager.updateDialogState("fileSelector", {
            selectedFiles: elements[filesElementIndex].files || [],
            selectedFolders: elements[filesElementIndex].folders || [],
            editingElementIndex: filesElementIndex,
            isCreatingNew: false,
          });
        } else {
          // Create new files element
          StateManager.updateDialogState("fileSelector", {
            selectedFiles: [],
            selectedFolders: [],
            editingElementIndex: -1,
            isCreatingNew: true,
          });
        }

        StateManager.setCurrentDialog("fileSelector");
        window.renderCurrentDialog();
      },

      // Go to response dialog
      onGoToResponse: function () {
        StateManager.setCurrentDialog("response");
        window.renderCurrentDialog();
      },

      // Copy prompt to clipboard
      onCopy: function () {
        // After copying, navigate to the response dialog
        StateManager.setCurrentDialog("response");
        window.renderCurrentDialog();
      },

      // Send the prompt to AI model
      onSendToAI: function (promptContent) {
        // Show loading snackbar
        Utilities.showSnackBar("Sending prompt to AI model...", "info");

        // Get settings from state
        const settings = StateManager.getState().settingsDialogState;
        const provider = settings.defaultProvider || "anthropic";
        const reasoningEffort = settings.reasoningEffort || "medium";

        // Update response dialog state to prepare for streaming
        StateManager.updateDialogState("responseDialog", {
          claudeResponse: "",
          processingResults: null, // Reset any previous processing results
          isStreaming: true, // Add streaming flag
        });

        // Go to response dialog immediately
        StateManager.setCurrentDialog("response");
        window.renderCurrentDialog();

        // Then start the streaming process
        const streamController = GenerateAPI.streamPromptToAI(
          promptContent,
          provider, // Use selected provider from settings
          reasoningEffort, // Use selected reasoning effort from settings
          // On chunk callback
          (chunk) => {
            // Get current response text
            const state = StateManager.getState();
            const currentText = state.responseDialogState.claudeResponse || "";

            // Update response dialog state with new chunk
            StateManager.updateDialogState("responseDialog", {
              claudeResponse: currentText + chunk,
            });

            // Update textarea if it exists (in case user is already on response page)
            const textArea = document.getElementById("claude-response");
            if (textArea) {
              textArea.value = currentText + chunk;
              // Scroll to bottom to follow the new content
              textArea.scrollTop = textArea.scrollHeight;
            }
          },
          // On complete callback
          () => {
            // Update the streaming flag
            StateManager.updateDialogState("responseDialog", {
              isStreaming: false,
            });

            // Show success message
            Utilities.showSnackBar("AI response received successfully!", "success");

            // Re-render to update UI elements that depend on streaming state
            window.renderCurrentDialog();
          },
          // On error callback
          (error) => {
            // Update streaming flag
            StateManager.updateDialogState("responseDialog", {
              isStreaming: false,
            });

            // Show error message
            Utilities.showSnackBar("Error streaming AI response: " + error, "error");

            // Re-render to update UI elements
            window.renderCurrentDialog();
          }
        );

        // Store stream controller in state so it can be canceled if needed
        StateManager.updateDialogState("responseDialog", {
          streamController: streamController,
        });
      },
    };
  }

  /**
   * Generate prompt content based on the current elements
   * @param {Function} callback - Optional callback to run after generation completes
   */
  function generatePromptContent(callback) {
    const state = StateManager.getState();
    const elements = state.generateDialogState.promptElements;

    if (!elements || elements.length === 0) {
      Utilities.showSnackBar("Please add at least one element to generate a prompt", "warning");
      return;
    }

    // Show loading snackbar
    Utilities.showSnackBar("Generating prompt...", "info");

    // Determine what to include in API call based on elements
    let userPrompt = "";
    let selectedFiles = [];
    let selectedFolders = [];
    let includePlanningPrompt = false;
    let includeCodeEditingPrompt = false;
    let includeDirectoryStructure = false;

    elements.forEach((element) => {
      switch (element.type) {
        case "userPrompt":
          userPrompt = element.content || "";
          break;
        case "selectedFiles":
          selectedFiles = element.files || [];
          selectedFolders = element.folders || [];
          break;
        case "codingPrompt":
          includeCodeEditingPrompt = true;
          break;
        case "planningPrompt":
          includePlanningPrompt = true;
          break;
        case "directoryStructure":
          includeDirectoryStructure = true;
          break;
      }
    });

    const options = {
      selectedFiles: selectedFiles,
      selectedFolders: selectedFolders,
      userPrompt: userPrompt,
      includePlanningPrompt: includePlanningPrompt,
      includeEditingPrompt: includeCodeEditingPrompt, // Renamed variable but keeping API parameter name the same
      includeDirectoryStructure: includeDirectoryStructure,
    };

    // Function to handle API response
    const handleGeneratedContent = (data) => {
      if (data.error) {
        Utilities.showSnackBar("Error generating prompt: " + data.error, "error");
        return;
      }

      // Update state with generated content
      StateManager.updateDialogState("generate", {
        generatedContent: data.combined_content,
      });

      // Update textarea
      const promptContent = document.getElementById("prompt-content");
      if (promptContent) {
        promptContent.value = data.combined_content;
      }

      // Show success snackbar
      Utilities.showSnackBar("Prompt generated successfully!", "success");

      // Execute callback if provided
      if (typeof callback === "function") {
        callback();
      }
    };

    // Call API to generate content
    GenerateAPI.generateModularContent(options).then(handleGeneratedContent);
  }

  // Public API
  return {
    renderGenerateDialog,
    generatePromptContent,
    createGenerateCallbacks,
  };
})();
