// ./app/static/js/explorer.js

// Function to render a file item
const renderFileItem = (path, isSelected) => `
  <li class="file-item ${isSelected ? "selected-file" : ""}" data-path="${path}">
    <i class="fa fa-file me-2"></i>
    ${path.split(/[/\\]/).pop()}
    <i class="fa fa-${isSelected ? "minus deselect-icon" : "plus select-icon"}"></i>
  </li>
`;

// Function to render a folder item
const renderFolderItem = (path, dir) => `
  <li class="folder-item" data-path="${path}">
    <i class="fa fa-chevron-right me-2 toggle-icon"></i>
    <i class="fa fa-folder me-2 folder-icon"></i>
    ${dir}
  </li>
`;

$(document).ready(() => {
  const selectedFiles = new Set(SELECTED_FILES);
  const $directoryList = $("#directory-list");
  const $contentArea = $("#content-area");
  const $clearSelection = $("#clear-selection");
  const $selectFolder = $("#select-folder");

  // Function to list directory contents
  const listDirectory = (path, parent, source) => {
    ajaxPost("/explorer/list_directory", { path, source })
      .done(({ error, current_path, directories, files }) => {
        if (error) return alert(error);
        const $list = $('<ul class="nested-list"></ul>');
        directories.forEach((dir) => {
          const dirPath = osPathJoin(current_path, dir);
          $list.append(renderFolderItem(dirPath, dir));
        });
        files.forEach((file) => {
          const filePath = osPathJoin(current_path, file);
          $list.append(renderFileItem(filePath, selectedFiles.has(filePath)));
        });
        parent.append($list);
      })
      .fail((xhr) => alert(xhr.responseJSON?.error || "An error occurred"));
  };

  // Function to read file content
  const readFile = (filePath) => {
    ajaxPost("/explorer/read_file", { file_path: filePath })
      .done(({ error, content }) => {
        if (error) return alert(error);
        $contentArea.val(content);
      })
      .fail((xhr) => alert(xhr.responseJSON?.error || "An error occurred"));
  };

  // Function to update file item UI
  const updateFileItem = ($item, isSelected) => {
    $item.replaceWith(renderFileItem($item.data("path"), isSelected));
  };

  // Clear all selected files
  $clearSelection.on("click", () => {
    ajaxPost("/explorer/clear_all_selected_files", {})
      .done(({ error }) => {
        if (error) return alert(error);
        selectedFiles.clear();
        $(".file-item").each(function () {
          updateFileItem($(this), false);
        });
      })
      .fail((xhr) => alert(xhr.responseJSON?.error || "An error occurred"));
  });

  // Select a folder
  $selectFolder.on("click", () => {
    const path = prompt("Enter the path of the folder to open:", "");
    if (path) {
      listDirectory(osPathNormalize(path), $directoryList, "select_folder");
    }
  });

  // Toggle folder expansion
  $directoryList.on("click", ".folder-item", function (e) {
    e.stopPropagation();
    const $folder = $(this);
    const path = $folder.data("path");
    if ($folder.hasClass("expanded")) {
      $folder.find("> ul.nested-list").remove();
      $folder
        .removeClass("expanded")
        .find(".toggle-icon")
        .removeClass("fa-chevron-down")
        .addClass("fa-chevron-right")
        .end()
        .find(".folder-icon")
        .removeClass("fa-folder-open")
        .addClass("fa-folder");
    } else {
      listDirectory(path, $folder, "folder_click");
      $folder
        .addClass("expanded")
        .find(".toggle-icon")
        .removeClass("fa-chevron-right")
        .addClass("fa-chevron-down")
        .end()
        .find(".folder-icon")
        .removeClass("fa-folder")
        .addClass("fa-folder-open");
    }
  });

  // Handle file item clicks
  $directoryList.on("click", ".file-item", function (e) {
    if ($(e.target).is(".select-icon, .deselect-icon")) return;
    e.stopPropagation();
    readFile($(this).data("path"));
  });

  // Handle select/deselect icons
  $directoryList.on("click", ".select-icon, .deselect-icon", function (e) {
    e.stopPropagation();
    const $fileItem = $(this).closest(".file-item");
    const path = $fileItem.data("path");
    const isSelecting = $(this).hasClass("select-icon");
    const url = isSelecting ? "/explorer/select_file" : "/explorer/deselect_file";

    ajaxPost(url, { file_path: path })
      .done(({ error }) => {
        if (error) return alert(error);
        if (isSelecting) {
          selectedFiles.add(path);
        } else {
          selectedFiles.delete(path);
        }
        updateFileItem($fileItem, isSelecting);
      })
      .fail((xhr) => alert(xhr.responseJSON?.error || "An error occurred"));
  });

  // Load the last accessed path on page load
  if (typeof LAST_PATH !== "undefined" && LAST_PATH) {
    listDirectory(osPathNormalize(LAST_PATH), $directoryList, "select_folder");
  }
});
