/**
 * AI Selection Helper functionality
 */

// Create a namespace for AI selection
var AISelection = (function() {
  /**
   * Initialize the AI selection functionality
   */
  function init() {
    // Initialize when modal is opened
    const aiSelectionModal = document.getElementById('aiSelectionModal');
    if (aiSelectionModal) {
      aiSelectionModal.addEventListener('shown.bs.modal', generateAIPrompt);
    }

    // Set up copy prompt button
    const copyPromptBtn = document.getElementById('copy-prompt-btn');
    if (copyPromptBtn) {
      copyPromptBtn.addEventListener('click', copyPromptToClipboard);
    }

    // Set up process response button
    const processResponseBtn = document.getElementById('process-response-btn');
    if (processResponseBtn) {
      processResponseBtn.addEventListener('click', processAIResponse);
    }
  }

  /**
   * Generate the AI selection prompt
   */
  function generateAIPrompt() {
    // Show loading indicator
    const loadingIndicator = document.getElementById('loading-indicator');
    const promptSection = document.getElementById('prompt-section');
    const errorMessage = document.getElementById('error-message');
    
    if (loadingIndicator) loadingIndicator.classList.remove('d-none');
    if (promptSection) promptSection.classList.add('d-none');
    if (errorMessage) errorMessage.classList.add('d-none');

    // Get user prompt from session (via AJAX call)
    fetch('/api/get_ai_selection_prompt')
      .then(response => {
        if (!response.ok) {
          throw new Error('Failed to generate AI selection prompt');
        }
        return response.json();
      })
      .then(data => {
        // Hide loading indicator and show prompt section
        if (loadingIndicator) loadingIndicator.classList.add('d-none');
        if (promptSection) promptSection.classList.remove('d-none');

        // Update the prompt textarea
        const promptTextarea = document.getElementById('ai-prompt');
        if (promptTextarea && data.prompt) {
          promptTextarea.value = data.prompt;
        }
      })
      .catch(error => {
        // Hide loading indicator and show error message
        if (loadingIndicator) loadingIndicator.classList.add('d-none');
        if (errorMessage) {
          errorMessage.classList.remove('d-none');
          errorMessage.textContent = error.message || 'Failed to generate AI selection prompt';
        }
        console.error('Error generating AI selection prompt:', error);
      });
  }

  /**
   * Copy the generated prompt to clipboard
   */
  function copyPromptToClipboard() {
    const promptTextarea = document.getElementById('ai-prompt');
    if (!promptTextarea) return;

    promptTextarea.select();
    
    try {
      const successful = document.execCommand('copy');
      if (successful) {
        // Show success message
        const copyBtn = document.getElementById('copy-prompt-btn');
        const originalText = copyBtn.innerHTML;
        
        copyBtn.innerHTML = '<i class="fas fa-check me-1"></i> Copied!';
        copyBtn.classList.remove('btn-primary');
        copyBtn.classList.add('btn-success');
        
        // Reset button after 2 seconds
        setTimeout(() => {
          copyBtn.innerHTML = originalText;
          copyBtn.classList.remove('btn-success');
          copyBtn.classList.add('btn-primary');
        }, 2000);
      }
    } catch (err) {
      console.error('Error copying to clipboard:', err);
    }
    
    // Fallback to modern clipboard API if available
    if (navigator.clipboard) {
      navigator.clipboard.writeText(promptTextarea.value)
        .catch(err => console.error('Failed to copy using Clipboard API:', err));
    }
  }

  /**
   * Process the AI response and redirect to file selection
   */
  function processAIResponse() {
    const responseTextarea = document.getElementById('ai-response');
    const processBtn = document.getElementById('process-response-btn');
    
    if (!responseTextarea || !responseTextarea.value.trim()) {
      alert('Please paste the AI response first');
      return;
    }

    // Show loading state
    processBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-1"></i> Processing...';
    processBtn.disabled = true;

    // Get the AI response text
    const aiResponse = responseTextarea.value.trim();
    
    // Create form data with the AI response
    const formData = new FormData();
    formData.append('ai_response', aiResponse);
    
    // Send to server to process
    fetch('/api/process_ai_selection', {
      method: 'POST',
      body: formData
    })
      .then(response => {
        if (!response.ok) {
          return response.json().then(data => {
            throw new Error(data.error || 'Failed to process AI selection');
          });
        }
        return response.json();
      })
      .then(data => {
        if (data.success) {
          // Show success state before redirecting
          processBtn.innerHTML = '<i class="fas fa-check me-1"></i> Success!';
          processBtn.classList.remove('btn-primary');
          processBtn.classList.add('btn-success');
          
          // Display the number of files that will be selected
          const messageEl = document.getElementById('error-message');
          if (messageEl) {
            messageEl.textContent = `Found ${data.file_count} relevant files. Redirecting to file selection...`;
            messageEl.classList.remove('d-none', 'alert-danger');
            messageEl.classList.add('alert-success');
          }
          
          // Redirect after a short delay
          setTimeout(() => {
            window.location.href = data.redirect_url;
          }, 1000);
        } else {
          // Show error message
          throw new Error(data.error || 'Failed to process AI selection');
        }
      })
      .catch(error => {
        console.error('Error processing AI selection:', error);
        
        // Reset button state
        processBtn.innerHTML = '<i class="fas fa-check me-1"></i> Process & Select Files';
        processBtn.disabled = false;
        
        // Show error message
        const messageEl = document.getElementById('error-message');
        if (messageEl) {
          messageEl.textContent = 'Error: ' + error.message;
          messageEl.classList.remove('d-none');
          messageEl.classList.add('alert-danger');
        } else {
          alert('Error: ' + error.message);
        }
      });
  }

  // Return public functions
  return {
    init: init
  };
})();

// Initialize AI selection when DOM is loaded
document.addEventListener("DOMContentLoaded", function() {
  AISelection.init();
});
