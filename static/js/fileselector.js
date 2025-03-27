/**
 * File Selector Dialog module for rendering and handling user interactions
 */
const FileSelector = (function () {
  // Module state
  let treeData = null,
    tokenCount = 0,
    selectedFiles = [],
    selectedFolders = [],
    isSearchActive = false,
    matchingFiles = [];

  // Render the file selector dialog
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
        <div class="card-body p-0">
          <form id="file-selection-form">
            <!-- Action buttons - sticky header -->
            <div class="sticky-header">
              <div class="d-flex justify-content-between p-3 bg-body border-bottom">
                <div class="d-flex align-items-center flex-grow-1 me-3">
                  <button type="button" id="back-button" class="btn btn-outline-secondary me-3 d-flex align-items-center justify-content-center" style="height: 38px; min-width: 80px;">
                    <i class="fas fa-arrow-left me-1"></i> Back
                  </button>
                  
                  <!-- Search input moved here, with improved styling -->
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

  // Render the tree recursively
  function renderTree(node) {
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
              <ul class="list-unstyled ms-4 folder-contents" data-folder-path="${dir.path}">${renderTree(dir)}</ul>
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

  // Render search results
  function renderSearchResults(matches) {
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
            <div class="file-name text-truncate">${file.name}</div>
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

  // Set up event listeners
  function setupEventListeners(submitCallback) {
    updateTokenCount();

    // Back button
    const backButton = document.getElementById("back-button");
    if (backButton) {
      backButton.addEventListener("click", () => App.showPromptDialog());
    }

    // Setup checkbox handlers
    setupCheckboxes();

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
    const selectAllBtn = document.getElementById("select-all-btn");
    if (selectAllBtn) {
      selectAllBtn.addEventListener("click", function () {
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
      });
    }

    // Setup search functionality
    setupSearch();

    // Form submission
    const fileSelectionForm = document.getElementById("file-selection-form");
    if (fileSelectionForm) {
      fileSelectionForm.addEventListener("submit", function (event) {
        event.preventDefault();

        if (selectedFiles.length === 0 && selectedFolders.length === 0) {
          Utilities.showError("Please select at least one file or folder before generating.", "file-selection-form", "file-selector-error");
          return;
        }

        submitCallback({
          files: selectedFiles,
          folders: selectedFolders,
          tokenCount: tokenCount,
        });
      });
    }
  }

  // Combined setup for file and folder checkboxes
  function setupCheckboxes() {
    // File checkboxes
    document.querySelectorAll(".file-checkbox").forEach((checkbox) => {
      checkbox.addEventListener("change", function () {
        const filePath = this.value;

        if (this.checked) {
          if (!selectedFiles.includes(filePath)) selectedFiles.push(filePath);
        } else {
          const index = selectedFiles.indexOf(filePath);
          if (index !== -1) selectedFiles.splice(index, 1);
        }

        recalculateTokens();
      });
    });

    // Folder checkboxes
    document.querySelectorAll(".folder-checkbox").forEach((checkbox) => {
      checkbox.addEventListener("change", function () {
        const folderPath = this.getAttribute("data-folder-path");
        const folderItem = this.closest(".folder-item");
        const childFiles = folderItem.querySelectorAll(".file-checkbox");

        if (this.checked) {
          // Add folder and mark as selected
          if (!selectedFolders.includes(folderPath)) selectedFolders.push(folderPath);
          folderItem.classList.add("selected-folder");

          // Check all child files
          childFiles.forEach((fileCheckbox) => {
            fileCheckbox.checked = true;
            const filePath = fileCheckbox.value;
            if (!selectedFiles.includes(filePath)) selectedFiles.push(filePath);
          });

          // Fetch folder token count if needed
          const tokenBadge = folderItem.querySelector(".token-badge");
          const currentTokens = parseInt(tokenBadge.getAttribute("data-folder-tokens") || "0");
          if (currentTokens === 0) fetchFolderTokenCount(folderPath, tokenBadge);
        } else {
          // Remove folder and selected class
          const index = selectedFolders.indexOf(folderPath);
          if (index !== -1) selectedFolders.splice(index, 1);
          folderItem.classList.remove("selected-folder");

          // Uncheck all child files
          childFiles.forEach((fileCheckbox) => {
            fileCheckbox.checked = false;
            const filePath = fileCheckbox.value;
            const fileIndex = selectedFiles.indexOf(filePath);
            if (fileIndex !== -1) selectedFiles.splice(fileIndex, 1);
          });
        }

        recalculateTokens();
      });
    });
  }

  // Setup search functionality
  function setupSearch() {
    const searchInput = document.getElementById("search-input");
    const searchButton = document.getElementById("search-button");
    const searchStatus = document.getElementById("search-status");
    const fileSelectionForm = document.getElementById("file-selection-form");

    if (!searchInput || !searchButton || !searchStatus) return;

    // Prevent form submission when pressing Enter in search input
    searchInput.addEventListener("keydown", function (event) {
      if (event.key === "Enter") {
        // Prevent the default form submission
        event.preventDefault();

        const query = this.value.trim();
        if (query === "") {
          // Clear search if input is empty
          clearSearch();
        } else {
          performSearch(query);
        }
      }
    });

    // Search button click
    searchButton.addEventListener("click", () => {
      const query = searchInput.value.trim();
      if (query === "") {
        // Clear search if input is empty
        clearSearch();
      } else {
        performSearch(query);
      }
    });

    // Clear search button
    const clearSearchButton = document.getElementById("clear-search");
    if (clearSearchButton) {
      clearSearchButton.addEventListener("click", (event) => {
        // Prevent form submission
        event.preventDefault();
        clearSearch();
      });
    }
  }

  // Perform search on files
  function performSearch(query) {
    const searchStats = document.getElementById("search-stats");
    const searchStatus = document.getElementById("search-status");
    const rootFolder = document.getElementById("root-folder-contents");

    if (query.length < 3) {
      alert("Please enter at least 3 characters for search");
      return;
    }

    // Show loading state
    searchStatus.classList.remove("d-none");
    searchStats.innerHTML = `<i class="fas fa-spinner fa-spin me-2"></i> Searching for "${query}"...`;

    // Create form data and fetch
    const formData = new FormData();
    formData.append("search_query", query);

    Utilities.fetchJSON(
      "/api/search_files",
      { method: "POST", body: formData },
      (data) => {
        if (data.error) {
          searchStats.innerHTML = `<i class="fas fa-exclamation-circle me-2 text-danger"></i> Error: ${data.error}`;
          return;
        }

        // Update module state
        isSearchActive = true;
        matchingFiles = data.matching_files;

        // Update search stats
        if (data.count > 0) {
          searchStats.innerHTML = `<i class="fas fa-check-circle me-2 text-success"></i> Found "${query}" in ${data.count} file${data.count !== 1 ? "s" : ""}`;

          // Update the tree view to only show matching files
          rootFolder.innerHTML = renderSearchResults(matchingFiles);

          // Rebind checkbox events
          setupCheckboxes();

          // Update Select All button text based on current selection state
          updateSelectAllButton();
        } else {
          searchStats.innerHTML = `<i class="fas fa-info-circle me-2"></i> No files found containing "${query}"`;
          rootFolder.innerHTML = renderSearchResults([]);
        }
      },
      (error) => {
        console.error("Error searching files:", error);
        searchStats.innerHTML = `<i class="fas fa-exclamation-circle me-2 text-danger"></i> Error searching files: ${error.message}`;
      }
    );
  }

  // Update Select All button text based on current selection state
  function updateSelectAllButton() {
    const selectAllBtn = document.getElementById("select-all-btn");
    if (!selectAllBtn) return;

    let checkboxes;

    if (isSearchActive) {
      // Only check search results when search is active
      checkboxes = document.querySelectorAll(".search-match .file-checkbox");
    } else {
      // Check all files and folders when no search is active
      checkboxes = document.querySelectorAll(".file-checkbox, .folder-checkbox");
    }

    const allChecked = Array.from(checkboxes).every((cb) => cb.checked);

    selectAllBtn.innerHTML = allChecked ? '<i class="fas fa-square me-1"></i> Deselect All' : '<i class="fas fa-check-square me-1"></i> Select All';
  }

  // Clear search results and restore original tree
  function clearSearch() {
    const searchInput = document.getElementById("search-input");
    const searchStatus = document.getElementById("search-status");
    const rootFolder = document.getElementById("root-folder-contents");

    if (searchInput) searchInput.value = "";

    if (searchStatus) {
      searchStatus.classList.add("d-none");
    }

    // Only restore tree if search was active
    if (isSearchActive) {
      isSearchActive = false;
      matchingFiles = [];

      // Restore the original tree
      rootFolder.innerHTML = renderTree(treeData);

      // Rebind events
      setupCheckboxes();

      // Rebind folder toggle events
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

      // Update Select All button text
      updateSelectAllButton();
    }
  }

  // Fetch token count for a folder
  function fetchFolderTokenCount(folderPath, badgeElement) {
    badgeElement.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';

    const formData = new FormData();
    formData.append("folder_path", folderPath);

    Utilities.fetchJSON(
      "/api/get_folder_token_count",
      { method: "POST", body: formData },
      (data) => {
        if (data.error) {
          console.error("Error fetching token count:", data.error);
          badgeElement.textContent = "0 tokens";
          return;
        }

        badgeElement.textContent = `${data.token_count} tokens`;
        badgeElement.setAttribute("data-folder-tokens", data.token_count);
        recalculateTokens();
      },
      (error) => {
        console.error("Error fetching folder token count:", error);
        badgeElement.textContent = "0 tokens";
      }
    );
  }

  // Calculate total token count
  function recalculateTokens() {
    let totalTokens = 0;
    const countedFilePaths = new Set();

    // Count folders first
    document.querySelectorAll(".folder-checkbox:checked").forEach((checkbox) => {
      const folderItem = checkbox.closest(".folder-item");
      const tokenBadge = folderItem.querySelector(".token-badge");

      if (tokenBadge) {
        const folderTokens = parseInt(tokenBadge.getAttribute("data-folder-tokens") || 0);
        if (!isNaN(folderTokens) && folderTokens > 0) {
          totalTokens += folderTokens;

          // Mark all files in this folder as counted
          folderItem.querySelectorAll(".file-checkbox").forEach((fileCheckbox) => {
            countedFilePaths.add(fileCheckbox.value);
          });
        }
      }
    });

    // Count checked files not in counted folders
    document.querySelectorAll(".file-checkbox:checked").forEach((checkbox) => {
      const filePath = checkbox.value;
      if (countedFilePaths.has(filePath)) return;

      const tokenEstimate = parseInt(checkbox.getAttribute("data-token-estimate") || 0);
      if (!isNaN(tokenEstimate)) totalTokens += tokenEstimate;
    });

    // Update token count
    tokenCount = totalTokens;
    updateTokenCount();

    // Update Select All button to reflect current state
    updateSelectAllButton();
  }

  // Update token count display
  function updateTokenCount() {
    const totalTokensElement = document.getElementById("total-tokens");
    if (!totalTokensElement) return;

    totalTokensElement.textContent = tokenCount.toLocaleString();

    const badgeElement = totalTokensElement.closest(".badge");
    if (!badgeElement) return;

    // Set color based on count
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

  // Public API
  return {
    render,
    setupEventListeners,
  };
})();
