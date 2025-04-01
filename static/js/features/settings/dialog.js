/**
 * Settings Dialog Module
 * Handles UI rendering and user interaction for settings
 */
const SettingsDialog = (function () {
  /**
   * Render the settings dialog
   * @param {Object} state - Current settings state
   * @returns {string} HTML for the settings dialog
   */
  function render(state) {
    return `
        <div class="card shadow-sm mb-4">
          <div class="card-header card-header-themed">
            <h2 class="h4 mb-0">Settings</h2>
          </div>
          <div class="card-body">
            <form id="settings-form">
              <!-- Theme Selection -->
              <div class="mb-4">
                <label for="theme-select" class="form-label">Theme</label>
                <select id="theme-select" class="form-select">
                  <option value="light" ${state.theme === "light" ? "selected" : ""}>Light</option>
                  <option value="dark" ${state.theme === "dark" ? "selected" : ""}>Dark</option>
                  <option value="system" ${state.theme === "system" ? "selected" : ""}>System Default</option>
                </select>
                <div class="form-text">Choose your preferred appearance theme.</div>
              </div>
  
              <!-- AI Model Selection -->
              <div class="mb-4">
                <label for="ai-model-select" class="form-label">AI Model</label>
                <select id="ai-model-select" class="form-select" ${state.availableModels && Object.keys(state.availableModels).length > 0 ? "" : "disabled"}>
                  ${renderModelOptions(state.availableModels, state.defaultProvider)}
                </select>
                <div class="form-text">Select which AI model to use when sending prompts.</div>
              </div>
  
              <!-- Reasoning Effort Selection -->
              <div class="mb-4">
                <label for="reasoning-effort-select" class="form-label">Reasoning Effort</label>
                <select id="reasoning-effort-select" class="form-select">
                  <option value="low" ${state.reasoningEffort === "low" ? "selected" : ""}>Low - Faster responses</option>
                  <option value="medium" ${state.reasoningEffort === "medium" ? "selected" : ""}>Medium - Balanced</option>
                  <option value="high" ${state.reasoningEffort === "high" ? "selected" : ""}>High - More thorough</option>
                </select>
                <div class="form-text">Control how much effort the AI puts into reasoning through your prompts.</div>
              </div>
  
              <div class="d-flex justify-content-between">
                <button type="button" id="cancel-settings-button" class="btn btn-outline-secondary">
                  <i class="fas fa-times me-1"></i> Cancel
                </button>
                <button type="submit" class="btn btn-primary">
                  <i class="fas fa-save me-1"></i> Save Settings
                </button>
              </div>
            </form>
          </div>
        </div>
      `;
  }

  /**
   * Render options for AI model select dropdown
   * @param {Object} availableModels - Object containing available AI models
   * @param {string} defaultProvider - Default provider to select
   * @returns {string} HTML options for select element
   */
  function renderModelOptions(availableModels, defaultProvider) {
    if (!availableModels || Object.keys(availableModels).length === 0) {
      return '<option value="">No models available</option>';
    }

    let options = "";
    for (const [provider, modelInfo] of Object.entries(availableModels)) {
      options += `<option value="${provider}" ${provider === defaultProvider ? "selected" : ""}>
          ${formatProviderName(provider)} - ${modelInfo.model}
        </option>`;
    }
    return options;
  }

  /**
   * Format provider name for display
   * @param {string} provider - Provider name in lowercase
   * @returns {string} Formatted provider name
   */
  function formatProviderName(provider) {
    const providerFormatMap = {
      openai: "OpenAI",
      anthropic: "Anthropic",
      gemini: "Google Gemini",
      ollama: "Ollama",
      deepseek: "DeepSeek",
      xai: "xAI",
      mistral: "Mistral AI",
    };

    return providerFormatMap[provider] || provider.charAt(0).toUpperCase() + provider.slice(1);
  }

  /**
   * Set up event listeners for the settings dialog
   * @param {Object} callbacks - Callback functions
   */
  function setupEventListeners(callbacks) {
    // Form submission
    const settingsForm = document.getElementById("settings-form");
    if (settingsForm) {
      settingsForm.addEventListener("submit", function (event) {
        event.preventDefault();

        // Get form values
        const theme = document.getElementById("theme-select").value;
        const aiModel = document.getElementById("ai-model-select").value;
        const reasoningEffort = document.getElementById("reasoning-effort-select").value;

        console.log("Saving settings:", { theme, aiModel, reasoningEffort });

        // Call the onSave callback with the new settings
        if (callbacks && callbacks.onSave) {
          callbacks.onSave({
            theme,
            aiModel,
            reasoningEffort,
          });
        }
      });
    }

    // Cancel button
    Utilities.setupButtonListener("cancel-settings-button", function () {
      if (callbacks && callbacks.onCancel) {
        callbacks.onCancel();
      }
    });

    // Theme select real-time preview
    const themeSelect = document.getElementById("theme-select");
    if (themeSelect) {
      themeSelect.addEventListener("change", function () {
        // Update theme preview in real-time
        if (callbacks && callbacks.onThemePreview) {
          callbacks.onThemePreview(this.value);
        }
      });
    }
  }

  // Public API
  return {
    render,
    setupEventListeners,
  };
})();
