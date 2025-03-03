document.addEventListener("DOMContentLoaded", function () {
  // Token tracking
  let totalTokens = 0;
  const totalTokensElement = document.getElementById("total-tokens");

  // Load complete folder tree when page loads
  const rootFolderContents = document.getElementById("root-folder-contents");
  if (rootFolderContents) {
    // Get current path from URL
    const urlParams = new URLSearchParams(window.location.search);
    const currentPath = urlParams.get("path") || "";

    // Show loading indicator
    rootFolderContents.innerHTML = `
      <li class="py-2 text-center text-muted">
        <i class="fas fa-spinner fa-spin me-2"></i> Loading all files and folders...
      </li>
    `;

    // Load the complete folder tree
    console.log("Loading complete folder tree with root path:", currentPath);
    loadCompleteTree(currentPath, rootFolderContents);
  }

  // Function to toggle the caret icon
  function toggleCaretIcon(icon, isExpanded) {
    if (isExpanded) {
      icon.classList.remove("fa-caret-down");
      icon.classList.add("fa-caret-right");
    } else {
      icon.classList.remove("fa-caret-right");
      icon.classList.add("fa-caret-down");
    }
  }

  // Function to load the complete folder tree
  function loadCompleteTree(rootPath, containerElement) {
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
        setupCheckboxes(document);
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

  // Function to recursively render the folder tree
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
        toggleCaretIcon(icon, isExpanded);
      });

      // Add event listener to checkbox
      const checkbox = dirElement.querySelector(".folder-checkbox");
      checkbox.addEventListener("change", handleFolderCheckboxChange);
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

      // Add event listener to checkbox
      const checkbox = fileElement.querySelector(".file-checkbox");
      checkbox.addEventListener("change", handleFileCheckboxChange);
    });
  }

  // Handle file checkbox changes for token counting
  function handleFileCheckboxChange() {
    const tokenEstimate = parseInt(this.getAttribute("data-token-estimate") || 0);

    if (this.checked) {
      totalTokens += tokenEstimate;
    } else {
      totalTokens -= tokenEstimate;
    }

    updateTotalTokens();
  }

  // Handle folder checkbox changes
  function handleFolderCheckboxChange() {
    const folderPath = this.getAttribute("data-folder-path");
    const folderItem = this.closest(".folder-item");
    const folderTokenCountBadge = folderItem.querySelector(".folder-token-count .token-badge");

    if (this.checked) {
      // Mark the folder as selected
      folderItem.classList.add("selected-folder");

      // Create a hidden input for the folder
      const form = this.closest("form");
      const hiddenInput = document.createElement("input");
      hiddenInput.type = "hidden";
      hiddenInput.name = "selected_folder";
      hiddenInput.value = folderPath;
      hiddenInput.className = "hidden-folder-input";
      hiddenInput.dataset.folderPath = folderPath;
      form.appendChild(hiddenInput);

      // Estimate tokens for this folder
      fetchFolderTokenCount(folderPath, folderTokenCountBadge);
    } else {
      // Remove the selected class
      folderItem.classList.remove("selected-folder");

      // Remove any hidden inputs for this folder
      const form = this.closest("form");
      const hiddenInputs = form.querySelectorAll(`.hidden-folder-input[data-folder-path="${folderPath}"]`);
      hiddenInputs.forEach((input) => input.remove());

      // Subtract tokens for this folder
      const folderTokens = parseInt(folderTokenCountBadge.getAttribute("data-folder-tokens") || 0);
      totalTokens -= folderTokens;
      folderTokenCountBadge.textContent = "0 tokens";
      folderTokenCountBadge.setAttribute("data-folder-tokens", "0");

      updateTotalTokens();
    }

    // Also check/uncheck all visible child files
    const folderContents = folderItem.querySelector(".folder-contents");
    const fileCheckboxes = folderContents.querySelectorAll(".file-checkbox");

    fileCheckboxes.forEach((checkbox) => {
      if (checkbox.checked !== this.checked) {
        checkbox.checked = this.checked;

        // Update token count
        const tokenEstimate = parseInt(checkbox.getAttribute("data-token-estimate") || 0);
        if (this.checked) {
          // We don't add tokens here because they'll be counted in the folder total
        } else {
          // We already subtracted them all via the folder total
        }
      }
    });
  }

  // Fetch token count for a folder
  function fetchFolderTokenCount(folderPath, badgeElement) {
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
          return;
        }

        // Update the badge with the token count
        badgeElement.textContent = `${data.token_count} tokens`;
        badgeElement.setAttribute("data-folder-tokens", data.token_count);

        // Add to total tokens
        totalTokens += data.token_count;
        updateTotalTokens();
      })
      .catch((error) => {
        console.error("Error fetching folder token count:", error);
      });
  }

  // Update the total tokens display
  function updateTotalTokens() {
    if (totalTokensElement) {
      totalTokensElement.textContent = totalTokens.toLocaleString();

      // Change color based on token count
      if (totalTokens > 100000) {
        totalTokensElement.closest(".badge").classList.remove("bg-info", "text-dark", "bg-warning");
        totalTokensElement.closest(".badge").classList.add("bg-danger", "text-white");
      } else if (totalTokens > 50000) {
        totalTokensElement.closest(".badge").classList.remove("bg-info", "text-dark", "bg-danger");
        totalTokensElement.closest(".badge").classList.add("bg-warning", "text-dark");
      } else {
        totalTokensElement.closest(".badge").classList.remove("bg-warning", "bg-danger", "text-white");
        totalTokensElement.closest(".badge").classList.add("bg-info", "text-dark");
      }
    }
  }

  // Function to set up checkboxes (needs to be callable for dynamically loaded content)
  function setupCheckboxes(parentElement) {
    // Initialize event listeners for file checkboxes
    parentElement.querySelectorAll(".file-checkbox").forEach((checkbox) => {
      checkbox.addEventListener("change", handleFileCheckboxChange);
    });

    // Initialize event listeners for folder checkboxes
    parentElement.querySelectorAll(".folder-checkbox").forEach((checkbox) => {
      checkbox.addEventListener("change", handleFolderCheckboxChange);
    });
  }

  // Select All button functionality
  const selectAllBtn = document.getElementById("select-all-btn");
  if (selectAllBtn) {
    selectAllBtn.addEventListener("click", function () {
      const allCheckables = document.querySelectorAll(".file-checkbox, .folder-checkbox");
      const allChecked = Array.from(allCheckables).every((cb) => cb.checked);

      allCheckables.forEach((checkbox) => {
        checkbox.checked = !allChecked;

        // Trigger change event
        const event = new Event("change", { bubbles: true });
        checkbox.dispatchEvent(event);
      });

      // Update button text
      this.innerHTML = allChecked ? '<i class="fas fa-check-square me-1"></i> Select All' : '<i class="fas fa-square me-1"></i> Deselect All';
    });
  }

  // Export setup functions to make them available for dynamically loaded content
  window.setupToggleIcons = setupToggleIcons;
  window.setupCheckboxes = setupCheckboxes;
});
