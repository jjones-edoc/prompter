/**
 * DialogControllers.js
 * Contains controller functions for all dialogs
 */
const DialogControllers = (function () {
  /**
   * Render the prompt dialog
   */
  function renderPromptDialog() {
    const mainContent = document.getElementById("main-content");
    const state = StateManager.getState();
    mainContent.innerHTML = PromptDialog.render(state.promptDialogState);

    PromptDialog.setupEventListeners({
      onSubmit: function (promptData) {
        const editingElementIndex = state.promptDialogState.editingElementIndex;
        const isCreatingNew = state.promptDialogState.isCreatingNew;

        // Only proceed if the prompt has content
        if (promptData.prompt && promptData.prompt.trim() !== "") {
          // Check if we're editing an existing prompt element
          if (!isCreatingNew && editingElementIndex !== undefined && editingElementIndex !== null && editingElementIndex >= 0) {
            // Update existing element
            StateManager.updatePromptElement(editingElementIndex, {
              content: promptData.prompt,
            });
          } else {
            // Add new user prompt element
            StateManager.addPromptElement({
              type: "userPrompt",
              id: `userPrompt-${Date.now()}`,
              content: promptData.prompt,
            });
          }
        }

        // Reset editing state
        StateManager.updateDialogState("promptDialog", {
          editingElementIndex: null,
          isCreatingNew: false,
        });

        // Go back to generate dialog
        StateManager.setCurrentDialog("generate");
        renderCurrentDialog();
      },

      onCancel: function () {
        // Reset editing state before returning to generate dialog
        StateManager.updateDialogState("promptDialog", {
          editingElementIndex: null,
          isCreatingNew: false,
        });

        // Go back to generate dialog without saving changes
        StateManager.setCurrentDialog("generate");
        renderCurrentDialog();
      },
    });
  }

  /**
   * Render the response dialog
   */
  function renderResponseDialog() {
    const mainContent = document.getElementById("main-content");
    const state = StateManager.getState();

    // Add settings info to response dialog state
    const responseState = {
      ...state.responseDialogState,
      provider: state.settingsDialogState.defaultProvider,
      reasoningEffort: state.settingsDialogState.reasoningEffort,
    };

    console.log("Rendering response dialog, state:", responseState);
    mainContent.innerHTML = ResponseDialog.render(responseState);

    ResponseDialog.setupEventListeners({
      onProcess: function (data) {
        // Process Claude's response
        if (data && data.claudeResponse) {
          StateManager.updateDialogState("response", {
            claudeResponse: data.claudeResponse,
          });

          processClaudeResponse(data.claudeResponse);
        }
      },
      onDone: function () {
        // Go back to generate dialog
        StateManager.setCurrentDialog("generate");
        renderCurrentDialog();
      },
    });
  }

  /**
   * Process Claude's response
   * @param {string} response - Claude's response text
   */
  function processClaudeResponse(response) {
    // Show processing status
    const processResults = document.getElementById("process-results");
    if (processResults) {
      processResults.innerHTML = `
        <div class="alert alert-info">
          <i class="fas fa-spinner fa-spin me-2"></i> Processing response...
        </div>
      `;
    }

    // Show info snackbar
    Utilities.showSnackBar("Processing Claude's response...", "info");

    ApiService.processClaudeResponse(response)
      .then((data) => {
        // Update state with processing results
        StateManager.updateDialogState("responseDialog", { processingResults: data });

        // Show success or error message
        if (data.success) {
          Utilities.showSnackBar(`Successfully processed ${data.success_count} edit(s)`, "success");
        } else if (data.error) {
          Utilities.showSnackBar(`Error: ${data.error}`, "error");
        } else if (data.error_count > 0) {
          Utilities.showSnackBar(`Completed with ${data.error_count} error(s)`, "warning");
        }

        // Re-render the response dialog to reflect updated state
        renderResponseDialog();
      })
      .catch((error) => {
        console.error("Error processing response:", error);

        // Show error in the UI
        if (processResults) {
          processResults.innerHTML = `
          <div class="alert alert-danger">
            <strong>Error:</strong> Failed to process response. See console for details.
          </div>
        `;
        }

        Utilities.showSnackBar("Failed to process response", "error");
      });
  }

  /**
   * Render the settings dialog
   */
  function renderSettingsDialog() {
    const state = StateManager.getState();
    const mainContent = document.getElementById("main-content");

    // Check if we don't have available models yet, fetch them
    if (!state.settingsDialogState.availableModels || Object.keys(state.settingsDialogState.availableModels).length === 0) {
      // Show loading state
      mainContent.innerHTML = `
        <div class="card shadow-sm mb-4">
          <div class="card-header card-header-themed">
            <h2 class="h4 mb-0">Settings</h2>
          </div>
          <div class="card-body">
            <div class="text-center py-4">
              <i class="fas fa-spinner fa-spin me-2"></i> Loading available AI models...
            </div>
          </div>
        </div>
      `;

      // Fetch available models from the API
      fetch("/api/get_available_models")
        .then((response) => response.json())
        .then((data) => {
          // Get values from cookies first, fall back to API defaults or state defaults
          const getCookie = StateManager.getCookie;
          const defaultProvider = getCookie("defaultProvider") || data.default_provider || state.settingsDialogState.defaultProvider;
          const reasoningEffort = getCookie("reasoningEffort") || data.default_reasoning_effort || state.settingsDialogState.reasoningEffort;

          // Update settings state with available models
          StateManager.updateDialogState("settingsDialog", {
            availableModels: data.available_models || {},
            defaultProvider: defaultProvider,
            reasoningEffort: reasoningEffort,
          });

          // Re-render settings dialog with fetched data
          renderSettingsDialog();
        })
        .catch((error) => {
          console.error("Error fetching available models:", error);

          // Show error and continue with empty models list
          Utilities.showSnackBar("Error loading available AI models. Check your API keys and server configuration.", "error");

          // Render settings dialog anyway, but without models
          mainContent.innerHTML = SettingsDialog.render(state.settingsDialogState);
          setupSettingsEventListeners();
        });
    } else {
      // Render settings dialog with current state
      mainContent.innerHTML = SettingsDialog.render(state.settingsDialogState);
      setupSettingsEventListeners();
    }
  }

  /**
   * Set up event listeners for the settings dialog
   */
  function setupSettingsEventListeners() {
    SettingsDialog.setupEventListeners({
      // Save settings
      onSave: function (newSettings) {
        // Update the settings in state and localStorage
        StateManager.updateSettings({
          theme: newSettings.theme,
          defaultProvider: newSettings.aiModel,
          reasoningEffort: newSettings.reasoningEffort,
        });

        // Apply theme change immediately
        applyTheme(newSettings.theme);

        // Show success message
        Utilities.showSnackBar("Settings saved successfully!", "success");

        // Go back to previous dialog (usually generate)
        StateManager.setCurrentDialog("generate");
        renderCurrentDialog();
      },

      // Cancel without saving
      onCancel: function () {
        // Revert any theme preview changes
        applyTheme(StateManager.getState().settingsDialogState.theme);

        // Go back to generate dialog
        StateManager.setCurrentDialog("generate");
        renderCurrentDialog();
      },

      // Real-time theme preview
      onThemePreview: function (theme) {
        applyTheme(theme);
      },
    });
  }

  /**
   * Apply theme to document and update icons
   * @param {string} theme - Theme to apply ('light', 'dark', or 'system')
   */
  function applyTheme(theme) {
    // Handle system preference
    if (theme === "system") {
      // Use system preference
      const prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
      document.documentElement.setAttribute("data-bs-theme", prefersDark ? "dark" : "light");

      // Add event listener for system preference changes
      window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", (e) => {
        if (StateManager.getState().settingsDialogState.theme === "system") {
          document.documentElement.setAttribute("data-bs-theme", e.matches ? "dark" : "light");
          updateThemeIcons(e.matches ? "dark" : "light");
        }
      });
    } else {
      // Apply explicit theme
      document.documentElement.setAttribute("data-bs-theme", theme);
    }

    // Update theme toggle icons in header
    updateThemeIcons(theme === "system" ? (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light") : theme);
  }

  /**
   * Update theme icons in the header
   * @param {string} activeTheme - Active theme ('light' or 'dark')
   */
  function updateThemeIcons(activeTheme) {
    const moonIcon = document.querySelector(".theme-toggle .fa-moon");
    const sunIcon = document.querySelector(".theme-toggle .fa-sun");

    if (moonIcon && sunIcon) {
      if (activeTheme === "dark") {
        moonIcon.classList.add("d-none");
        sunIcon.classList.remove("d-none");
      } else {
        sunIcon.classList.add("d-none");
        moonIcon.classList.remove("d-none");
      }
    }
  }

  // Public API
  return {
    renderPromptDialog,
    renderResponseDialog,
    renderSettingsDialog,
    processClaudeResponse,
  };
})();
