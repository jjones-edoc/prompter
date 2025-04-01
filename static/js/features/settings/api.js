/**
 * Settings API Module
 * Handles API calls related to settings functionality
 */
const SettingsAPI = (function () {
  /**
   * Fetch available AI models from the server
   * @returns {Promise} Promise resolving to available models data
   */
  function fetchAvailableModels() {
    return fetch("/api/get_available_models")
      .then((response) => {
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json();
      })
      .catch((error) => {
        console.error("Error fetching available models:", error);
        return {
          error: `Failed to load available models: ${error.message}`,
          available_models: {},
          default_provider: "anthropic",
          default_reasoning_effort: "medium"
        };
      });
  }

  // Public API
  return {
    fetchAvailableModels
  };
})();
