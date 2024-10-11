$(document).ready(() => {
  hljs.highlightAll();

  // State
  let slices = [];
  let promptSlices = [];

  // DOM Elements
  const slicesListEl = document.getElementById("slicesList");
  const promptAreaEl = document.getElementById("promptArea");
  const addSliceForm = document.getElementById("addSliceForm");
  const sliceTypeEl = document.getElementById("sliceType");
  const sliceContentEl = document.getElementById("sliceContent");
  const buildPromptBtn = document.getElementById("buildPromptBtn");
  const finalPromptEl = document.getElementById("finalPrompt");
  const searchInputEl = document.getElementById("searchInput");
  const toastContainerEl = document.querySelector(".toast-container");
  const copyPromptBtn = document.getElementById("copyPromptBtn");
  const clearPromptBtn = document.getElementById("clearPromptBtn");

  // Utility Functions
  function showToast(message, type = "success") {
    const toastId = `toast${Date.now()}`;
    const toastHTML = `
        <div id="${toastId}" class="toast align-items-center text-bg-${type} border-0" role="alert" aria-live="assertive" aria-atomic="true">
          <div class="d-flex">
            <div class="toast-body">
              ${message}
            </div>
            <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
          </div>
        </div>
      `;
    toastContainerEl.insertAdjacentHTML("beforeend", toastHTML);
    const toastEl = document.getElementById(toastId);
    const bsToast = new bootstrap.Toast(toastEl, { delay: 3000 });
    bsToast.show();
    toastEl.addEventListener("hidden.bs.toast", () => {
      toastEl.remove();
    });
  }

  function loadSlices() {
    ajaxPost("/builder/get_all", {})
      .done(({ error, all_slices }) => {
        if (error) return alert(error);
        slices = all_slices;
        renderSlicesList();
      })
      .fail((xhr) => alert(xhr.responseJSON?.error || "An error occurred"));
  }

  function renderSlicesList(filter = "") {
    console.log(slices);
    slicesListEl.innerHTML = "";
    const filteredSlices = slices.filter((slice) => {
      return slice.content.toLowerCase().includes(filter.toLowerCase()) || slice.type.toLowerCase().includes(filter.toLowerCase());
    });
    if (filteredSlices.length === 0) {
      slicesListEl.innerHTML = "<p>No slices found.</p>";
      return;
    }
    filteredSlices.forEach((slice) => {
      const sliceCard = document.createElement("div");
      sliceCard.className = "card slice-card";
      sliceCard.innerHTML = `
          <div class="card-body">
            <div class="slice-buttons">
              <button class="btn btn-sm btn-success add-to-prompt-btn" data-id="${slice.id}" title="Add to Prompt">
                <i class="fas fa-plus"></i>
              </button>
              <button class="btn btn-sm btn-danger delete-slice-btn" data-id="${slice.id}" title="Delete Slice">
                <i class="fas fa-trash"></i>
              </button>
            </div>
            <h5 class="card-title text-capitalize">${capitalizeFirstLetter(slice.type)} Slice</h5>
            <p class="card-text">
              ${
                slice.type !== "text"
                  ? `<pre><code class="${slice.language || "plaintext"}">${escapeHtml(slice.content)}</code></pre>`
                  : escapeHtml(slice.content)
              }
            </p>
          </div>
        `;
      slicesListEl.appendChild(sliceCard);
    });
    // Re-highlight any new code blocks
    hljs.highlightAll();
  }

  function renderPromptArea() {
    promptAreaEl.innerHTML = "";
    console.log(promptSlices);
    promptSlices.forEach((slice) => {
      const sliceDiv = document.createElement("div");
      sliceDiv.className = "prompt-slice";
      sliceDiv.setAttribute("data-id", slice.id);
      sliceDiv.innerHTML = `
          <div class="d-flex justify-content-between align-items-center">
            <span class="me-2 text-capitalize">${capitalizeFirstLetter(slice.type)}</span>
            <div>
              <button class="btn btn-sm btn-danger remove-from-prompt-btn" data-id="${slice.id}" title="Remove from Prompt">
                <i class="fas fa-trash"></i>
              </button>
            </div>
          </div>
          <div class="mt-2">
            ${
              slice.type !== "text"
                ? `<pre><code class="${slice.language || "plaintext"}">${escapeHtml(slice.content)}</code></pre>`
                : escapeHtml(slice.content)
            }
          </div>
        `;
      promptAreaEl.appendChild(sliceDiv);
    });
    hljs.highlightAll();
  }

  function buildFinalPrompt() {
    let finalPrompt = "";
    promptSlices.forEach((slice) => {
      if (slice.type !== "text") {
        finalPrompt += `\`\`\`${slice.language || ""}\n${slice.content}\n\`\`\`\n\n`;
      } else {
        finalPrompt += `${slice.content}\n\n`;
      }
    });
    finalPromptEl.textContent = finalPrompt.trim();
    hljs.highlightAll();
  }

  function escapeHtml(text) {
    const map = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;",
    };
    return text.replace(/[&<>"']/g, function (m) {
      return map[m];
    });
  }

  function capitalizeFirstLetter(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
  }

  // Event Handlers
  addSliceForm.addEventListener("submit", function (e) {
    e.preventDefault();
    const type = sliceTypeEl.value;
    let content = sliceContentEl.value.trim();

    if (!content) {
      showToast("Content cannot be empty.", "warning");
      return;
    }

    const newSlice = {
      type: type,
      content: content,
    };

    ajaxPost("/builder/add", newSlice)
      .done(({ error, slice }) => {
        if (error) return alert(error);
        slices.push(slice);
        renderSlicesList(searchInputEl.value);
        showToast("Slice added successfully!");
        addSliceForm.reset();
        document.getElementById("addSliceModal").querySelector(".btn-close").click();
      })
      .fail((xhr) => alert(xhr.responseJSON?.error || "An error occurred"));
  });

  slicesListEl.addEventListener("click", function (e) {
    if (e.target.closest(".add-to-prompt-btn")) {
      const sliceId = parseInt(e.target.closest(".add-to-prompt-btn").dataset.id);
      const slice = slices.find((s) => s.id === sliceId);
      if (slice && !promptSlices.find((s) => s.id === sliceId)) {
        promptSlices.push(slice);
        renderPromptArea();
        showToast("Slice added to prompt.");
      } else {
        showToast("Slice already in prompt.", "warning");
      }
    }

    if (e.target.closest(".delete-slice-btn")) {
      const sliceId = parseInt(e.target.closest(".delete-slice-btn").dataset.id);
      // make ajax call to delete slice
      ajaxPost("/builder/delete", { id: sliceId })
        .done(({ error }) => {
          if (error) return alert(error);
          slices = slices.filter((s) => s.id !== sliceId);
          renderSlicesList(searchInputEl.value);
          // Also remove from prompt if present
          promptSlices = promptSlices.filter((s) => s.id !== sliceId);
          renderPromptArea();
          showToast("Slice deleted.");
        })
        .fail((xhr) => alert(xhr.responseJSON?.error || "An error occurred"));
    }
  });

  promptAreaEl.addEventListener("click", function (e) {
    if (e.target.closest(".remove-from-prompt-btn")) {
      const sliceId = parseInt(e.target.closest(".remove-from-prompt-btn").dataset.id);
      promptSlices = promptSlices.filter((s) => s.id !== sliceId);
      renderPromptArea();
      showToast("Slice removed from prompt.");
    }
  });

  buildPromptBtn.addEventListener("click", function () {
    buildFinalPrompt();
    showToast("Prompt built successfully!");
  });

  searchInputEl.addEventListener("input", function () {
    const filter = searchInputEl.value.trim();
    renderSlicesList(filter);
  });

  // Toggle file input based on slice type
  sliceTypeEl.addEventListener("change", function () {
    const type = sliceTypeEl.value;
    if (type === "file") {
      fileInputGroupEl.classList.remove("d-none");
      sliceContentEl.parentElement.classList.add("d-none");
    } else {
      fileInputGroupEl.classList.add("d-none");
      sliceContentEl.parentElement.classList.remove("d-none");
    }
  });

  // Initialize Sortable.js for prompt area
  const sortable = Sortable.create(promptAreaEl, {
    animation: 150,
    ghostClass: "dragging",
    onEnd: function (evt) {
      const movedItem = promptSlices.splice(evt.oldIndex, 1)[0];
      promptSlices.splice(evt.newIndex, 0, movedItem);
      renderPromptArea();
    },
  });

  // Copy Final Prompt to Clipboard
  copyPromptBtn.addEventListener("click", function () {
    const promptText = finalPromptEl.textContent;
    if (!promptText) {
      showToast("No prompt to copy.", "warning");
      return;
    }
    navigator.clipboard
      .writeText(promptText)
      .then(() => {
        showToast("Prompt copied to clipboard!");
      })
      .catch(() => {
        showToast("Failed to copy prompt.", "danger");
      });
  });

  // Clear Final Prompt Area
  clearPromptBtn.addEventListener("click", function () {
    finalPromptEl.textContent = "";
    showToast("Final prompt cleared.");
  });

  // Initialize
  loadSlices();
  renderSlicesList();
  renderPromptArea();
});
