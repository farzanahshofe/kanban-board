/* =====================================================
   Sprint Garden — shared code used by both index.html
   (the board) and task.html (create/edit a task).
   Everything persists to localStorage in this browser.
   ===================================================== */

const STORAGE_KEY = "sprintGarden.board.v1";
const SESSION_KEY = "sprintGarden.unlocked";

const PASS_HASH = "f6f7e983afc59354c91673d637c22072ec68f710794f899ae7472dff7b7508e4";

const COLUMNS = [
  { id: "backlog", title: "Backlog", dot: "var(--text-faint)" },
  { id: "todo", title: "To Do", dot: "var(--lav-400)" },
  { id: "in-progress", title: "In Progress", dot: "var(--gold)" },
  { id: "review", title: "In Review", dot: "var(--rose-400)" },
  { id: "done", title: "Done", dot: "var(--sage)" },
];

const GENERAL_PROJECT = "General";

const DEMO_TASKS = [
  { id: uid(), title: "Set up repo & CI", desc: "Initialize project, add lint + basic pipeline.", priority: "medium", column: "done", due: "", project: GENERAL_PROJECT },
  { id: uid(), title: "Design card component", desc: "Sketch the card states: default, hover, dragging.", priority: "low", column: "review", due: "", project: GENERAL_PROJECT },
  { id: uid(), title: "Build drag & drop", desc: "Native HTML5 DnD between columns.", priority: "high", column: "in-progress", due: "", project: GENERAL_PROJECT },
  { id: uid(), title: "Write API for tasks", desc: "", priority: "medium", column: "todo", due: "", project: GENERAL_PROJECT },
  { id: uid(), title: "Plan sprint 2 scope", desc: "", priority: "low", column: "backlog", due: "", project: GENERAL_PROJECT },
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
  let state;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    state = raw ? JSON.parse(raw) : null;
  } catch (e) {
    console.warn("Could not read saved board, starting fresh.", e);
  }
  if (!state) {
    state = {
      sprintName: "Sprint 1",
      sprintStart: "",
      sprintEnd: "",
      projects: [GENERAL_PROJECT],
      activeProject: "All",
      tasks: DEMO_TASKS,
    };
  }
  // Backfill fields for boards saved before projects existed.
  if (!Array.isArray(state.projects)) state.projects = [GENERAL_PROJECT];
  if (!state.activeProject) state.activeProject = "All";
  state.tasks.forEach((t) => {
    if (!t.project) t.project = GENERAL_PROJECT;
    if (!state.projects.includes(t.project)) state.projects.push(t.project);
  });
  return state;
}

function saveState(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.error("Could not save board.", e);
  }
}

function isUnlocked() {
  return sessionStorage.getItem(SESSION_KEY) === "1";
}
