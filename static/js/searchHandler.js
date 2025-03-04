/**
 * Search functionality for files
 */

// Create a namespace for search handling
var SearchHandler = (function() {
    /**
     * Initialize search functionality
     */
    function initSearch() {
      const searchInput = document.getElementById("search-input");
      const searchButton = document.getElementById("search-button");
      const searchResults = document.getElementById("search-results");
      const searchStats = document.getElementById("search-stats");
      const selectFoundButton = document.getElementById("select-found-files");
      const clearSearchButton = document.getElementById("clear-search");
      
      // If any of the required elements don't exist, don't initialize
      if (!searchInput || !searchButton || !searchResults || !searchStats) {
        return;
      }
      
      // Search button click handler
      searchButton.addEventListener("click", function() {
        performSearch(searchInput.value);
      });
      
      // Enter key handler for search input
      searchInput.addEventListener("keyup", function(event) {
        if (event.key === "Enter") {
          performSearch(searchInput.value);
        }
      });
      
      // Select all found files button
      if (selectFoundButton) {
        selectFoundButton.addEventListener("click", function() {
          selectFoundFiles();
        });
      }
      
      // Clear search button
      if (clearSearchButton) {
        clearSearchButton.addEventListener("click", function() {
          clearSearch();
        });
      }
    }
    
    /**
     * Perform search on files
     * @param {string} query - Search query
     */
    function performSearch(query) {
      const searchInput = document.getElementById("search-input");
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
            searchStats.innerHTML = `<i class="fas fa-check-circle me-2 text-success"></i> Found "${query}" in ${data.count} file${data.count !== 1 ? 's' : ''}`;
            
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
      matchingFiles.forEach(file => {
        const checkbox = document.querySelector(`.file-checkbox[value="${file.path}"]`);
        if (checkbox) {
          const fileItem = checkbox.closest(".file-item");
          fileItem.classList.add("search-match");
          
          // Add a tooltip with match info
          const nameElement = fileItem.querySelector(".file-name");
          if (nameElement) {
            // Create match info tooltip content
            let tooltipContent = `Found ${file.match_count} match${file.match_count !== 1 ? 'es' : ''}`;
            
            if (file.matching_lines && file.matching_lines.length > 0) {
              tooltipContent += ":<br>";
              file.matching_lines.forEach(line => {
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
      document.querySelectorAll(".search-match").forEach(element => {
        element.classList.remove("search-match");
      });
      
      // Destroy all tooltips
      document.querySelectorAll('[data-bs-toggle="tooltip"]').forEach(element => {
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
        foundFiles.forEach(file => {
          const checkbox = document.querySelector(`.file-checkbox[value="${file.path}"]`);
          if (checkbox && !checkbox.checked) {
            checkbox.checked = true;
          }
        });
        
        // Instead of triggering change events for each checkbox, do a single recalculation
        setTimeout(() => {
          TokenCounter.recalculateTokens();
        }, 50);
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
      
      // Recalculate tokens to ensure accuracy
      setTimeout(() => {
        TokenCounter.recalculateTokens();
      }, 50);
    }
    
    // Return public functions
    return {
      initSearch: initSearch,
      performSearch: performSearch
    };
  })();