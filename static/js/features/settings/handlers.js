/**
 * Settings Feature Handlers Module
 * Contains business logic and event handlers for settings functionality
 */
const SettingsHandlers = (function () {
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
      SettingsAPI.fetchAvailableModels()
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
        window.renderCurrentDialog();
      },

      // Cancel without saving
      onCancel: function () {
        // Revert any theme preview changes
        applyTheme(StateManager.getState().settingsDialogState.theme);

        // Go back to generate dialog
        StateManager.setCurrentDialog("generate");
        window.renderCurrentDialog();
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
    renderSettingsDialog,
    applyTheme,
  };
})();
