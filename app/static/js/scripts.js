// ./static/js/scripts.js

$(document).ready(function () {
  console.log("scripts.js loaded"); // Debugging log

  // Function to list directory contents
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
          const listItem = $(`
                        <li class="file-item" data-path="${filePath}">
                            <i class="fa fa-file me-2"></i>
                            ${file}
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

  $("#directory-list").on("click", ".file-item", function (e) {
    e.stopPropagation(); // Prevent event bubbling
    const fileItem = $(this);
    const path = fileItem.data("path");
    readFile(path);
  });

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
