/**
 * File Selector Dialog module
 * Renders and handles user interaction for file selection
 * Modified to work with centralized state management
 */
const FileSelectorDialog = (function () {
  /**
   * Render the file selector dialog based on provided state
   * @param {Object} state - The file selector state
   * @returns {string} HTML content for the file selector
   */
  function render(state) {
    const treeData = state.directoryStructure;
    const selectedFiles = state.selectedFiles || [];
    const selectedFolders = state.selectedFolders || [];
    const tokenCount = state.tokenCount || 0;

    return `
        <div class="card shadow-sm mb-4">
          <div class="card-header card-header-themed d-flex justify-content-between align-items-center">
            <h2 class="h4 mb-0">Select Files for Your Prompt</h2>
            <div class="token-counter">
              <span class="badge bg-info text-dark fs-6">
                <i class="fas fa-calculator me-1"></i> Total Tokens: <span id="total-tokens">${tokenCount.toLocaleString()}</span>
              </span>
            </div>
          </div>
          <div class="card-body p-0">
            <form id="file-selection-form">
              <!-- Action buttons - sticky header -->
              <div class="sticky-header">
                <div class="d-flex justify-content-between p-3 bg-body border-bottom">
                  <div class="d-flex align-items-center flex-grow-1 me-3">
                    <button type="button" id="back-button" class="btn btn-outline-secondary me-3 d-flex align-items-center justify-content-center" style="height: 38px; min-width: 80px;">
                      <i class="fas fa-arrow-left me-1"></i> Back
                    </button>
                    
                    <!-- Search input -->
                    <div class="input-group flex-grow-1">
                      <input type="text" class="form-control" id="search-input" placeholder="Search files..." aria-label="Search files" style="height: 38px;">
                      <button class="btn btn-outline-secondary" type="button" id="search-button" style="height: 38px;">
                        <i class="fas fa-search"></i>
                      </button>
                    </div>
                  </div>
                  <div class="d-flex align-items-center">
                    <button type="button" id="select-all-btn" class="btn btn-outline-secondary me-2" style="height: 38px;">
                      <i class="fas fa-check-square me-1"></i> Select All
                    </button>
                    <button type="submit" class="btn btn-primary" id="next-button" style="height: 38px;">
                      <i class="fas fa-wand-magic-sparkles me-1"></i> Generate
                    </button>
                  </div>
                </div>
                <!-- Search status indicator -->
                <div id="search-status" class="px-3 py-2 bg-light border-bottom d-none">
                  <span id="search-stats"></span>
                  <button class="btn btn-sm btn-link" id="clear-search">Clear Search</button>
                </div>
              </div>
              
              <div class="file-explorer scrollable-container">
                <div class="tree-view">
                  <ul class="tree-root list-unstyled" id="root-folder-contents">
                    ${
                      treeData
                        ? renderTree(treeData, selectedFiles, selectedFolders)
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
   * Render the file tree structure
   * @param {Object} node - The node to render
   * @param {Array} selectedFiles - Array of selected file paths
   * @param {Array} selectedFolders - Array of selected folder paths
   * @returns {string} HTML content for the tree
   */
  function renderTree(node, selectedFiles, selectedFolders) {
    if ((!node.dirs || node.dirs.length === 0) && (!node.files || node.files.length === 0)) {
      return '<li class="py-2 text-center text-muted"><i class="fas fa-folder-open me-2"></i> Empty folder</li>';
    }

    let html = "";

    // Add directories first
    if (node.dirs && node.dirs.length > 0) {
      node.dirs.forEach((dir, index) => {
        const subfolderId = `sub-folder-${dir.path.replace(/[\/\.\s]/g, "-")}-${index}`;
        const isSelected = selectedFolders.includes(dir.path);
        html += `
            <li class="tree-item folder-item ${isSelected ? "selected-folder" : ""}">
              <div class="d-flex align-items-center p-2 border-bottom">
                <div class="me-2"><input type="checkbox" class="form-check-input folder-checkbox" data-folder-path="${dir.path}" ${
          isSelected ? "checked" : ""
        } /></div>
                <div class="me-2 toggle-icon" data-bs-toggle="collapse" data-bs-target="#${subfolderId}"><i class="fas fa-caret-down fa-fw"></i></div>
                <div class="me-2"><i class="fas fa-folder fa-fw text-warning"></i></div>
                <div class="folder-name"><span class="cursor-pointer" data-bs-toggle="collapse" data-bs-target="#${subfolderId}">${dir.name}</span></div>
                <div class="ms-auto folder-token-count"><span class="badge bg-light text-secondary token-badge" data-folder-tokens="${dir.token_count || 0}">${
          dir.token_count || 0
        } tokens</span></div>
              </div>
              <div class="collapse show" id="${subfolderId}">
                <ul class="list-unstyled ms-4 folder-contents" data-folder-path="${dir.path}">${renderTree(dir, selectedFiles, selectedFolders)}</ul>
              </div>
            </li>
          `;
      });
    }

    // Add files
    if (node.files && node.files.length > 0) {
      node.files.forEach((file) => {
        const isSelected = selectedFiles.includes(file.path);
        const tokenEstimate = file.token_count || Math.round(file.size / 4);
        html += `
            <li class="tree-item file-item">
              <div class="d-flex align-items-center p-2 border-bottom">
                <div class="me-2"><input type="checkbox" class="form-check-input file-checkbox" value="${file.path}" data-size="${
          file.size
        }" data-token-estimate="${tokenEstimate}" ${isSelected ? "checked" : ""} /></div>
                <div class="me-2 invisible"><i class="fas fa-caret-right fa-fw"></i></div>
                <div class="me-2"><i class="far fa-file fa-fw text-secondary"></i></div>
                <div class="file-name text-truncate">${file.name}</div>
                <div class="ms-auto file-details d-flex">
                  <span class="badge bg-light text-secondary me-2">${file.type || ""}</span>
                  <span class="badge bg-light text-secondary me-2">${Utilities.formatFileSize(file.size)}</span>
                  <span class="badge bg-light text-secondary token-badge" data-token-estimate="${tokenEstimate}">${tokenEstimate} tokens</span>
                </div>
              </div>
            </li>
          `;
      });
    }

    return html;
  }

  /**
   * Render search results
   * @param {Array} matches - Array of matching files
   * @param {Array} selectedFiles - Array of selected file paths
   * @returns {string} HTML content for search results
   */
  function renderSearchResults(matches, selectedFiles) {
    if (!matches || matches.length === 0) {
      return '<li class="py-2 text-center text-muted"><i class="fas fa-search me-2"></i> No matching files found</li>';
    }

    let html = "";

    matches.forEach((file) => {
      const isSelected = selectedFiles.includes(file.path);
      const tokenEstimate = file.token_count || Math.round(file.size / 4);

      html += `
          <li class="tree-item file-item search-match">
            <div class="d-flex align-items-center p-2 border-bottom">
              <div class="me-2"><input type="checkbox" class="form-check-input file-checkbox" value="${file.path}" data-size="${
        file.size || 0
      }" data-token-estimate="${tokenEstimate}" ${isSelected ? "checked" : ""} /></div>
              <div class="me-2 invisible"><i class="fas fa-caret-right fa-fw"></i></div>
              <div class="me-2"><i class="far fa-file fa-fw text-secondary"></i></div>
              <div class="file-name text-truncate">${file.path}</div>
              <div class="ms-auto file-details d-flex">
                <span class="badge bg-primary text-white me-2">${file.match_count} match${file.match_count !== 1 ? "es" : ""}</span>
                <span class="badge bg-light text-secondary me-2">${file.type || ""}</span>
                <span class="badge bg-light text-secondary me-2">${Utilities.formatFileSize(file.size || 0)}</span>
                <span class="badge bg-light text-secondary token-badge" data-token-estimate="${tokenEstimate}">${tokenEstimate} tokens</span>
              </div>
            </div>
          </li>
        `;
    });

    return html;
  }

  /**
   * Set up event listeners for the file selector dialog
   * @param {Object} callbacks - Callbacks for dialog actions
   */
  function setupEventListeners(callbacks) {
    // Back button
    Utilities.setupButtonListener("back-button", function () {
      if (callbacks && callbacks.onBack) {
        callbacks.onBack();
      }
    });

    // Setup checkbox handlers
    setupCheckboxes(callbacks);

    // Toggle folder icons
    document.querySelectorAll(".toggle-icon").forEach((toggle) => {
      toggle.addEventListener("click", function () {
        const caretIcon = this.querySelector("i");
        if (!caretIcon) return;

        if (caretIcon.classList.contains("fa-caret-down")) {
          caretIcon.classList.replace("fa-caret-down", "fa-caret-right");
        } else {
          caretIcon.classList.replace("fa-caret-right", "fa-caret-down");
        }
      });
    });

    // Select all button
    // First remove any existing event listeners to prevent duplicate firing
    const selectAllBtn = document.getElementById("select-all-btn");
    if (selectAllBtn) {
      const clone = selectAllBtn.cloneNode(true);
      selectAllBtn.parentNode.replaceChild(clone, selectAllBtn);
    }

    Utilities.setupButtonListener("select-all-btn", function () {
      const isSearchActive = !document.getElementById("search-status").classList.contains("d-none");
      let checkboxes;

      if (isSearchActive) {
        // Only select/deselect search results when search is active
        checkboxes = document.querySelectorAll(".search-match .file-checkbox");
      } else {
        // Select/deselect all files and folders when no search is active
        checkboxes = document.querySelectorAll(".file-checkbox, .folder-checkbox");
      }

      const allChecked = Array.from(checkboxes).every((cb) => cb.checked);

      checkboxes.forEach((checkbox) => {
        checkbox.checked = !allChecked;
        checkbox.dispatchEvent(new Event("change", { bubbles: true }));
      });

      this.innerHTML = allChecked ? '<i class="fas fa-check-square me-1"></i> Select All' : '<i class="fas fa-square me-1"></i> Deselect All';

      // Notify parent about selection change
      if (callbacks && callbacks.onSelectionChange) {
        callbacks.onSelectionChange({
          files: getSelectedFiles(),
          folders: getSelectedFolders(),
          tokenCount: calculateTotalTokens(),
        });
      }
    });

    // Setup search functionality
    setupSearch(callbacks);

    // Form submission
    const fileSelectionForm = document.getElementById("file-selection-form");
    if (fileSelectionForm) {
      fileSelectionForm.addEventListener("submit", function (event) {
        event.preventDefault();

        const selectedFiles = getSelectedFiles();
        const selectedFolders = getSelectedFolders();
        const tokenCount = calculateTotalTokens();

        if (selectedFiles.length === 0 && selectedFolders.length === 0) {
          Utilities.showSnackBar("Please select at least one file or folder before generating.", "error");
          return;
        }

        if (callbacks && callbacks.onSubmit) {
          callbacks.onSubmit({
            files: selectedFiles,
            folders: selectedFolders,
            tokenCount: tokenCount,
          });
        }
      });
    }
  }

  /**
   * Set up event handlers for checkboxes
   * @param {Object} callbacks - Callbacks for selection changes
   */
  function setupCheckboxes(callbacks) {
    // File checkboxes
    document.querySelectorAll(".file-checkbox").forEach((checkbox) => {
      checkbox.addEventListener("change", function () {
        // Update UI for parent folders
        updateParentFolderUI(this);

        // Notify parent about selection change
        if (callbacks && callbacks.onSelectionChange) {
          callbacks.onSelectionChange({
            files: getSelectedFiles(),
            folders: getSelectedFolders(),
            tokenCount: calculateTotalTokens(),
          });
        }
      });
    });

    // Folder checkboxes
    document.querySelectorAll(".folder-checkbox").forEach((checkbox) => {
      checkbox.addEventListener("change", function () {
        const folderPath = this.getAttribute("data-folder-path");
        const folderItem = this.closest(".folder-item");
        const childCheckboxes = folderItem.querySelectorAll(".file-checkbox, .folder-checkbox");

        // Update UI
        if (this.checked) {
          folderItem.classList.add("selected-folder");

          // Check all child checkboxes
          childCheckboxes.forEach((cb) => {
            if (cb !== this && !cb.checked) {
              cb.checked = true;
            }
          });

          // If token count is zero, trigger API call to get it (via callback)
          const tokenBadge = folderItem.querySelector(".token-badge");
          const currentTokens = parseInt(tokenBadge.getAttribute("data-folder-tokens") || "0");
          if (currentTokens === 0 && callbacks && callbacks.onFolderTokenRequest) {
            callbacks.onFolderTokenRequest(folderPath, tokenBadge);
          }
        } else {
          folderItem.classList.remove("selected-folder");

          // Uncheck all child checkboxes
          childCheckboxes.forEach((cb) => {
            if (cb !== this && cb.checked) {
              cb.checked = false;
            }
          });
        }

        // Notify parent about selection change
        if (callbacks && callbacks.onSelectionChange) {
          callbacks.onSelectionChange({
            files: getSelectedFiles(),
            folders: getSelectedFolders(),
            tokenCount: calculateTotalTokens(),
          });
        }
      });
    });
  }

  /**
   * Update parent folder UI based on child selections
   * @param {HTMLElement} childCheckbox - The checkbox that changed
   */
  function updateParentFolderUI(childCheckbox) {
    const fileItem = childCheckbox.closest(".file-item");
    if (!fileItem) return;

    // Find parent folder
    const parentFolderContents = fileItem.closest(".folder-contents");
    if (!parentFolderContents) return;

    const parentFolderPath = parentFolderContents.getAttribute("data-folder-path");
    if (!parentFolderPath) return;

    const parentFolderCheckbox = document.querySelector(`.folder-checkbox[data-folder-path="${parentFolderPath}"]`);
    if (!parentFolderCheckbox) return;

    // Check if all siblings are checked
    const siblingCheckboxes = parentFolderContents.querySelectorAll(".file-checkbox, .folder-checkbox");
    const allSiblingsChecked = Array.from(siblingCheckboxes).every((cb) => cb.checked);

    // Update parent checkbox
    parentFolderCheckbox.checked = allSiblingsChecked;

    // Update parent folder UI
    const parentFolderItem = parentFolderCheckbox.closest(".folder-item");
    if (parentFolderItem) {
      if (allSiblingsChecked) {
        parentFolderItem.classList.add("selected-folder");
      } else {
        parentFolderItem.classList.remove("selected-folder");
      }
    }

    // Recursively update parents
    updateParentFolderUI(parentFolderCheckbox);
  }

  /**
   * Set up search functionality
   * @param {Object} callbacks - Callbacks for search actions
   */
  function setupSearch(callbacks) {
    const searchInput = document.getElementById("search-input");

    // Search on Enter key
    if (searchInput) {
      searchInput.addEventListener("keydown", function (event) {
        if (event.key === "Enter") {
          event.preventDefault();
          const query = this.value.trim();

          if (query && callbacks && callbacks.onSearch) {
            callbacks.onSearch(query);
          } else if (!query && callbacks && callbacks.onClearSearch) {
            callbacks.onClearSearch();
          }
        }
      });
    }

    // Search button click
    Utilities.setupButtonListener("search-button", function () {
      const searchInput = document.getElementById("search-input");
      if (!searchInput) return;

      const query = searchInput.value.trim();

      if (query && callbacks && callbacks.onSearch) {
        callbacks.onSearch(query);
      } else if (!query && callbacks && callbacks.onClearSearch) {
        callbacks.onClearSearch();
      }
    });

    // Clear search button
    Utilities.setupButtonListener("clear-search", function (event) {
      event.preventDefault();

      if (callbacks && callbacks.onClearSearch) {
        callbacks.onClearSearch();
      }
    });
  }

  /**
   * Update the UI when search results are received
   * @param {Object} searchResults - The search results
   * @param {Array} selectedFiles - Currently selected files
   */
  function updateSearchResults(searchResults, selectedFiles) {
    const searchStats = document.getElementById("search-stats");
    const searchStatus = document.getElementById("search-status");
    const rootFolder = document.getElementById("root-folder-contents");

    if (!searchResults || searchResults.error) {
      searchStats.innerHTML = `<i class="fas fa-exclamation-circle me-2 text-danger"></i> Error: ${searchResults?.error || "Unknown error"}`;
      return;
    }

    searchStatus.classList.remove("d-none");

    // Update search stats
    if (searchResults.count > 0) {
      searchStats.innerHTML = `<i class="fas fa-check-circle me-2 text-success"></i> Found "${searchResults.query}" in ${searchResults.count} file${
        searchResults.count !== 1 ? "s" : ""
      }`;

      // Update the tree view to only show matching files
      rootFolder.innerHTML = renderSearchResults(searchResults.matching_files, selectedFiles);
    } else {
      searchStats.innerHTML = `<i class="fas fa-info-circle me-2"></i> No files found containing "${searchResults.query}"`;
      rootFolder.innerHTML = renderSearchResults([], selectedFiles);
    }
  }

  /**
   * Helper function to get currently selected files
   * @returns {Array} Array of selected file paths
   */
  function getSelectedFiles() {
    const fileCheckboxes = document.querySelectorAll(".file-checkbox:checked");
    return Array.from(fileCheckboxes).map((checkbox) => checkbox.value);
  }

  /**
   * Helper function to get currently selected folders
   * @returns {Array} Array of selected folder paths
   */
  function getSelectedFolders() {
    const folderCheckboxes = document.querySelectorAll(".folder-checkbox:checked");
    return Array.from(folderCheckboxes).map((checkbox) => checkbox.getAttribute("data-folder-path"));
  }

  /**
   * Calculate total token count based on current selections
   * @returns {number} Total token count
   */
  function calculateTotalTokens() {
    // Build a complete list of files to include
    const filesToInclude = new Map(); // Map of file path to token count

    // First, add all individually checked files
    document.querySelectorAll(".file-checkbox:checked").forEach((checkbox) => {
      const filePath = checkbox.value;
      const tokenEstimate = parseInt(checkbox.getAttribute("data-token-estimate") || 0);
      if (!isNaN(tokenEstimate)) {
        filesToInclude.set(filePath, tokenEstimate);
      }
    });

    // Then process checked folders and their contents
    const checkedFolders = Array.from(document.querySelectorAll(".folder-checkbox:checked"));

    // Sort folders by path length to process deeper folders first
    // This ensures we have accurate token counts for subfolders
    checkedFolders.sort((a, b) => {
      const pathA = a.getAttribute("data-folder-path");
      const pathB = b.getAttribute("data-folder-path");
      return pathB.length - pathA.length; // Longer paths (deeper folders) first
    });

    // Process each folder
    checkedFolders.forEach((checkbox) => {
      const folderPath = checkbox.getAttribute("data-folder-path");
      const folderItem = checkbox.closest(".folder-item");

      // Add each file in this folder if not already included
      folderItem.querySelectorAll(".file-checkbox").forEach((fileCheckbox) => {
        const filePath = fileCheckbox.value;
        const tokenEstimate = parseInt(fileCheckbox.getAttribute("data-token-estimate") || 0);

        if (!isNaN(tokenEstimate)) {
          filesToInclude.set(filePath, tokenEstimate);
        }
      });
    });

    // Calculate total tokens from all included files
    let totalTokens = 0;
    filesToInclude.forEach((tokenCount) => {
      totalTokens += tokenCount;
    });

    // Update token count display
    const totalTokensElement = document.getElementById("total-tokens");
    if (totalTokensElement) {
      totalTokensElement.textContent = totalTokens.toLocaleString();

      const badgeElement = totalTokensElement.closest(".badge");
      if (badgeElement) {
        // Set color based on count
        if (totalTokens > 100000) {
          badgeElement.classList.remove("bg-info", "text-dark", "bg-warning");
          badgeElement.classList.add("bg-danger", "text-white");
        } else if (totalTokens > 50000) {
          badgeElement.classList.remove("bg-info", "text-dark", "bg-danger");
          badgeElement.classList.add("bg-warning", "text-dark");
        } else {
          badgeElement.classList.remove("bg-warning", "bg-danger", "text-white");
          badgeElement.classList.add("bg-info", "text-dark");
        }
      }
    }

    return totalTokens;
  }

  /**
   * Update the select all button text based on current selection state
   */
  function updateSelectAllButton() {
    const selectAllBtn = document.getElementById("select-all-btn");
    if (!selectAllBtn) return;

    const isSearchActive = !document.getElementById("search-status").classList.contains("d-none");
    let checkboxes;

    if (isSearchActive) {
      checkboxes = document.querySelectorAll(".search-match .file-checkbox");
    } else {
      checkboxes = document.querySelectorAll(".file-checkbox, .folder-checkbox");
    }

    // If there are no checkboxes available (e.g., no search results), handle it gracefully
    if (checkboxes.length === 0) {
      selectAllBtn.innerHTML = '<i class="fas fa-check-square me-1"></i> Select All';
      return;
    }

    const allChecked = Array.from(checkboxes).every((cb) => cb.checked);

    selectAllBtn.innerHTML = allChecked ? '<i class="fas fa-square me-1"></i> Deselect All' : '<i class="fas fa-check-square me-1"></i> Select All';
  }

  // Public API
  return {
    render,
    setupEventListeners,
    updateSearchResults,
    updateSelectAllButton,
    calculateTotalTokens,
  };
})();
