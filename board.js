/* Board page (index.html). Depends on shared.js being loaded first. */

// ---- Lock screen ----------------------------------------------------------
const lockScreen = document.getElementById("lock-screen");
const lockForm = document.getElementById("lock-form");
const lockInput = document.getElementById("lock-input");
const lockError = document.getElementById("lock-error");
const appEl = document.getElementById("app");

function unlockBoard() {
  sessionStorage.setItem(SESSION_KEY, "1");
  lockScreen.hidden = true;
  appEl.hidden = false;
  initBoard();
}

if (isUnlocked()) {
  unlockBoard();
} else {
  lockInput.focus();
}

lockForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const hash = await sha256(lockInput.value.trim());
  if (hash === PASS_HASH) {
    lockError.hidden = true;
    unlockBoard();
  } else {
    lockError.hidden = false;
    lockInput.value = "";
    lockInput.focus();
  }
});

document.getElementById("lock-btn")?.addEventListener("click", () => {
  sessionStorage.removeItem(SESSION_KEY);
  appEl.hidden = true;
  lockScreen.hidden = false;
  lockInput.value = "";
  lockInput.focus();
});

// ---- Board ------------------------------------------------------------
function initBoard() {
  const state = loadState();
  saveState(state); // persist any backfilled fields (project, etc.)

  const board = document.getElementById("board");
  const columnTpl = document.getElementById("column-template");
  const cardTpl = document.getElementById("card-template");
  const projectStrip = document.getElementById("project-strip");

  const sprintNameInput = document.getElementById("sprint-name");
  const sprintStartInput = document.getElementById("sprint-start");
  const sprintEndInput = document.getElementById("sprint-end");
  const newTaskBtn = document.getElementById("new-task-btn");

  sprintNameInput.value = state.sprintName;
  sprintStartInput.value = state.sprintStart;
  sprintEndInput.value = state.sprintEnd;

  sprintNameInput.addEventListener("input", () => { state.sprintName = sprintNameInput.value; saveState(state); });
  sprintStartInput.addEventListener("change", () => { state.sprintStart = sprintStartInput.value; saveState(state); });
  sprintEndInput.addEventListener("change", () => { state.sprintEnd = sprintEndInput.value; saveState(state); });

  function taskUrl(params) {
    const qs = new URLSearchParams(params);
    return "task.html?" + qs.toString();
  }

  function renderProjectStrip() {
    projectStrip.innerHTML = "";

    const options = ["All", ...state.projects];
    options.forEach((proj) => {
      const pill = document.createElement("button");
      pill.className = "project-pill" + (state.activeProject === proj ? " active" : "");
      pill.textContent = proj;
      pill.addEventListener("click", () => {
        state.activeProject = proj;
        saveState(state);
        renderProjectStrip();
        renderBoard();
      });
      projectStrip.appendChild(pill);
    });

    const addBtn = document.createElement("button");
    addBtn.className = "project-pill project-pill-add";
    addBtn.textContent = "+ Project";
    addBtn.addEventListener("click", () => {
      const name = prompt("Name your new project:");
      const trimmed = (name || "").trim();
      if (!trimmed) return;
      if (!state.projects.includes(trimmed)) state.projects.push(trimmed);
      state.activeProject = trimmed;
      saveState(state);
      renderProjectStrip();
      renderBoard();
    });
    projectStrip.appendChild(addBtn);
  }

  function visibleTasks() {
    if (state.activeProject === "All") return state.tasks;
    return state.tasks.filter((t) => t.project === state.activeProject);
  }

  function renderBoard() {
    board.innerHTML = "";
    const tasks = visibleTasks();
    const showProjectTag = state.activeProject === "All";

    // Keep "+ New task" pointed at whatever project is currently in view.
    newTaskBtn.href = taskUrl(state.activeProject === "All" ? {} : { project: state.activeProject });

    let dragged = null;

    COLUMNS.forEach((col) => {
      const node = columnTpl.content.firstElementChild.cloneNode(true);
      node.dataset.column = col.id;
      node.querySelector(".column-dot").style.background = col.dot;
      node.querySelector(".column-title").textContent = col.title;

      const tasksInCol = tasks.filter((t) => t.column === col.id);
      node.querySelector(".column-count").textContent = tasksInCol.length;

      const list = node.querySelector(".card-list");
      const addLink = node.querySelector(".add-inline");
      addLink.href = taskUrl({
        column: col.id,
        ...(state.activeProject !== "All" ? { project: state.activeProject } : {}),
      });

      tasksInCol.forEach((task) => {
        const card = cardTpl.content.firstElementChild.cloneNode(true);
        card.dataset.id = task.id;
        card.querySelector(".priority-dot").classList.add(`priority-${task.priority}`);
        card.querySelector(".card-title").textContent = task.title;

        const descEl = card.querySelector(".card-desc");
        if (task.desc) { descEl.textContent = task.desc; } else { descEl.remove(); }

        const projectEl = card.querySelector(".card-project");
        if (showProjectTag) { projectEl.textContent = task.project; } else { projectEl.remove(); }

        const dueEl = card.querySelector(".card-due");
        if (task.due) {
          const isOverdue = new Date(task.due) < new Date(new Date().toDateString()) && task.column !== "done";
          dueEl.textContent = formatDate(task.due);
          if (isOverdue) dueEl.classList.add("overdue");
        } else {
          dueEl.textContent = "";
        }

        card.querySelector(".card-edit").href = taskUrl({ id: task.id });
        card.querySelector(".card-delete").addEventListener("click", () => {
          if (!confirm(`Delete "${task.title}"?`)) return;
          state.tasks = state.tasks.filter((t) => t.id !== task.id);
          saveState(state);
          renderBoard();
        });

        card.addEventListener("dragstart", () => {
          dragged = task.id;
          card.classList.add("dragging");
        });
        card.addEventListener("dragend", () => card.classList.remove("dragging"));

        list.appendChild(card);
      });

      node.addEventListener("dragover", (e) => {
        e.preventDefault();
        node.classList.add("drag-over");
      });
      node.addEventListener("dragleave", () => node.classList.remove("drag-over"));
      node.addEventListener("drop", (e) => {
        e.preventDefault();
        node.classList.remove("drag-over");
        if (!dragged) return;
        const t = state.tasks.find((t) => t.id === dragged);
        if (t) { t.column = col.id; saveState(state); renderBoard(); }
        dragged = null;
      });

      board.appendChild(node);
    });

    updateProgress(tasks);
  }

  function updateProgress(tasks) {
    const total = tasks.length;
    const done = tasks.filter((t) => t.column === "done").length;
    const pct = total ? Math.round((done / total) * 100) : 0;
    document.getElementById("progress-fill").style.width = pct + "%";
    document.getElementById("progress-label").textContent = `${done} of ${total} done`;
  }

  function formatDate(iso) {
    const d = new Date(iso + "T00:00:00");
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  }

  renderProjectStrip();
  renderBoard();
}
