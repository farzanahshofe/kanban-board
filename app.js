/* =====================================================
   Sprint Garden — a small personal kanban board
   Everything persists to localStorage in this browser.
   ===================================================== */

const STORAGE_KEY = "sprintGarden.board.v1";
const SESSION_KEY = "sprintGarden.unlocked";

const PASS_HASH = "2c3d40381458969b41ea719126fa52ed1ee98a16857c120e92ecb0afa8731d10";

const COLUMNS = [
  { id: "backlog", title: "Backlog", dot: "var(--text-faint)" },
  { id: "todo", title: "To Do", dot: "var(--lav-400)" },
  { id: "in-progress", title: "In Progress", dot: "var(--gold)" },
  { id: "review", title: "In Review", dot: "var(--rose-400)" },
  { id: "done", title: "Done", dot: "var(--sage)" },
];

const DEMO_TASKS = [
  { id: uid(), title: "Set up repo & CI", desc: "Initialize project, add lint + basic pipeline.", priority: "medium", column: "done", due: "" },
  { id: uid(), title: "Design card component", desc: "Sketch the card states: default, hover, dragging.", priority: "low", column: "review", due: "" },
  { id: uid(), title: "Build drag & drop", desc: "Native HTML5 DnD between columns.", priority: "high", column: "in-progress", due: "" },
  { id: uid(), title: "Write API for tasks", desc: "", priority: "medium", column: "todo", due: "" },
  { id: uid(), title: "Plan sprint 2 scope", desc: "", priority: "low", column: "backlog", due: "" },
];

function uid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

async function sha256(text) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// ---- State ---------------------------------------------------------------
function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) { console.warn("Could not read saved board, starting fresh.", e); }
  return {
    sprintName: "Sprint 1",
    sprintStart: "",
    sprintEnd: "",
    tasks: DEMO_TASKS,
  };
}

let state = loadState();

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) { console.error("Could not save board.", e); }
}

// ---- Lock screen ----------------------------------------------------------
const lockScreen = document.getElementById("lock-screen");
const lockForm = document.getElementById("lock-form");
const lockInput = document.getElementById("lock-input");
const lockError = document.getElementById("lock-error");
const app = document.getElementById("app");

function unlock() {
  sessionStorage.setItem(SESSION_KEY, "1");
  lockScreen.hidden = true;
  app.hidden = false;
  initApp();
}

if (sessionStorage.getItem(SESSION_KEY) === "1") {
  unlock();
} else {
  lockInput.focus();
}

lockForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const hash = await sha256(lockInput.value.trim());
  if (hash === PASS_HASH) {
    lockError.hidden = true;
    unlock();
  } else {
    lockError.hidden = false;
    lockInput.value = "";
    lockInput.focus();
  }
});

document.getElementById("lock-btn")?.addEventListener("click", () => {
  sessionStorage.removeItem(SESSION_KEY);
  app.hidden = true;
  lockScreen.hidden = false;
  lockInput.value = "";
  lockInput.focus();
});

// ---- App init (only runs after unlock) ------------------------------------
let initialized = false;

