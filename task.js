/* Task create/edit page (task.html). Depends on shared.js being loaded first. */

// A direct visit to this page while locked should bounce back to the board.
if (!isUnlocked()) {
  location.href = "index.html";
}

const state = loadState();
const params = new URLSearchParams(location.search);
const editingId = params.get("id");
const existingTask = editingId ? state.tasks.find((t) => t.id === editingId) : null;

const form = document.getElementById("task-form");
const fieldTitle = document.getElementById("field-title");
const fieldDesc = document.getElementById("field-desc");
const fieldProject = document.getElementById("field-project");
const fieldPriority = document.getElementById("field-priority");
const fieldColumn = document.getElementById("field-column");
const fieldDue = document.getElementById("field-due");
const pageTitle = document.getElementById("page-title");

const NEW_PROJECT_VALUE = "__new__";

function populateProjects(selected) {
  fieldProject.innerHTML = "";
  state.projects.forEach((proj) => {
    const opt = document.createElement("option");
    opt.value = proj;
    opt.textContent = proj;
    fieldProject.appendChild(opt);
  });
  const newOpt = document.createElement("option");
  newOpt.value = NEW_PROJECT_VALUE;
  newOpt.textContent = "+ New project...";
  fieldProject.appendChild(newOpt);
  fieldProject.value = selected && state.projects.includes(selected) ? selected : state.projects[0];
}

populateProjects(existingTask?.project || params.get("project") || GENERAL_PROJECT);

fieldProject.addEventListener("change", () => {
  if (fieldProject.value !== NEW_PROJECT_VALUE) return;
  const name = prompt("Name your new project:");
  const trimmed = (name || "").trim();
  if (!trimmed) {
    fieldProject.value = state.projects[0];
    return;
  }
  if (!state.projects.includes(trimmed)) state.projects.push(trimmed);
  populateProjects(trimmed);
});

if (existingTask) {
  pageTitle.textContent = "Edit task";
  document.title = "Edit task — Sprint Garden";
  fieldTitle.value = existingTask.title;
  fieldDesc.value = existingTask.desc || "";
  fieldPriority.value = existingTask.priority;
  fieldColumn.value = existingTask.column;
  fieldDue.value = existingTask.due || "";
} else {
  const presetColumn = params.get("column");
  if (presetColumn) fieldColumn.value = presetColumn;
}

fieldTitle.focus();

form.addEventListener("submit", (e) => {
  e.preventDefault();

  const data = {
    title: fieldTitle.value.trim(),
    desc: fieldDesc.value.trim(),
    project: fieldProject.value === NEW_PROJECT_VALUE ? GENERAL_PROJECT : fieldProject.value,
    priority: fieldPriority.value,
    column: fieldColumn.value,
    due: fieldDue.value,
  };
  if (!data.title) return;

  if (existingTask) {
    Object.assign(existingTask, data);
  } else {
    state.tasks.push({ id: uid(), ...data });
  }

  saveState(state);
  location.href = "index.html";
});
