// ./app/static/js/common.js

// Helper function for AJAX POST requests
const ajaxPost = (url, data) =>
  $.ajax({
    url,
    type: "POST",
    contentType: "application/json",
    data: JSON.stringify(data),
  });

// Utility functions for path handling
const isWindows = navigator.platform.includes("Win");
const osPathJoin = (...args) => args.join(isWindows ? "\\" : "/");
const osPathNormalize = (path) => (isWindows ? path.replace(/\//g, "\\") : path.replace(/\\/g, "/"));