function initApp() {
  if (initialized) return;
  initialized = true;

  const board = document.getElementById("board");
  const columnTpl = document.getElementById("column-template");
  const cardTpl = document.getElementById("card-template");

  const sprintNameInput = document.getElementById("sprint-name");
  const sprintStartInput = document.getElementById("sprint-start");
  const sprintEndInput = document.getElementById("sprint-end");

  sprintNameInput.value = state.sprintName;
  sprintStartInput.value = state.sprintStart;
  sprintEndInput.value = state.sprintEnd;

  sprintNameInput.addEventListener("input", () => { state.sprintName = sprintNameInput.value; saveState(); });
  sprintStartInput.addEventListener("change", () => { state.sprintStart = sprintStartInput.value; saveState(); });
  sprintEndInput.addEventListener("change", () => { state.sprintEnd = sprintEndInput.value; saveState(); });

  // ---- Modal ----
  const backdrop = document.getElementById("modal-backdrop");
  const form = document.getElementById("task-form");
  const fieldTitle = document.getElementById("field-title");
  const fieldDesc = document.getElementById("field-desc");
  const fieldPriority = document.getElementById("field-priority");
  const fieldColumn = document.getElementById("field-column");
  const fieldDue = document.getElementById("field-due");
  const modalTitle = document.getElementById("modal-title");

  COLUMNS.forEach((c) => {
    const opt = document.createElement("option");
    opt.value = c.id;
    opt.textContent = c.title;
    fieldColumn.appendChild(opt);
  });

  let editingId = null;

  function openModal(task, presetColumn) {
    editingId = task ? task.id : null;
    modalTitle.textContent = task ? "Edit task" : "New task";
    fieldTitle.value = task?.title || "";
    fieldDesc.value = task?.desc || "";
    fieldPriority.value = task?.priority || "medium";
    fieldColumn.value = task?.column || presetColumn || "backlog";
    fieldDue.value = task?.due || "";
    backdrop.hidden = false;
    setTimeout(() => fieldTitle.focus(), 0);
  }

  function closeModal() {
    backdrop.hidden = true;
    form.reset();
    editingId = null;
  }

  document.getElementById("new-task-btn").addEventListener("click", () => openModal(null, "backlog"));
  document.getElementById("modal-cancel").addEventListener("click", closeModal);
  backdrop.addEventListener("click", (e) => { if (e.target === backdrop) closeModal(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !backdrop.hidden) closeModal(); });

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const data = {
      title: fieldTitle.value.trim(),
      desc: fieldDesc.value.trim(),
      priority: fieldPriority.value,
      column: fieldColumn.value,
      due: fieldDue.value,
    };
    if (!data.title) return;

    if (editingId) {
      const t = state.tasks.find((t) => t.id === editingId);
      Object.assign(t, data);
    } else {
      state.tasks.push({ id: uid(), ...data });
    }
    saveState();
    closeModal();
    render();
  });

  // ---- Rendering ----
  function render() {
    board.innerHTML = "";

    let dragged = null;

    COLUMNS.forEach((col) => {
      const node = columnTpl.content.firstElementChild.cloneNode(true);
      node.dataset.column = col.id;
      node.querySelector(".column-dot").style.background = col.dot;
      node.querySelector(".column-title").textContent = col.title;

      const tasksInCol = state.tasks.filter((t) => t.column === col.id);
      node.querySelector(".column-count").textContent = tasksInCol.length;

      const list = node.querySelector(".card-list");

      tasksInCol.forEach((task) => {
        const card = cardTpl.content.firstElementChild.cloneNode(true);
        card.dataset.id = task.id;
        card.querySelector(".priority-dot").classList.add(`priority-${task.priority}`);
        card.querySelector(".card-title").textContent = task.title;
        const descEl = card.querySelector(".card-desc");
        if (task.desc) { descEl.textContent = task.desc; } else { descEl.remove(); }

        const dueEl = card.querySelector(".card-due");
        if (task.due) {
          const isOverdue = new Date(task.due) < new Date(new Date().toDateString()) && task.column !== "done";
          dueEl.textContent = formatDate(task.due);
          if (isOverdue) dueEl.classList.add("overdue");
        } else {
          dueEl.textContent = "";
        }

        card.querySelector(".card-edit").addEventListener("click", () => openModal(task));
        card.querySelector(".card-delete").addEventListener("click", () => {
          state.tasks = state.tasks.filter((t) => t.id !== task.id);
          saveState();
          render();
        });

        card.addEventListener("dragstart", () => {
          dragged = task.id;
          card.classList.add("dragging");
        });
        card.addEventListener("dragend", () => card.classList.remove("dragging"));

        list.appendChild(card);
      });

      // drop handling
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
        if (t) { t.column = col.id; saveState(); render(); }
        dragged = null;
      });

      node.querySelector(".add-inline").addEventListener("click", () => openModal(null, col.id));

      board.appendChild(node);
    });

    updateProgress();
  }

  function updateProgress() {
    const total = state.tasks.length;
    const done = state.tasks.filter((t) => t.column === "done").length;
    const pct = total ? Math.round((done / total) * 100) : 0;
    document.getElementById("progress-fill").style.width = pct + "%";
    document.getElementById("progress-label").textContent = `${done} of ${total} done`;
  }

  function formatDate(iso) {
    const d = new Date(iso + "T00:00:00");
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  }

  render();
}
