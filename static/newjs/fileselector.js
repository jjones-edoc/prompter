/**
 * File Selector Dialog module
 * Renders and handles user interaction for file selection
 */

const FileSelector = (function () {
  // Module state
  let treeData = null;
  let tokenCount = 0;
  let selectedFiles = [];
  let selectedFolders = [];

  /**
   * Render the file selector dialog
   * @param {Object} state - Current application state
   * @returns {string} HTML content for the file selector dialog
   */
  function render(state) {
    // Initialize module state from app state
    treeData = state.directoryStructure || null;
    selectedFiles = state.selectedFiles || [];
    selectedFolders = state.selectedFolders || [];
    tokenCount = state.tokenCount || 0;

    return `
        <div class="card shadow-sm mb-4">
          <div class="card-header card-header-themed d-flex justify-content-between align-items-center">
            <h2 class="h4 mb-0">Select Files for Your Prompt</h2>
            <div class="token-counter">
              <span class="badge bg-info text-dark fs-6">
                <i class="fas fa-calculator me-1"></i> Total Tokens: <span id="total-tokens">0</span>
              </span>
            </div>
          </div>
          <div class="card-body pb-0">
            <!-- Search box -->
            <div class="input-group mb-3">
              <span class="input-group-text"><i class="fas fa-search"></i></span>
              <input type="text" class="form-control" id="search-input" placeholder="Search files by content..." aria-label="Search files">
              <button class="btn btn-outline-secondary" type="button" id="search-button">Search</button>
            </div>
            <div id="search-results" class="mb-3 d-none">
              <div class="alert alert-info d-flex align-items-center">
                <div class="me-auto" id="search-stats"></div>
                <button class="btn btn-sm btn-outline-primary" id="select-found-files">Select All Found Files</button>
                <button class="btn btn-sm btn-outline-secondary ms-2" id="clear-search">Clear</button>
              </div>
            </div>
          </div>
          <div class="card-body p-0"> <!-- Removed padding for better control -->
            <form id="file-selection-form">
              <!-- Action buttons - sticky header -->
              <div class="sticky-header">
                <div class="d-flex justify-content-between p-3 bg-body border-bottom">
                  <button type="button" id="back-button" class="btn btn-outline-secondary btn-sm">
                    <i class="fas fa-arrow-left me-1"></i> Back
                  </button>
                  <div>
                    <button type="button" id="select-all-btn" class="btn btn-outline-secondary btn-sm">
                      <i class="fas fa-check-square me-1"></i> Select All
                    </button>
                    <button type="submit" class="btn btn-primary btn-sm" id="next-button">
                      <i class="fas fa-wand-magic-sparkles me-1"></i> Generate
                    </button>
                  </div>
                </div>
              </div>
              
              <div class="file-explorer scrollable-container">
                <!-- Tree view for folders and files -->
                <div class="tree-view">
                  <ul class="tree-root list-unstyled" id="root-folder-contents">
                    ${
                      treeData
                        ? renderTree(treeData)
                        : '<li class="py-2 text-center text-muted"><i class="fas fa-spinner fa-spin me-2"></i> Loading files and folders...</li>'
                    }
                  </ul>
                </div>
              </div>
            </form>
          </div>
        </div>
      `;
  }

  /**
   * Render a tree node recursively
   * @param {Object} node - Tree node to render
   * @returns {string} HTML content for the tree node
   */
  function renderTree(node) {
    let html = "";

    // Add directories first
    if (node.dirs && node.dirs.length > 0) {
      node.dirs.forEach((dir, index) => {
        const subfolderId = `sub-folder-${dir.path.replace(/[\/\.\s]/g, "-")}-${index}`;
        const isSelected = selectedFolders.includes(dir.path);

        html += `
            <li class="tree-item folder-item ${isSelected ? "selected-folder" : ""}">
              <div class="d-flex align-items-center p-2 border-bottom">
                <div class="me-2">
                  <input type="checkbox" class="form-check-input folder-checkbox" 
                    data-folder-path="${dir.path}" ${isSelected ? "checked" : ""} />
                </div>
                <div class="me-2 toggle-icon" data-bs-toggle="collapse" data-bs-target="#${subfolderId}">
                  <i class="fas fa-caret-down fa-fw"></i>
                </div>
                <div class="me-2">
                  <i class="fas fa-folder fa-fw text-warning"></i>
                </div>
                <div class="folder-name">
                  <span class="cursor-pointer" data-bs-toggle="collapse" data-bs-target="#${subfolderId}">${dir.name}</span>
                </div>
                <div class="ms-auto folder-token-count">
                  <span class="badge bg-light text-secondary token-badge" 
                    data-folder-tokens="${dir.token_count || 0}">${dir.token_count || 0} tokens</span>
                </div>
              </div>
              <div class="collapse show" id="${subfolderId}">
                <ul class="list-unstyled ms-4 folder-contents" data-folder-path="${dir.path}">
                  ${renderTree(dir)}
                </ul>
              </div>
            </li>
          `;
      });
    }

    // Add files
    if (node.files && node.files.length > 0) {
      node.files.forEach((file) => {
        const isSelected = selectedFiles.includes(file.path);
        const tokenEstimate = file.token_count || Math.round(file.size / 4); // Use actual token count if available

        html += `
            <li class="tree-item file-item">
              <div class="d-flex align-items-center p-2 border-bottom">
                <div class="me-2">
                  <input 
                    type="checkbox" 
                    class="form-check-input file-checkbox" 
                    value="${file.path}" 
                    data-size="${file.size}"
                    data-token-estimate="${tokenEstimate}"
                    ${isSelected ? "checked" : ""}
                  />
                </div>
                <div class="me-2 invisible">
                  <i class="fas fa-caret-right fa-fw"></i>
                </div>
                <div class="me-2">
                  <i class="far fa-file fa-fw text-secondary"></i>
                </div>
                <div class="file-name text-truncate">
                  ${file.name}
                </div>
                <div class="ms-auto file-details d-flex">
                  <span class="badge bg-light text-secondary me-2">${file.type || ""}</span>
                  <span class="badge bg-light text-secondary me-2">
                    ${formatFileSize(file.size)}
                  </span>
                  <span class="badge bg-light text-secondary token-badge" data-token-estimate="${tokenEstimate}">
                    ${tokenEstimate} tokens
                  </span>
                </div>
              </div>
            </li>
          `;
      });
    }

    // If empty folder
    if ((!node.dirs || node.dirs.length === 0) && (!node.files || node.files.length === 0)) {
      html = '<li class="py-2 text-center text-muted"><i class="fas fa-folder-open me-2"></i> Empty folder</li>';
    }

    return html;
  }

  /**
   * Format file size in human-readable format
   * @param {number} size - File size in bytes
   * @returns {string} Formatted file size
   */
  function formatFileSize(size) {
    if (size < 1024) {
      return size + " B";
    } else if (size < 1048576) {
      return (size / 1024).toFixed(1) + " KB";
    } else {
      return (size / 1048576).toFixed(1) + " MB";
    }
  }

  /**
   * Set up event listeners for the file selector
   * @param {Function} submitCallback - Callback for form submission
   */
  function setupEventListeners(submitCallback) {
    // Initialize token counter
    updateTokenCount();

    // Back button
    const backButton = document.getElementById("back-button");
    if (backButton) {
      backButton.addEventListener("click", function () {
        // Go back to prompt dialog
        App.showPromptDialog();
      });
    }

    // File checkboxes
    setupFileCheckboxes();

    // Folder checkboxes
    setupFolderCheckboxes();

    // Toggle folder icons
    setupFolderToggles();

    // Select all button
    setupSelectAllButton();

    // Search functionality
    setupSearch();

    // Form submission
    const fileSelectionForm = document.getElementById("file-selection-form");
    if (fileSelectionForm) {
      fileSelectionForm.addEventListener("submit", function (event) {
        event.preventDefault();

        // Validate
        if (selectedFiles.length === 0 && selectedFolders.length === 0) {
          showError("Please select at least one file or folder before generating.");
          return;
        }

        // Call the submit callback
        submitCallback({
          files: selectedFiles,
          folders: selectedFolders,
          tokenCount: tokenCount,
        });
      });
    }
  }

  /**
   * Set up file checkbox event listeners
   */
  function setupFileCheckboxes() {
    document.querySelectorAll(".file-checkbox").forEach((checkbox) => {
      checkbox.addEventListener("change", function () {
        const filePath = this.value;

        if (this.checked) {
          // Add to selected files if not already present
          if (!selectedFiles.includes(filePath)) {
            selectedFiles.push(filePath);
          }
        } else {
          // Remove from selected files
          const index = selectedFiles.indexOf(filePath);
          if (index !== -1) {
            selectedFiles.splice(index, 1);
          }
        }

        // Update token count
        recalculateTokens();
      });
    });
  }

  /**
   * Set up folder checkbox event listeners
   */
  function setupFolderCheckboxes() {
    document.querySelectorAll(".folder-checkbox").forEach((checkbox) => {
      checkbox.addEventListener("change", function () {
        const folderPath = this.getAttribute("data-folder-path");
        const folderItem = this.closest(".folder-item");

        if (this.checked) {
          // Add to selected folders if not already present
          if (!selectedFolders.includes(folderPath)) {
            selectedFolders.push(folderPath);
          }

          // Mark as selected
          folderItem.classList.add("selected-folder");

          // Check all child files
          const childFiles = folderItem.querySelectorAll(".file-checkbox");
          childFiles.forEach((fileCheckbox) => {
            fileCheckbox.checked = true;

            // Add to selected files if not already present
            const filePath = fileCheckbox.value;
            if (!selectedFiles.includes(filePath)) {
              selectedFiles.push(filePath);
            }
          });

          // Fetch folder token count if needed
          const tokenBadge = folderItem.querySelector(".token-badge");
          const currentTokens = parseInt(tokenBadge.getAttribute("data-folder-tokens") || "0");

          if (currentTokens === 0) {
            fetchFolderTokenCount(folderPath, tokenBadge);
          }
        } else {
          // Remove from selected folders
          const index = selectedFolders.indexOf(folderPath);
          if (index !== -1) {
            selectedFolders.splice(index, 1);
          }

          // Remove selected class
          folderItem.classList.remove("selected-folder");

          // Uncheck all child files
          const childFiles = folderItem.querySelectorAll(".file-checkbox");
          childFiles.forEach((fileCheckbox) => {
            fileCheckbox.checked = false;

            // Remove from selected files
            const filePath = fileCheckbox.value;
            const fileIndex = selectedFiles.indexOf(filePath);
            if (fileIndex !== -1) {
              selectedFiles.splice(fileIndex, 1);
            }
          });
        }

        // Update token count
        recalculateTokens();
      });
    });
  }

  /**
   * Set up folder toggle event listeners
   */
  function setupFolderToggles() {
    document.querySelectorAll(".toggle-icon").forEach((toggle) => {
      toggle.addEventListener("click", function () {
        const targetId = this.getAttribute("data-bs-toggle");
        const caretIcon = this.querySelector("i");

        if (!caretIcon) return;

        // Toggle caret icon based on current state
        if (caretIcon.classList.contains("fa-caret-down")) {
          caretIcon.classList.remove("fa-caret-down");
          caretIcon.classList.add("fa-caret-right");
        } else {
          caretIcon.classList.remove("fa-caret-right");
          caretIcon.classList.add("fa-caret-down");
        }
      });
    });
  }

  /**
   * Set up select all button
   */
  function setupSelectAllButton() {
    const selectAllBtn = document.getElementById("select-all-btn");
    if (selectAllBtn) {
      selectAllBtn.addEventListener("click", function () {
        const allCheckboxes = document.querySelectorAll(".file-checkbox, .folder-checkbox");
        const allChecked = Array.from(allCheckboxes).every((cb) => cb.checked);

        // Update all checkboxes
        allCheckboxes.forEach((checkbox) => {
          checkbox.checked = !allChecked;

          // Trigger change event manually
          const changeEvent = new Event("change", { bubbles: true });
          checkbox.dispatchEvent(changeEvent);
        });

        // Update button text
        this.innerHTML = allChecked ? '<i class="fas fa-check-square me-1"></i> Select All' : '<i class="fas fa-square me-1"></i> Deselect All';
      });
    }
  }

  /**
   * Set up search functionality
   */
  function setupSearch() {
    const searchInput = document.getElementById("search-input");
    const searchButton = document.getElementById("search-button");
    const searchResults = document.getElementById("search-results");

    if (!searchInput || !searchButton || !searchResults) return;

    // Search button click
    searchButton.addEventListener("click", function () {
      performSearch(searchInput.value);
    });

    // Enter key in search input
    searchInput.addEventListener("keyup", function (event) {
      if (event.key === "Enter") {
        performSearch(this.value);
      }
    });

    // Select found files button
    const selectFoundButton = document.getElementById("select-found-files");
    if (selectFoundButton) {
      selectFoundButton.addEventListener("click", selectFoundFiles);
    }

    // Clear search button
    const clearSearchButton = document.getElementById("clear-search");
    if (clearSearchButton) {
      clearSearchButton.addEventListener("click", clearSearch);
    }
  }

  /**
   * Perform search on files
   * @param {string} query - Search query
   */
  function performSearch(query) {
    const searchResults = document.getElementById("search-results");
    const searchStats = document.getElementById("search-stats");

    if (!query || query.trim() === "") {
      alert("Please enter a search term");
      return;
    }

    // Minimum 3 characters
    if (query.trim().length < 3) {
      alert("Please enter at least 3 characters");
      return;
    }

    // Show loading state
    searchResults.classList.remove("d-none");
    searchStats.innerHTML = `<i class="fas fa-spinner fa-spin me-2"></i> Searching for "${query}"...`;

    // Clear any previous highlights
    clearHighlights();

    // Create form data for the request
    const formData = new FormData();
    formData.append("search_query", query);

    // Fetch request to search files
    fetch("/api/search_files", {
      method: "POST",
      body: formData,
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json();
      })
      .then((data) => {
        if (data.error) {
          searchStats.innerHTML = `<i class="fas fa-exclamation-circle me-2 text-danger"></i> Error: ${data.error}`;
          return;
        }

        // Store the found files in a data attribute
        searchResults.setAttribute("data-found-files", JSON.stringify(data.matching_files));

        // Update search stats
        if (data.count > 0) {
          searchStats.innerHTML = `<i class="fas fa-check-circle me-2 text-success"></i> Found "${query}" in ${data.count} file${data.count !== 1 ? "s" : ""}`;

          // Highlight matching files in the tree
          highlightMatchingFiles(data.matching_files);
        } else {
          searchStats.innerHTML = `<i class="fas fa-info-circle me-2"></i> No files found containing "${query}"`;
        }
      })
      .catch((error) => {
        console.error("Error searching files:", error);
        searchStats.innerHTML = `<i class="fas fa-exclamation-circle me-2 text-danger"></i> Error searching files: ${error.message}`;
      });
  }

  /**
   * Highlight matching files in the tree
   * @param {Array} matchingFiles - Array of matching file objects
   */
  function highlightMatchingFiles(matchingFiles) {
    // For each matching file, find its checkbox in the tree and highlight its parent
    matchingFiles.forEach((file) => {
      const checkbox = document.querySelector(`.file-checkbox[value="${file.path}"]`);
      if (checkbox) {
        const fileItem = checkbox.closest(".file-item");
        fileItem.classList.add("search-match");

        // Add a tooltip with match info
        const nameElement = fileItem.querySelector(".file-name");
        if (nameElement) {
          // Create match info tooltip content
          let tooltipContent = `Found ${file.match_count} match${file.match_count !== 1 ? "es" : ""}`;

          if (file.matching_lines && file.matching_lines.length > 0) {
            tooltipContent += ":<br>";
            file.matching_lines.forEach((line) => {
              tooltipContent += `<small>Line ${line.line_number}: ${line.text}</small><br>`;
            });

            if (file.match_count > file.matching_lines.length) {
              tooltipContent += `<small>... and ${file.match_count - file.matching_lines.length} more</small>`;
            }
          }

          // Set tooltip on name element
          nameElement.setAttribute("data-bs-toggle", "tooltip");
          nameElement.setAttribute("data-bs-html", "true");
          nameElement.setAttribute("title", tooltipContent);

          // Initialize the tooltip
          new bootstrap.Tooltip(nameElement);
        }
      }
    });
  }

  /**
   * Clear all search highlights
   */
  function clearHighlights() {
    // Remove highlight class from all file items
    document.querySelectorAll(".search-match").forEach((element) => {
      element.classList.remove("search-match");
    });

    // Destroy all tooltips
    document.querySelectorAll('[data-bs-toggle="tooltip"]').forEach((element) => {
      const tooltip = bootstrap.Tooltip.getInstance(element);
      if (tooltip) {
        tooltip.dispose();
      }
    });
  }

  /**
   * Select all files found in the search
   */
  function selectFoundFiles() {
    const searchResults = document.getElementById("search-results");
    const foundFilesData = searchResults.getAttribute("data-found-files");

    if (!foundFilesData) {
      return;
    }

    try {
      const foundFiles = JSON.parse(foundFilesData);

      // Select all matching files by checking their checkboxes
      foundFiles.forEach((file) => {
        const checkbox = document.querySelector(`.file-checkbox[value="${file.path}"]`);
        if (checkbox && !checkbox.checked) {
          checkbox.checked = true;

          // Add to selected files if not already present
          if (!selectedFiles.includes(file.path)) {
            selectedFiles.push(file.path);
          }
        }
      });

      // Recalculate total token count
      recalculateTokens();
    } catch (error) {
      console.error("Error selecting found files:", error);
    }
  }

  /**
   * Clear search results and highlights
   */
  function clearSearch() {
    const searchInput = document.getElementById("search-input");
    const searchResults = document.getElementById("search-results");

    // Clear input
    if (searchInput) {
      searchInput.value = "";
    }

    // Hide results
    if (searchResults) {
      searchResults.classList.add("d-none");
      searchResults.removeAttribute("data-found-files");
    }

    // Clear highlights
    clearHighlights();
  }

  /**
   * Fetch token count for a folder from the server
   * @param {string} folderPath - The path of the folder
   * @param {HTMLElement} badgeElement - The badge element to update
   */
  function fetchFolderTokenCount(folderPath, badgeElement) {
    // Show loading state
    badgeElement.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';

    // Create form data for the request
    const formData = new FormData();
    formData.append("folder_path", folderPath);

    fetch("/api/get_folder_token_count", {
      method: "POST",
      body: formData,
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json();
      })
      .then((data) => {
        if (data.error) {
          console.error("Error fetching token count:", data.error);
          badgeElement.textContent = "0 tokens";
          return;
        }

        // Update the badge with the token count
        badgeElement.textContent = `${data.token_count} tokens`;
        badgeElement.setAttribute("data-folder-tokens", data.token_count);

        // Recalculate total tokens
        recalculateTokens();
      })
      .catch((error) => {
        console.error("Error fetching folder token count:", error);
        badgeElement.textContent = "0 tokens";
      });
  }

  /**
   * Recalculate the total token count based on all selected files and folders
   */
  function recalculateTokens() {
    let totalTokens = 0;

    // Track all file paths we've already counted to avoid duplicates
    const countedFilePaths = new Set();

    // Get all checked folder checkboxes first - these take precedence
    const checkedFolderCheckboxes = document.querySelectorAll(".folder-checkbox:checked");
    checkedFolderCheckboxes.forEach((checkbox) => {
      const folderItem = checkbox.closest(".folder-item");
      const tokenBadge = folderItem.querySelector(".token-badge");
      const folderPath = checkbox.getAttribute("data-folder-path");

      // If folder has a token count, use it and mark all its files as counted
      if (tokenBadge) {
        const folderTokens = parseInt(tokenBadge.getAttribute("data-folder-tokens") || 0);
        if (!isNaN(folderTokens) && folderTokens > 0) {
          totalTokens += folderTokens;

          // Mark all files in this folder as counted
          const fileCheckboxes = folderItem.querySelectorAll(".file-checkbox");
          fileCheckboxes.forEach((fileCheckbox) => {
            countedFilePaths.add(fileCheckbox.value);
          });
        }
      }
    });

    // Now add tokens for any checked files that aren't in counted folders
    const checkedFileCheckboxes = document.querySelectorAll(".file-checkbox:checked");
    checkedFileCheckboxes.forEach((checkbox) => {
      const filePath = checkbox.value;

      // Skip if this file was already counted as part of a folder
      if (countedFilePaths.has(filePath)) {
        return;
      }

      const tokenEstimate = parseInt(checkbox.getAttribute("data-token-estimate") || 0);
      if (!isNaN(tokenEstimate)) {
        totalTokens += tokenEstimate;
      }
    });

    // Update the token count
    tokenCount = totalTokens;
    updateTokenCount();
  }

  /**
   * Update the token count display
   */
  function updateTokenCount() {
    const totalTokensElement = document.getElementById("total-tokens");
    if (totalTokensElement) {
      totalTokensElement.textContent = tokenCount.toLocaleString();

      const badgeElement = totalTokensElement.closest(".badge");
      if (!badgeElement) return;

      // Change color based on token count
      if (tokenCount > 100000) {
        badgeElement.classList.remove("bg-info", "text-dark", "bg-warning");
        badgeElement.classList.add("bg-danger", "text-white");
      } else if (tokenCount > 50000) {
        badgeElement.classList.remove("bg-info", "text-dark", "bg-danger");
        badgeElement.classList.add("bg-warning", "text-dark");
      } else {
        badgeElement.classList.remove("bg-warning", "bg-danger", "text-white");
        badgeElement.classList.add("bg-info", "text-dark");
      }
    }
  }

  /**
   * Show an error message
   * @param {string} message - Error message to display
   */
  function showError(message) {
    // Check if error element already exists
    let errorElement = document.getElementById("file-selector-error");

    if (!errorElement) {
      // Create error element
      errorElement = document.createElement("div");
      errorElement.id = "file-selector-error";
      errorElement.className = "alert alert-danger mt-3";

      // Get the form and insert error after it
      const fileSelectionForm = document.getElementById("file-selection-form");
      fileSelectionForm.parentNode.insertBefore(errorElement, fileSelectionForm.nextSibling);
    }

    errorElement.textContent = message;

    // Auto dismiss after 5 seconds
    setTimeout(() => {
      errorElement.remove();
    }, 5000);
  }

  // Public API
  return {
    render: render,
    setupEventListeners: setupEventListeners,
  };
})();
