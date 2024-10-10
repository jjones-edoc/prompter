// ./static/js/scripts.js

$(document).ready(function () {
  // Assume SELECTED_FILES is defined globally via the template
  let selectedFiles = new Set(SELECTED_FILES);

  function listDirectory(path, parentElement, source = "folder_click") {
    $.ajax({
      url: "/list_directory",
      type: "POST",
      contentType: "application/json",
      data: JSON.stringify({ path: path, source: source }), // Include source
      success: function (response) {
        if (response.error) {
          alert(response.error);
          return;
        }

        const currentPath = response.current_path;
        const directories = response.directories;
        const files = response.files;

        // Create a new list element for the current directory
        const newList = $('<ul class="nested-list"></ul>'); // Use a custom class for nested lists

        // List directories
        directories.forEach(function (dir) {
          const dirPath = osPathJoin(currentPath, dir);
          const listItem = $(`
            <li class="folder-item" data-path="${dirPath}">
              <i class="fa fa-chevron-right me-2 toggle-icon"></i>
              <i class="fa fa-folder me-2 folder-icon"></i>
              ${dir}
            </li>
          `);
          newList.append(listItem);
        });

        // List files
        files.forEach(function (file) {
          const filePath = osPathJoin(currentPath, file);
          const isSelected = selectedFiles.has(filePath);
          const selectIcon = isSelected
            ? `<i class="fa fa-minus deselect-icon"></i>` // Changed to fa-minus
            : `<i class="fa fa-plus select-icon"></i>`;
          const listItem = $(`
            <li class="file-item ${isSelected ? "selected-file" : ""}" data-path="${filePath}">
              <i class="fa fa-file me-2"></i>
              ${file}
              ${selectIcon}
            </li>
          `);
          newList.append(listItem);
        });

        // Append the new list to the parent element's <li> or main explorer
        parentElement.append(newList);
      },
      error: function (xhr) {
        alert(xhr.responseJSON.error);
      },
    });
  }

  // Function to read file content
  function readFile(filePath) {
    $.ajax({
      url: "/read_file",
      type: "POST",
      contentType: "application/json",
      data: JSON.stringify({ file_path: filePath }),
      success: function (response) {
        if (response.error) {
          alert(response.error);
          return;
        }
        $("#content-area").val(response.content);
      },
      error: function (xhr) {
        alert(xhr.responseJSON.error);
      },
    });
  }

  // Handle clear all selected items button (clear-selection)
  $("#clear-selection").on("click", function () {
    console.log("Clear Selection button clicked"); // Debugging log
    // Send AJAX request to clear all selected files
    $.ajax({
      url: "/clear_all_selected_files",
      type: "POST",
      contentType: "application/json",
      success: function (response) {
        if (response.error) {
          alert(response.error);
          return;
        }
        // Clear the selectedFiles set and redraw all file items
        selectedFiles.clear();
        $(".file-item").each(function () {
          redrawFileItem($(this), $(this).data("path"), false);
        });
        console.log("Cleared all selected files");
      },
      error: function (xhr) {
        alert(xhr.responseJSON.error);
      },
    });
  });

  // Handle folder selection via button
  $("#select-folder").on("click", function () {
    console.log("Select Folder button clicked"); // Debugging log
    // Prompt user to enter a folder path
    const path = prompt("Enter the path of the folder to open:", "");
    if (path) {
      // Normalize the path based on the operating system
      const normalizedPath = osPathNormalize(path);
      // List directory contents in the main explorer
      $("#directory-list").empty(); // Clear existing list
      listDirectory(normalizedPath, $("#directory-list"), "select_folder"); // Specify source
    }
  });

  // Handle click on folder or file using event delegation
  $("#directory-list").on("click", ".folder-item", function (e) {
    e.stopPropagation(); // Prevent event bubbling
    const folderItem = $(this);
    const path = folderItem.data("path");

    // Toggle expansion
    if (folderItem.hasClass("expanded")) {
      // Collapse the folder
      folderItem.children("ul.nested-list").remove(); // Remove nested <ul>
      folderItem.removeClass("expanded");

      // Toggle the chevron icon
      folderItem.find(".toggle-icon").removeClass("fa-chevron-down").addClass("fa-chevron-right");
      // Toggle the folder icon back to closed
      folderItem.find(".folder-icon").removeClass("fa-folder-open").addClass("fa-folder");

      console.log(`Collapsed folder: ${path}`);
    } else {
      // Expand the folder
      listDirectory(path, folderItem, "folder_click"); // Specify source
      folderItem.addClass("expanded");

      // Toggle the chevron icon
      folderItem.find(".toggle-icon").removeClass("fa-chevron-right").addClass("fa-chevron-down");
      // Toggle the folder icon to open
      folderItem.find(".folder-icon").removeClass("fa-folder").addClass("fa-folder-open");

      console.log(`Expanded folder: ${path}`);
    }
  });

  // Handle click on file item (to read content)
  $("#directory-list").on("click", ".file-item", function (e) {
    // Check if the click was on the icon
    if ($(e.target).hasClass("select-icon") || $(e.target).hasClass("deselect-icon")) {
      // Click was on the icon, do not trigger readFile
      return;
    }

    e.stopPropagation(); // Prevent event bubbling
    const fileItem = $(this);
    const path = fileItem.data("path");
    readFile(path);
  });

  // Handle click on select icon
  $("#directory-list").on("click", ".select-icon", function (e) {
    e.stopPropagation(); // Prevent event bubbling
    const fileItem = $(this).closest(".file-item");
    const path = fileItem.data("path");

    // Send AJAX request to select the file
    $.ajax({
      url: "/select_file",
      type: "POST",
      contentType: "application/json",
      data: JSON.stringify({ file_path: path }),
      success: function (response) {
        if (response.error) {
          alert(response.error);
          return;
        }
        // Update the selectedFiles set and redraw the item
        selectedFiles.add(path);
        redrawFileItem(fileItem, path, true);
        console.log(`Selected file: ${path}`);
      },
      error: function (xhr) {
        alert(xhr.responseJSON.error);
      },
    });
  });

  // Handle click on deselect icon
  $("#directory-list").on("click", ".deselect-icon", function (e) {
    e.stopPropagation(); // Prevent event bubbling
    const fileItem = $(this).closest(".file-item");
    const path = fileItem.data("path");

    // Send AJAX request to deselect the file
    $.ajax({
      url: "/deselect_file",
      type: "POST",
      contentType: "application/json",
      data: JSON.stringify({ file_path: path }),
      success: function (response) {
        if (response.error) {
          alert(response.error);
          return;
        }
        // Update the selectedFiles set and redraw the item
        selectedFiles.delete(path);
        redrawFileItem(fileItem, path, false);
        console.log(`Deselected file: ${path}`);
      },
      error: function (xhr) {
        alert(xhr.responseJSON.error);
      },
    });
  });

  // Function to redraw a file item
  function redrawFileItem(fileItem, path, isSelected) {
    const selectIcon = isSelected
      ? `<i class="fa fa-minus deselect-icon"></i>` // Deselect icon
      : `<i class="fa fa-plus select-icon"></i>`; // Select icon
    const newItem = $(`
    <li class="file-item ${isSelected ? "selected-file" : ""}" data-path="${path}">
      <i class="fa fa-file me-2"></i>
      ${path.split(/[/\\]/).pop()}  <!-- Extracting just the file name -->
      ${selectIcon}
    </li>
  `);
    fileItem.replaceWith(newItem);
  }

  // Utility functions for path handling
  function osPathJoin(...args) {
    if (navigator.platform.indexOf("Win") !== -1) {
      return args.join("\\");
    } else {
      return args.join("/");
    }
  }

  function osPathNormalize(path) {
    if (navigator.platform.indexOf("Win") !== -1) {
      return path.replace(/\//g, "\\");
    } else {
      return path.replace(/\\/g, "/");
    }
  }

  // Automatically load the last accessed path on page load
  if (LAST_PATH) {
    console.log("Loading last accessed path:", LAST_PATH); // Debugging log
    // Normalize the path
    const normalizedPath = osPathNormalize(LAST_PATH);
    // List directory contents in the main explorer
    listDirectory(normalizedPath, $("#directory-list"), "select_folder"); // Specify source
  }
});
