/**
 * Tree view functionality for folders and files
 */

// Create a namespace for tree view
var TreeView = (function() {
  /**
   * Load the complete folder tree from the server
   * @param {string} rootPath - The root path to start from
   * @param {HTMLElement} containerElement - The container to render the tree in
   */
  function loadCompleteTree(rootPath, containerElement) {
    // Show loading indicator
    containerElement.innerHTML = `
      <li class="py-2 text-center text-muted">
        <i class="fas fa-spinner fa-spin me-2"></i> Loading all files and folders...
      </li>
    `;

    // Create form data for the request
    const formData = new FormData();
    formData.append("root_path", rootPath);

    // Fetch request to get the complete folder tree
    fetch("/api/get_complete_folder_tree", {
      method: "POST",
      body: formData,
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json();
      })
      .then((tree) => {
        console.log("Got complete folder tree:", tree);

        // Clear loading indicator
        containerElement.innerHTML = "";

        if (tree.error) {
          containerElement.innerHTML = `
          <li class="py-2 text-center text-danger">
            <i class="fas fa-exclamation-circle me-2"></i> ${tree.error}
          </li>
        `;
          return;
        }

        // Render the tree recursively
        renderFolderTree(tree, containerElement);

        // Set up all event listeners
        CheckboxHandler.setupCheckboxes(document);
      })
      .catch((error) => {
        console.error("Error fetching folder tree:", error);
        containerElement.innerHTML = `
        <li class="py-2 text-center text-danger">
          <i class="fas fa-exclamation-circle me-2"></i> Error loading folder tree: ${error.message}
        </li>
      `;
        console.error("Error details:", error);
      });
  }

  /**
   * Recursively render the folder tree
   * @param {Object} node - The tree node to render
   * @param {HTMLElement} containerElement - The container to render in
   */
  function renderFolderTree(node, containerElement) {
    // If this is an empty folder
    if (node.dirs.length === 0 && node.files.length === 0) {
      containerElement.innerHTML = `
        <li class="py-2 text-center text-muted">
          <i class="fas fa-folder-open me-2"></i> Empty folder
        </li>
      `;
      return;
    }

    // Add directories first
    node.dirs.forEach((dir, index) => {
      const dirElement = document.createElement("li");
      dirElement.className = "tree-item folder-item";
      // Create a unique ID for this subfolder
      const subfolderId = `sub-folder-${dir.path.replace(/[\/\.\s]/g, "-")}-${index}`;

      dirElement.innerHTML = `
        <div class="d-flex align-items-center p-2 border-bottom">
          <div class="me-2">
            <input type="checkbox" class="form-check-input folder-checkbox" data-folder-path="${dir.path}" />
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
            <span class="badge bg-light text-secondary token-badge" data-folder-tokens="${dir.token_count || 0}">${dir.token_count || 0} tokens</span>
          </div>
        </div>
        <div class="collapse show" id="${subfolderId}">
          <ul class="list-unstyled ms-4 folder-contents" data-folder-path="${dir.path}"></ul>
        </div>
      `;

      containerElement.appendChild(dirElement);

      // Get the subfolder container to render its contents
      const subfolderContainer = dirElement.querySelector(".folder-contents");
      renderFolderTree(dir, subfolderContainer);

      // Add click event for the toggle icon
      const toggleIcon = dirElement.querySelector(".toggle-icon");
      toggleIcon.addEventListener("click", function () {
        const collapseElement = document.getElementById(subfolderId);
        const isExpanded = collapseElement.classList.contains("show");
        const icon = this.querySelector("i");
        Utils.toggleCaretIcon(icon, isExpanded);
      });
    });

    // Add files
    node.files.forEach((file) => {
      const fileElement = document.createElement("li");
      fileElement.className = "tree-item file-item";
      const tokenEstimate = file.token_count || Math.round(file.size / 4); // Use actual token count if available, otherwise estimate

      fileElement.innerHTML = `
        <div class="d-flex align-items-center p-2 border-bottom">
          <div class="me-2">
            <input 
              type="checkbox" 
              class="form-check-input file-checkbox" 
              name="selected_files" 
              value="${file.path}" 
              data-size="${file.size}"
              data-token-estimate="${tokenEstimate}"
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
            <span class="badge bg-light text-secondary me-2">${file.type}</span>
            <span class="badge bg-light text-secondary me-2">
              ${file.size < 1024 ? file.size + " B" : file.size < 1048576 ? (file.size / 1024).toFixed(1) + " KB" : (file.size / 1048576).toFixed(1) + " MB"}
            </span>
            <span class="badge bg-light text-secondary token-badge" data-token-estimate="${tokenEstimate}">
              ${tokenEstimate} tokens
            </span>
          </div>
        </div>
      `;

      containerElement.appendChild(fileElement);
    });
  }

  // Return public functions
  return {
    loadCompleteTree: loadCompleteTree,
    renderFolderTree: renderFolderTree
  };
})();