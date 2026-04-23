const DB_NAME = "kanban-board-db";
const DB_VERSION = 1;
const STORE_NAME = "appState";
const STORAGE_KEY = "singleton";
const LONG_PRESS_MS = 350;
const DEFAULT_CATEGORY_COLOR = "#e8d99f";
const DEFAULT_BOARD_NAME = "Kanban";
const DEFAULT_UI_FONT = "Trebuchet MS, Gill Sans, sans-serif";
const DEFAULT_ITEM_FONT = "Trebuchet MS, Gill Sans, sans-serif";
const CATEGORY_COLOR_PRESETS = [
  "#e8d99f",
  "#d9d1a2",
  "#d7c2a3",
  "#c8d7ae",
  "#b9d2c8",
  "#b8cfe0",
  "#c8c0df",
  "#d7bcc7",
];
const LEATHER_TEXTURE_SIZE = 360;
const LEATHER_CELL_COLUMNS = 48;
const LEATHER_CELL_ROWS = 48;
const LEATHER_TEXTURE_SEED = 71237;

const state = {
  boardName: DEFAULT_BOARD_NAME,
  uiFont: DEFAULT_UI_FONT,
  itemFont: DEFAULT_ITEM_FONT,
  hasSeenHelp: false,
  categories: [],
  tasks: [],
  activeCategoryId: null,
};

const ui = {
  boardTitle: document.querySelector("#boardTitle"),
  boardColumns: document.querySelector("#boardColumns"),
  categoryTabs: document.querySelector("#categoryTabs"),
  addCategoryFab: document.querySelector("#addCategoryFab"),
  modalBackdrop: document.querySelector("#modalBackdrop"),
  taskModal: document.querySelector("#taskModal"),
  categoryModal: document.querySelector("#categoryModal"),
  boardModal: document.querySelector("#boardModal"),
  resetConfirmModal: document.querySelector("#resetConfirmModal"),
  helpModal: document.querySelector("#helpModal"),
  taskForm: document.querySelector("#taskForm"),
  categoryForm: document.querySelector("#categoryForm"),
  boardForm: document.querySelector("#boardForm"),
  resetConfirmForm: document.querySelector("#resetConfirmForm"),
  deleteTaskButton: document.querySelector("#deleteTaskButton"),
  deleteCategoryButton: document.querySelector("#deleteCategoryButton"),
  openHelp: document.querySelector("#openHelp"),
  openBoardSettings: document.querySelector("#openBoardSettings"),
  exportBoardButton: document.querySelector("#exportBoardButton"),
  importBoardButton: document.querySelector("#importBoardButton"),
  importBoardInput: document.querySelector("#importBoardInput"),
  resetTasksAndCategoriesButton: document.querySelector("#resetTasksAndCategoriesButton"),
  resetColorsButton: document.querySelector("#resetColorsButton"),
  taskModalTitle: document.querySelector("#taskModalTitle"),
  categoryModalTitle: document.querySelector("#categoryModalTitle"),
  taskTitleInput: document.querySelector("#taskTitleInput"),
  taskDetailsInput: document.querySelector("#taskDetailsInput"),
  taskCategorySelect: document.querySelector("#taskCategorySelect"),
  taskStartInput: document.querySelector("#taskStartInput"),
  taskDeadlineInput: document.querySelector("#taskDeadlineInput"),
  categoryCaptionInput: document.querySelector("#categoryCaptionInput"),
  categoryColorOptions: document.querySelector("#categoryColorOptions"),
  categoryAllowProgressInput: document.querySelector("#categoryAllowProgressInput"),
  boardNameInput: document.querySelector("#boardNameInput"),
  uiFontSelect: document.querySelector("#uiFontSelect"),
  itemFontSelect: document.querySelector("#itemFontSelect"),
  columnTemplate: document.querySelector("#columnTemplate"),
  taskTemplate: document.querySelector("#taskTemplate"),
};

const modalState = {
  current: null,
  taskId: null,
  categoryId: null,
  categoryColor: DEFAULT_CATEGORY_COLOR,
};

const dragState = {
  longPressTimer: null,
  pointerId: null,
  taskId: null,
  originCategoryId: null,
  placeholderCategoryId: null,
  placeholderIndex: null,
  ghost: null,
  offsetX: 0,
  offsetY: 0,
  startX: 0,
  startY: 0,
  armedElement: null,
  dragging: false,
  suppressClickUntil: 0,
};

const categoryDragState = {
  longPressTimer: null,
  pointerId: null,
  categoryId: null,
  placeholderIndex: null,
  startX: 0,
  startY: 0,
  offsetX: 0,
  offsetY: 0,
  armedElement: null,
  ghost: null,
  dragging: false,
  suppressClickUntil: 0,
};

let dbPromise;

function createId() {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }
  const randomChunk = Math.random().toString(36).slice(2, 10);
  return `id-${Date.now().toString(36)}-${randomChunk}`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function renderInlineMarkdown(value) {
  if (!value) {
    return "";
  }

  const tokens = [];
  const stash = (html) => {
    const token = `@@MD${tokens.length}@@`;
    tokens.push(html);
    return token;
  };

  let html = escapeHtml(value);
  html = html.replace(/`([^`\n]+)`/g, (_, code) => stash(`<code>${code}</code>`));
  html = html.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, label, url) => stash(
    `<span class="md-link">${label}</span><span class="md-link-url"> (${url})</span>`
  ));
  html = html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/__([^_]+)__/g, "<strong>$1</strong>");
  html = html.replace(/~~([^~]+)~~/g, "<s>$1</s>");
  html = html.replace(/\*([^*\n]+)\*/g, "<em>$1</em>");
  html = html.replace(/_([^_\n]+)_/g, "<em>$1</em>");

  return html.replace(/@@MD(\d+)@@/g, (_, index) => tokens[Number(index)] || "");
}

function renderMarkdown(value) {
  if (!value?.trim()) {
    return "";
  }

  const blocks = value.trim().split(/\n{2,}/);
  return blocks.map((block) => {
    const lines = block.split("\n").map((line) => line.trimEnd());

    if (lines.every((line) => /^[-*+]\s+/.test(line))) {
      return `<ul>${lines.map((line) => `<li>${renderInlineMarkdown(line.replace(/^[-*+]\s+/, ""))}</li>`).join("")}</ul>`;
    }

    if (lines.every((line) => /^\d+\.\s+/.test(line))) {
      return `<ol>${lines.map((line) => `<li>${renderInlineMarkdown(line.replace(/^\d+\.\s+/, ""))}</li>`).join("")}</ol>`;
    }

    if (lines.every((line) => /^>\s?/.test(line))) {
      const quote = lines.map((line) => line.replace(/^>\s?/, "")).join("\n");
      return `<blockquote>${renderMarkdown(quote)}</blockquote>`;
    }

    return `<p>${lines.map((line) => renderInlineMarkdown(line)).join("<br>")}</p>`;
  }).join("");
}

function createSeededRandom(seed) {
  let value = seed >>> 0;
  return () => {
    value = (value + 0x6D2B79F5) >>> 0;
    let next = Math.imul(value ^ (value >>> 15), 1 | value);
    next ^= next + Math.imul(next ^ (next >>> 7), 61 | next);
    return ((next ^ (next >>> 14)) >>> 0) / 4294967296;
  };
}

function lerp(start, end, amount) {
  return start + (end - start) * amount;
}

function smoothstep(edge0, edge1, value) {
  if (edge0 === edge1) {
    return value < edge0 ? 0 : 1;
  }
  const amount = Math.max(0, Math.min(1, (value - edge0) / (edge1 - edge0)));
  return amount * amount * (3 - 2 * amount);
}

function buildWrappedValueGrid(size, random) {
  const grid = new Float32Array(size * size);
  for (let index = 0; index < grid.length; index += 1) {
    grid[index] = random();
  }
  return grid;
}

function sampleWrappedValueGrid(grid, size, x, y) {
  const wrappedX = ((x % 1) + 1) % 1 * size;
  const wrappedY = ((y % 1) + 1) % 1 * size;
  const x0 = Math.floor(wrappedX) % size;
  const y0 = Math.floor(wrappedY) % size;
  const x1 = (x0 + 1) % size;
  const y1 = (y0 + 1) % size;
  const tx = wrappedX - Math.floor(wrappedX);
  const ty = wrappedY - Math.floor(wrappedY);
  const sx = tx * tx * (3 - 2 * tx);
  const sy = ty * ty * (3 - 2 * ty);

  const top = lerp(grid[y0 * size + x0], grid[y0 * size + x1], sx);
  const bottom = lerp(grid[y1 * size + x0], grid[y1 * size + x1], sx);
  return lerp(top, bottom, sy);
}

function createLeatherCellMap(columns, rows, random) {
  const cells = new Array(columns * rows);
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const jitterX = 0.2 + random() * 0.6;
      const jitterY = 0.2 + random() * 0.6;
      cells[row * columns + column] = {
        x: (column + jitterX) / columns,
        y: (row + jitterY) / rows,
      };
    }
  }
  return cells;
}

function sampleLeatherCell(cells, columns, rows, x, y) {
  const baseColumn = Math.floor(x * columns) % columns;
  const baseRow = Math.floor(y * rows) % rows;
  let nearest = Infinity;
  let secondNearest = Infinity;

  for (let rowOffset = -1; rowOffset <= 1; rowOffset += 1) {
    for (let columnOffset = -1; columnOffset <= 1; columnOffset += 1) {
      const column = (baseColumn + columnOffset + columns) % columns;
      const row = (baseRow + rowOffset + rows) % rows;
      const point = cells[row * columns + column];
      let deltaX = x - point.x;
      let deltaY = y - point.y;

      if (deltaX > 0.5) {
        deltaX -= 1;
      } else if (deltaX < -0.5) {
        deltaX += 1;
      }

      if (deltaY > 0.5) {
        deltaY -= 1;
      } else if (deltaY < -0.5) {
        deltaY += 1;
      }

      const distance = Math.hypot(deltaX, deltaY);
      if (distance < nearest) {
        secondNearest = nearest;
        nearest = distance;
      } else if (distance < secondNearest) {
        secondNearest = distance;
      }
    }
  }

  return { nearest, edge: secondNearest - nearest };
}

function generateLeatherTextureDataUrl() {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  if (!context) {
    return null;
  }

  const size = LEATHER_TEXTURE_SIZE;
  canvas.width = size;
  canvas.height = size;

  const random = createSeededRandom(LEATHER_TEXTURE_SEED);
  const cells = createLeatherCellMap(LEATHER_CELL_COLUMNS, LEATHER_CELL_ROWS, random);
  const macroGrid = buildWrappedValueGrid(7, random);
  const midGrid = buildWrappedValueGrid(19, random);
  const fineGrid = buildWrappedValueGrid(64, random);
  const heights = new Float32Array(size * size);
  const tones = new Float32Array(size * size);
  const seams = new Float32Array(size * size);
  const grains = new Float32Array(size * size);
  const cellScale = Math.min(LEATHER_CELL_COLUMNS, LEATHER_CELL_ROWS);

  // Cellular heightmap gives the pebbled leather structure; wrapped noise adds pores and mottling.
  for (let y = 0; y < size; y += 1) {
    const normalizedY = y / size;
    for (let x = 0; x < size; x += 1) {
      const normalizedX = x / size;
      const index = y * size + x;
      const { nearest, edge } = sampleLeatherCell(cells, LEATHER_CELL_COLUMNS, LEATHER_CELL_ROWS, normalizedX, normalizedY);
      const macro = sampleWrappedValueGrid(macroGrid, 7, normalizedX, normalizedY) - 0.5;
      const mid = sampleWrappedValueGrid(midGrid, 19, normalizedX, normalizedY) - 0.5;
      const fine = sampleWrappedValueGrid(fineGrid, 64, normalizedX, normalizedY) - 0.5;
      const pebble = 1 - smoothstep(0.22, 0.76, nearest * cellScale);
      const seam = 1 - smoothstep(0.07, 0.18, edge * cellScale);
      const height = 0.5 + pebble * 0.23 - seam * 0.11 + macro * 0.2 + mid * 0.11 + fine * 0.05;

      heights[index] = height;
      tones[index] = macro * 0.65 + mid * 0.35;
      seams[index] = seam;
      grains[index] = fine;
    }
  }

  const image = context.createImageData(size, size);
  const data = image.data;
  const lightX = -0.34;
  const lightY = -0.2;
  const lightZ = 0.92;

  for (let y = 0; y < size; y += 1) {
    const previousRow = (y - 1 + size) % size;
    const nextRow = (y + 1) % size;

    for (let x = 0; x < size; x += 1) {
      const previousColumn = (x - 1 + size) % size;
      const nextColumn = (x + 1) % size;
      const index = y * size + x;
      const dataIndex = index * 4;

      const left = heights[y * size + previousColumn];
      const right = heights[y * size + nextColumn];
      const up = heights[previousRow * size + x];
      const down = heights[nextRow * size + x];
      const normalX = (left - right) * 1.45;
      const normalY = (up - down) * 1.45;
      const normalZ = 1;
      const normalLength = Math.hypot(normalX, normalY, normalZ) || 1;
      const diffuse = Math.max(0, (normalX * lightX + normalY * lightY + normalZ * lightZ) / normalLength);
      const highlight = Math.pow(Math.max(0, diffuse - 0.7) / 0.3, 2);

      const tone = tones[index];
      const seam = seams[index];
      const grain = grains[index];
      const warmth = 0.5 + tone * 0.95;
      const shade = 0.78 + diffuse * 0.4 - seam * 0.08;

      const red = (81 + warmth * 30 + grain * 12) * shade + highlight * 22;
      const green = (44 + warmth * 16 + grain * 6) * shade + highlight * 11;
      const blue = (24 + warmth * 8 + grain * 3) * shade + highlight * 5;

      data[dataIndex] = Math.max(0, Math.min(255, Math.round(red)));
      data[dataIndex + 1] = Math.max(0, Math.min(255, Math.round(green)));
      data[dataIndex + 2] = Math.max(0, Math.min(255, Math.round(blue)));
      data[dataIndex + 3] = 255;
    }
  }

  context.putImageData(image, 0, 0);
  return canvas.toDataURL("image/png");
}

function applyGeneratedLeatherTexture() {
  try {
    const dataUrl = generateLeatherTextureDataUrl();
    if (dataUrl) {
      document.documentElement.style.setProperty("--leather-generated", `url("${dataUrl}")`);
    }
  } catch (error) {
    console.error("Failed to generate leather texture", error);
  }
}

function createDefaultState() {
  const categories = [
    { id: createId(), caption: "To Do", color: DEFAULT_CATEGORY_COLOR, allowProgress: false },
    { id: createId(), caption: "In Progress", color: DEFAULT_CATEGORY_COLOR, allowProgress: true },
    { id: createId(), caption: "Done", color: DEFAULT_CATEGORY_COLOR, allowProgress: false },
  ];
  return {
    boardName: DEFAULT_BOARD_NAME,
    uiFont: DEFAULT_UI_FONT,
    itemFont: DEFAULT_ITEM_FONT,
    hasSeenHelp: false,
    categories,
    tasks: [],
    activeCategoryId: categories[0].id,
  };
}

function cloneState(data) {
  return JSON.parse(JSON.stringify(data));
}

function getPersistedStateSnapshot() {
  return cloneState({
    boardName: state.boardName,
    uiFont: state.uiFont,
    itemFont: state.itemFont,
    hasSeenHelp: state.hasSeenHelp,
    categories: state.categories,
    tasks: state.tasks,
    activeCategoryId: state.activeCategoryId,
  });
}

function isHexColor(value) {
  return typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value);
}

function isFiniteDate(value) {
  return Boolean(value) && Number.isFinite(new Date(value).getTime());
}

function normalizeState(rawState) {
  const fallback = createDefaultState();
  const categories = Array.isArray(rawState?.categories) && rawState.categories.length
    ? rawState.categories.map((category) => ({
        id: category.id || createId(),
        caption: typeof category.caption === "string" && category.caption.trim() ? category.caption.trim() : "Untitled",
        color: isHexColor(category.color) ? category.color : DEFAULT_CATEGORY_COLOR,
        allowProgress: Boolean(category.allowProgress),
      }))
    : fallback.categories;
  const categoryIds = new Set(categories.map((category) => category.id));
  const tasks = Array.isArray(rawState?.tasks)
    ? rawState.tasks
        .filter((task) => categoryIds.has(task.categoryId))
        .map((task) => ({
          id: task.id || createId(),
          title: typeof task.title === "string" && task.title.trim() ? task.title.trim() : "Untitled task",
          details: typeof task.details === "string" ? task.details : "",
          categoryId: task.categoryId,
          startAt: isFiniteDate(task.startAt) ? new Date(task.startAt).toISOString() : null,
          deadline: isFiniteDate(task.deadline) ? new Date(task.deadline).toISOString() : null,
          createdAt: isFiniteDate(task.createdAt) ? new Date(task.createdAt).toISOString() : new Date().toISOString(),
        }))
    : [];
  const activeCategoryId = categoryIds.has(rawState?.activeCategoryId) ? rawState.activeCategoryId : categories[0].id;

  return {
    boardName: typeof rawState?.boardName === "string" && rawState.boardName.trim() ? rawState.boardName.trim() : DEFAULT_BOARD_NAME,
    uiFont: typeof rawState?.uiFont === "string" && rawState.uiFont.trim() ? rawState.uiFont.trim() : DEFAULT_UI_FONT,
    itemFont: typeof rawState?.itemFont === "string" && rawState.itemFont.trim() ? rawState.itemFont.trim() : DEFAULT_ITEM_FONT,
    hasSeenHelp: Boolean(rawState?.hasSeenHelp),
    categories,
    tasks,
    activeCategoryId,
  };
}

function syncState(nextState) {
  const normalized = normalizeState(nextState);
  state.boardName = normalized.boardName;
  state.uiFont = normalized.uiFont;
  state.itemFont = normalized.itemFont;
  state.hasSeenHelp = normalized.hasSeenHelp;
  state.categories = normalized.categories;
  state.tasks = normalized.tasks;
  state.activeCategoryId = normalized.activeCategoryId;
}

function openDatabase() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      };
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });
  }
  return dbPromise;
}

async function readState() {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readonly");
    const request = transaction.objectStore(STORE_NAME).get(STORAGE_KEY);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result ? normalizeState(request.result) : null);
  });
}

async function writeState() {
  const db = await openDatabase();
  const snapshot = getPersistedStateSnapshot();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readwrite");
    const request = transaction.objectStore(STORE_NAME).put(snapshot, STORAGE_KEY);
    request.onerror = () => reject(request.error);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

async function persistAndRender() {
  await writeState();
  render();
}

function ensureActiveCategory() {
  if (!state.categories.length) {
    syncState(createDefaultState());
    return;
  }
  if (!state.categories.some((category) => category.id === state.activeCategoryId)) {
    state.activeCategoryId = state.categories[0].id;
  }
}

function getTasksForCategory(categoryId) {
  return state.tasks.filter((task) => task.categoryId === categoryId);
}

function getTaskCountForCategory(categoryId) {
  return state.tasks.reduce((count, task) => count + (task.categoryId === categoryId ? 1 : 0), 0);
}

function getCategoryById(categoryId) {
  return state.categories.find((category) => category.id === categoryId) || null;
}

function categoryAllowsProgress(categoryId) {
  return Boolean(getCategoryById(categoryId)?.allowProgress);
}

function getDefaultStartAtForNewTask(categoryId) {
  return categoryAllowsProgress(categoryId) ? new Date().toISOString() : null;
}

function resolveTaskStartAt({ existingTask = null, requestedStartAt = null, targetCategoryId }) {
  if (requestedStartAt) {
    return requestedStartAt;
  }

  if (existingTask?.startAt) {
    return existingTask.startAt;
  }

  const movedIntoProgressCategory = existingTask
    ? existingTask.categoryId !== targetCategoryId && categoryAllowsProgress(targetCategoryId)
    : categoryAllowsProgress(targetCategoryId);

  return movedIntoProgressCategory ? new Date().toISOString() : null;
}

function getDeadlineProgress(task) {
  if (!task.deadline) {
    return null;
  }
  const deadline = new Date(task.deadline).getTime();
  const createdAt = new Date(task.startAt || task.createdAt).getTime();
  const now = Date.now();
  if (!Number.isFinite(deadline) || deadline <= createdAt) {
    return 100;
  }
  if (now <= createdAt) {
    return 0;
  }
  return Math.max(0, Math.min(100, ((now - createdAt) / (deadline - createdAt)) * 100));
}

function formatTaskMeta(task, allowProgress, progressPercent) {
  if (!task.deadline) {
    return "No due date";
  }
  const deadline = new Date(task.deadline);
  const base = `Due ${deadline.toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}`;
  if (!allowProgress || progressPercent === null) {
    return base;
  }
  return `${base} • ${Math.round(progressPercent)}% elapsed`;
}

function hexToRgba(hex, alpha) {
  const value = hex.replace("#", "");
  const red = Number.parseInt(value.slice(0, 2), 16);
  const green = Number.parseInt(value.slice(2, 4), 16);
  const blue = Number.parseInt(value.slice(4, 6), 16);
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

function createDropMarker() {
  const marker = document.createElement("div");
  marker.className = "task-list-drop-marker";
  return marker;
}

function populateTaskCategorySelect() {
  const previousValue = ui.taskCategorySelect.value;
  ui.taskCategorySelect.replaceChildren();
  state.categories.forEach((category) => {
    const option = document.createElement("option");
    option.value = category.id;
    option.textContent = category.caption;
    ui.taskCategorySelect.append(option);
  });
  if (state.categories.some((category) => category.id === previousValue)) {
    ui.taskCategorySelect.value = previousValue;
  }
}

function getRenderedCategories() {
  if (!categoryDragState.dragging || !categoryDragState.categoryId || categoryDragState.placeholderIndex === null) {
    return state.categories;
  }

  const moving = state.categories.find((category) => category.id === categoryDragState.categoryId);
  if (!moving) {
    return state.categories;
  }

  const remaining = state.categories.filter((category) => category.id !== categoryDragState.categoryId);
  const nextIndex = Math.max(0, Math.min(categoryDragState.placeholderIndex, remaining.length));
  return [
    ...remaining.slice(0, nextIndex),
    moving,
    ...remaining.slice(nextIndex),
  ];
}

function renderCategoryColorOptions(selectedColor = DEFAULT_CATEGORY_COLOR) {
  ui.categoryColorOptions.replaceChildren();
  modalState.categoryColor = selectedColor;
  const colors = CATEGORY_COLOR_PRESETS.includes(selectedColor)
    ? CATEGORY_COLOR_PRESETS
    : [selectedColor, ...CATEGORY_COLOR_PRESETS];

  colors.forEach((color) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `color-option${color === selectedColor ? " selected" : ""}`;
    button.style.background = color;
    button.setAttribute("aria-label", `Select color ${color}`);
    button.setAttribute("aria-pressed", String(color === selectedColor));
    button.addEventListener("click", () => {
      modalState.categoryColor = color;
      renderCategoryColorOptions(color);
    });
    ui.categoryColorOptions.append(button);
  });
}

function renderTabs() {
  ui.categoryTabs.replaceChildren();
  getRenderedCategories().forEach((category) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `tab-button${category.id === state.activeCategoryId ? " active" : ""}`;
    button.dataset.categoryId = category.id;
    button.textContent = category.caption;
    button.addEventListener("click", (event) => {
      if (categoryDragState.dragging || Date.now() < categoryDragState.suppressClickUntil) {
        event.preventDefault();
        return;
      }
      state.activeCategoryId = category.id;
      render();
    });
    button.addEventListener("pointerdown", startCategoryLongPress);
    button.addEventListener("pointermove", handleCategoryPreDragMove);
    button.addEventListener("pointerup", finishCategoryPointerInteraction);
    button.addEventListener("pointercancel", cancelCategoryPointerInteraction);
    if (categoryDragState.dragging && categoryDragState.categoryId === category.id) {
      button.classList.add("dragging");
    }
    ui.categoryTabs.append(button);
  });
}

function renderTask(task, category) {
  const taskNode = ui.taskTemplate.content.firstElementChild.cloneNode(true);
  const title = taskNode.querySelector(".task-card-title");
  const details = taskNode.querySelector(".task-card-details");
  const meta = taskNode.querySelector(".task-card-meta");
  const progress = taskNode.querySelector(".task-card-progress");
  const progressPercent = category.allowProgress ? getDeadlineProgress(task) : null;

  taskNode.dataset.taskId = task.id;
  taskNode.dataset.categoryId = category.id;
  title.innerHTML = renderInlineMarkdown(task.title);
  if (task.details.trim()) {
    details.innerHTML = renderMarkdown(task.details);
    details.classList.remove("is-empty");
  } else {
    details.textContent = "Tap to add details.";
    details.classList.add("is-empty");
  }
  progress.style.setProperty("--progress-percent", `${progressPercent ?? 0}%`);
  meta.textContent = formatTaskMeta(task, category.allowProgress, progressPercent);

  taskNode.addEventListener("click", (event) => {
    if (dragState.dragging || Date.now() < dragState.suppressClickUntil) {
      event.preventDefault();
      return;
    }
    openTaskModal(task.id);
  });
  taskNode.addEventListener("pointerdown", startLongPress);
  taskNode.addEventListener("pointermove", handlePreDragMove);
  taskNode.addEventListener("pointerup", finishPointerInteraction);
  taskNode.addEventListener("pointercancel", cancelPointerInteraction);

  if (dragState.dragging && dragState.taskId === task.id) {
    taskNode.classList.add("dragging");
  }
  return taskNode;
}

function renderColumns() {
  ui.boardColumns.replaceChildren();
  const isMobile = window.matchMedia("(max-width: 860px)").matches;

  getRenderedCategories().forEach((category) => {
    const node = ui.columnTemplate.content.firstElementChild.cloneNode(true);
    const heading = node.querySelector(".category-heading");
    const count = node.querySelector(".task-count");
    const addTaskButton = node.querySelector(".add-task-button");
    const taskList = node.querySelector(".task-list");
    const tasks = getTasksForCategory(category.id);

    node.dataset.categoryId = category.id;
    node.style.background = `linear-gradient(180deg, ${hexToRgba(category.color, 0.95)}, ${hexToRgba(category.color, 0.82)})`;

    if (isMobile && category.id !== state.activeCategoryId) {
      node.classList.add("hidden-mobile");
    }

    heading.textContent = category.caption;
    heading.dataset.categoryId = category.id;
    heading.addEventListener("click", (event) => {
      if (categoryDragState.dragging || Date.now() < categoryDragState.suppressClickUntil) {
        event.preventDefault();
        return;
      }
      openCategoryModal(category.id);
    });
    heading.addEventListener("pointerdown", startCategoryLongPress);
    heading.addEventListener("pointermove", handleCategoryPreDragMove);
    heading.addEventListener("pointerup", finishCategoryPointerInteraction);
    heading.addEventListener("pointercancel", cancelCategoryPointerInteraction);
    count.textContent = `${tasks.length} task${tasks.length === 1 ? "" : "s"}`;
    addTaskButton.addEventListener("click", () => openTaskModal(null, category.id));

    taskList.dataset.categoryId = category.id;
    taskList.addEventListener("pointermove", handleDragMove);
    taskList.addEventListener("pointerup", finishPointerInteraction);
    taskList.addEventListener("pointercancel", cancelPointerInteraction);

    if (dragState.dragging && dragState.placeholderCategoryId === category.id) {
      taskList.classList.add("drag-target");
    }

    if (categoryDragState.dragging && categoryDragState.categoryId === category.id) {
      node.classList.add("dragging");
    }

    if (!tasks.length) {
      const empty = document.createElement("button");
      empty.type = "button";
      empty.className = "task-card";
      empty.innerHTML = `
        <div class="task-card-body">
          <div class="task-card-title">No tasks yet</div>
          <div class="task-card-details">Add a task or drag one here.</div>
        </div>
      `;
      empty.addEventListener("click", () => openTaskModal(null, category.id));
      taskList.append(empty);
    } else {
      tasks.forEach((task, index) => {
        if (dragState.dragging && dragState.placeholderCategoryId === category.id && dragState.placeholderIndex === index) {
          taskList.append(createDropMarker());
        }
        taskList.append(renderTask(task, category));
      });
    }

    if (dragState.dragging && dragState.placeholderCategoryId === category.id && dragState.placeholderIndex === tasks.length) {
      taskList.append(createDropMarker());
    }

    ui.boardColumns.append(node);
  });
}

function render() {
  ensureActiveCategory();
  ui.boardTitle.textContent = state.boardName;
  ui.boardNameInput.value = state.boardName;
  ui.uiFontSelect.value = state.uiFont;
  ui.itemFontSelect.value = state.itemFont;
  document.documentElement.style.setProperty("--ui-font", state.uiFont);
  document.documentElement.style.setProperty("--item-font", state.itemFont);
  renderTabs();
  renderColumns();
  populateTaskCategorySelect();
}

function openModal(modal) {
  closeCurrentModal();
  modalState.current = modal.id;
  ui.modalBackdrop.classList.remove("hidden");
  modal.showModal();
}

function closeCurrentModal() {
  const currentModalId = modalState.current;
  if (!currentModalId) {
    ui.modalBackdrop.classList.add("hidden");
    return;
  }
  const modal = document.getElementById(currentModalId);
  if (modal?.open) {
    modal.close();
  }
  modalState.current = null;
  ui.modalBackdrop.classList.add("hidden");
}

function syncBackdropWithModalState() {
  const hasOpenModal = [ui.taskModal, ui.categoryModal, ui.boardModal, ui.resetConfirmModal, ui.helpModal].some((modal) => modal.open);
  ui.modalBackdrop.classList.toggle("hidden", !hasOpenModal);
  if (!hasOpenModal) {
    modalState.current = null;
  }
}

function toLocalInputValue(value) {
  const date = new Date(value);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function fromLocalInputValue(value) {
  if (!value) {
    return null;
  }
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

function openTaskModal(taskId = null, categoryId = null) {
  modalState.taskId = taskId;
  const task = taskId ? state.tasks.find((item) => item.id === taskId) : null;
  const initialCategoryId = task?.categoryId || categoryId || state.activeCategoryId;
  const defaultStart = getDefaultStartAtForNewTask(initialCategoryId);
  ui.taskModalTitle.textContent = task ? "Edit task" : "New task";
  ui.taskTitleInput.value = task?.title || "";
  ui.taskDetailsInput.value = task?.details || "";
  ui.taskStartInput.value = task?.startAt ? toLocalInputValue(task.startAt) : (defaultStart ? toLocalInputValue(defaultStart) : "");
  ui.taskDeadlineInput.value = task?.deadline ? toLocalInputValue(task.deadline) : "";
  ui.taskCategorySelect.value = initialCategoryId;
  ui.deleteTaskButton.classList.toggle("hidden", !task);
  openModal(ui.taskModal);
}

function openCategoryModal(categoryId = null) {
  modalState.categoryId = categoryId;
  const category = categoryId ? state.categories.find((item) => item.id === categoryId) : null;
  ui.categoryModalTitle.textContent = category ? "Edit category" : "New category";
  ui.categoryCaptionInput.value = category?.caption || "";
  renderCategoryColorOptions(category?.color || DEFAULT_CATEGORY_COLOR);
  ui.categoryAllowProgressInput.checked = Boolean(category?.allowProgress);
  ui.deleteCategoryButton.classList.toggle("hidden", !category || state.categories.length <= 1);
  openModal(ui.categoryModal);
}

function openBoardModal() {
  ui.boardNameInput.value = state.boardName;
  ui.uiFontSelect.value = state.uiFont;
  ui.itemFontSelect.value = state.itemFont;
  openModal(ui.boardModal);
}

function openResetConfirmModal() {
  openModal(ui.resetConfirmModal);
}

function openHelpModal() {
  openModal(ui.helpModal);
}

function clearLongPressTimer() {
  if (dragState.longPressTimer) {
    window.clearTimeout(dragState.longPressTimer);
    dragState.longPressTimer = null;
  }
}

function clearCategoryLongPressTimer() {
  if (categoryDragState.longPressTimer) {
    window.clearTimeout(categoryDragState.longPressTimer);
    categoryDragState.longPressTimer = null;
  }
}

function getTaskIndexInCategory(taskId, categoryId) {
  return getTasksForCategory(categoryId).findIndex((task) => task.id === taskId);
}

function createGhost(card, rect) {
  const ghost = card.cloneNode(true);
  ghost.classList.add("drag-armed");
  ghost.style.position = "fixed";
  ghost.style.left = `${rect.left}px`;
  ghost.style.top = `${rect.top}px`;
  ghost.style.width = `${rect.width}px`;
  ghost.style.pointerEvents = "none";
  ghost.style.zIndex = "30";
  ghost.style.opacity = "0.96";
  ghost.style.transform = "rotate(1.2deg)";
  ghost.style.boxShadow = "0 20px 32px rgba(74, 49, 29, 0.28)";
  document.body.append(ghost);
  dragState.ghost = ghost;
}

function createCategoryGhost(sourceElement, rect) {
  const ghost = sourceElement.cloneNode(true);
  ghost.classList.add("drag-armed");
  ghost.style.position = "fixed";
  ghost.style.left = `${rect.left}px`;
  ghost.style.top = `${rect.top}px`;
  ghost.style.width = `${rect.width}px`;
  ghost.style.pointerEvents = "none";
  ghost.style.zIndex = "31";
  ghost.style.opacity = "0.96";
  ghost.style.transform = "rotate(1deg)";
  ghost.style.boxShadow = "0 20px 32px rgba(24, 12, 6, 0.34)";
  document.body.append(ghost);
  categoryDragState.ghost = ghost;
}

function armDrag(card, event) {
  dragState.dragging = true;
  dragState.armedElement = card;
  dragState.armedElement.classList.add("drag-armed");
  const rect = card.getBoundingClientRect();
  dragState.offsetX = event.clientX - rect.left;
  dragState.offsetY = event.clientY - rect.top;
  dragState.placeholderCategoryId = card.dataset.categoryId;
  dragState.placeholderIndex = getTaskIndexInCategory(card.dataset.taskId, card.dataset.categoryId);
  createGhost(card, rect);
  render();
}

function armCategoryDrag(triggerElement, event) {
  const categoryId = triggerElement.dataset.categoryId;
  if (!categoryId) {
    return;
  }

  categoryDragState.dragging = true;
  categoryDragState.categoryId = categoryId;
  categoryDragState.armedElement = triggerElement;
  categoryDragState.armedElement.classList.add("drag-armed");
  categoryDragState.placeholderIndex = state.categories.findIndex((category) => category.id === categoryId);

  const sourceElement = triggerElement.closest(".category-column") || triggerElement;
  const rect = sourceElement.getBoundingClientRect();
  categoryDragState.offsetX = event.clientX - rect.left;
  categoryDragState.offsetY = event.clientY - rect.top;
  createCategoryGhost(sourceElement, rect);
  render();
}

function startLongPress(event) {
  if (event.button !== 0 || dragState.dragging) {
    return;
  }
  const card = event.currentTarget;
  dragState.pointerId = event.pointerId;
  dragState.taskId = card.dataset.taskId;
  dragState.originCategoryId = card.dataset.categoryId;
  dragState.armedElement = card;
  dragState.startX = event.clientX;
  dragState.startY = event.clientY;
  clearLongPressTimer();
  dragState.longPressTimer = window.setTimeout(() => armDrag(card, event), LONG_PRESS_MS);
}

function startCategoryLongPress(event) {
  if (event.button !== 0 || dragState.dragging || categoryDragState.dragging) {
    return;
  }
  const element = event.currentTarget;
  categoryDragState.pointerId = event.pointerId;
  categoryDragState.categoryId = element.dataset.categoryId;
  categoryDragState.armedElement = element;
  categoryDragState.startX = event.clientX;
  categoryDragState.startY = event.clientY;
  clearCategoryLongPressTimer();
  categoryDragState.longPressTimer = window.setTimeout(() => armCategoryDrag(element, event), LONG_PRESS_MS);
}

function handlePreDragMove(event) {
  if (!dragState.longPressTimer || event.pointerId !== dragState.pointerId) {
    return;
  }
  const distance = Math.hypot(event.clientX - dragState.startX, event.clientY - dragState.startY);
  if (distance > 8) {
    clearLongPressTimer();
    dragState.armedElement?.classList.remove("drag-armed");
  }
}

function handleCategoryPreDragMove(event) {
  if (!categoryDragState.longPressTimer || event.pointerId !== categoryDragState.pointerId) {
    return;
  }
  const distance = Math.hypot(event.clientX - categoryDragState.startX, event.clientY - categoryDragState.startY);
  if (distance > 8) {
    clearCategoryLongPressTimer();
    categoryDragState.armedElement?.classList.remove("drag-armed");
  }
}

function updateGhostPosition(clientX, clientY) {
  if (!dragState.ghost) {
    return;
  }
  dragState.ghost.style.left = `${clientX - dragState.offsetX}px`;
  dragState.ghost.style.top = `${clientY - dragState.offsetY}px`;
}

function updateCategoryGhostPosition(clientX, clientY) {
  if (!categoryDragState.ghost) {
    return;
  }
  categoryDragState.ghost.style.left = `${clientX - categoryDragState.offsetX}px`;
  categoryDragState.ghost.style.top = `${clientY - categoryDragState.offsetY}px`;
}

function updatePlaceholder(clientX, clientY) {
  const element = document.elementFromPoint(clientX, clientY);
  const isMobile = window.matchMedia("(max-width: 860px)").matches;
  const tabButton = isMobile ? element?.closest(".tab-button[data-category-id]") : null;

  if (tabButton) {
    const categoryId = tabButton.dataset.categoryId;
    const nextIndex = getTaskCountForCategory(categoryId);
    const changed = dragState.placeholderCategoryId !== categoryId
      || dragState.placeholderIndex !== nextIndex
      || state.activeCategoryId !== categoryId;

    dragState.placeholderCategoryId = categoryId;
    dragState.placeholderIndex = nextIndex;
    state.activeCategoryId = categoryId;

    if (changed) {
      render();
    }
    return;
  }

  const list = element?.closest(".task-list");
  if (!list) {
    return;
  }

  const categoryId = list.dataset.categoryId;
  const cards = [...list.querySelectorAll(".task-card[data-task-id]:not(.dragging)")];
  let nextIndex = cards.length;

  for (let index = 0; index < cards.length; index += 1) {
    const rect = cards[index].getBoundingClientRect();
    if (clientY < rect.top + rect.height / 2) {
      nextIndex = index;
      break;
    }
  }

  dragState.placeholderCategoryId = categoryId;
  dragState.placeholderIndex = nextIndex;
  if (state.activeCategoryId !== categoryId) {
    state.activeCategoryId = categoryId;
  }
  render();
}

function handleDragMove(event) {
  if (!dragState.dragging || event.pointerId !== dragState.pointerId) {
    return;
  }
  updateGhostPosition(event.clientX, event.clientY);
  updatePlaceholder(event.clientX, event.clientY);
}

function updateCategoryPlaceholder(clientX) {
  const isMobile = window.matchMedia("(max-width: 860px)").matches;
  const selector = isMobile
    ? ".tab-button[data-category-id]:not(.dragging)"
    : ".category-column[data-category-id]:not(.dragging)";
  const targets = [...document.querySelectorAll(selector)];

  let nextIndex = targets.length;
  for (let index = 0; index < targets.length; index += 1) {
    const rect = targets[index].getBoundingClientRect();
    if (clientX < rect.left + rect.width / 2) {
      nextIndex = index;
      break;
    }
  }

  categoryDragState.placeholderIndex = nextIndex;
  render();
}

function handleCategoryDragMove(event) {
  if (!categoryDragState.dragging || event.pointerId !== categoryDragState.pointerId) {
    return;
  }
  updateCategoryGhostPosition(event.clientX, event.clientY);
  updateCategoryPlaceholder(event.clientX);
}

function reorderTasks(tasks, taskId, targetCategoryId, targetIndex) {
  const moving = tasks.find((task) => task.id === taskId);
  if (!moving) {
    return tasks;
  }
  const originalCategoryId = moving.categoryId;
  const remaining = tasks.filter((task) => task.id !== taskId);
  moving.categoryId = targetCategoryId;
  if (!moving.startAt && originalCategoryId !== targetCategoryId && categoryAllowsProgress(targetCategoryId)) {
    moving.startAt = new Date().toISOString();
  }

  const result = [];
  let inserted = false;
  let indexWithinCategory = 0;

  for (const task of remaining) {
    if (task.categoryId === targetCategoryId && indexWithinCategory === targetIndex) {
      result.push(moving);
      inserted = true;
    }
    result.push(task);
    if (task.categoryId === targetCategoryId) {
      indexWithinCategory += 1;
    }
  }

  if (!inserted) {
    result.push(moving);
  }
  return result;
}

function commitDrag() {
  const task = state.tasks.find((item) => item.id === dragState.taskId);
  if (!task || dragState.placeholderCategoryId === null || dragState.placeholderIndex === null) {
    render();
    return;
  }
  state.tasks = reorderTasks(state.tasks, task.id, dragState.placeholderCategoryId, dragState.placeholderIndex);
  state.activeCategoryId = dragState.placeholderCategoryId;
  persistAndRender();
}

function reorderCategories(categories, categoryId, targetIndex) {
  const moving = categories.find((category) => category.id === categoryId);
  if (!moving) {
    return categories;
  }

  const remaining = categories.filter((category) => category.id !== categoryId);
  const nextIndex = Math.max(0, Math.min(targetIndex, remaining.length));
  return [
    ...remaining.slice(0, nextIndex),
    moving,
    ...remaining.slice(nextIndex),
  ];
}

function commitCategoryDrag() {
  if (!categoryDragState.categoryId || categoryDragState.placeholderIndex === null) {
    render();
    return;
  }
  state.categories = reorderCategories(state.categories, categoryDragState.categoryId, categoryDragState.placeholderIndex);
  persistAndRender();
}

function resetPointerState() {
  clearLongPressTimer();
  dragState.armedElement?.classList.remove("drag-armed");
  dragState.armedElement = null;
  dragState.pointerId = null;
  dragState.originCategoryId = null;
  dragState.placeholderCategoryId = null;
  dragState.placeholderIndex = null;
  dragState.startX = 0;
  dragState.startY = 0;
  dragState.offsetX = 0;
  dragState.offsetY = 0;
  dragState.dragging = false;
  if (dragState.ghost) {
    dragState.ghost.remove();
    dragState.ghost = null;
  }
}

function resetCategoryPointerState() {
  clearCategoryLongPressTimer();
  categoryDragState.armedElement?.classList.remove("drag-armed");
  categoryDragState.armedElement = null;
  categoryDragState.pointerId = null;
  categoryDragState.categoryId = null;
  categoryDragState.placeholderIndex = null;
  categoryDragState.startX = 0;
  categoryDragState.startY = 0;
  categoryDragState.offsetX = 0;
  categoryDragState.offsetY = 0;
  categoryDragState.dragging = false;
  if (categoryDragState.ghost) {
    categoryDragState.ghost.remove();
    categoryDragState.ghost = null;
  }
}

function finishPointerInteraction(event) {
  if (dragState.pointerId !== event.pointerId) {
    return;
  }
  if (dragState.dragging) {
    dragState.suppressClickUntil = Date.now() + 250;
    commitDrag();
  }
  resetPointerState();
}

function finishCategoryPointerInteraction(event) {
  if (categoryDragState.pointerId !== event.pointerId) {
    return;
  }
  if (categoryDragState.dragging) {
    categoryDragState.suppressClickUntil = Date.now() + 250;
    commitCategoryDrag();
  }
  resetCategoryPointerState();
}

function cancelPointerInteraction(event) {
  if (dragState.pointerId !== event.pointerId) {
    return;
  }
  resetPointerState();
  render();
}

function cancelCategoryPointerInteraction(event) {
  if (categoryDragState.pointerId !== event.pointerId) {
    return;
  }
  resetCategoryPointerState();
  render();
}

async function handleTaskSubmit(event) {
  event.preventDefault();
  const title = ui.taskTitleInput.value.trim();
  const details = ui.taskDetailsInput.value.trim();
  const categoryId = ui.taskCategorySelect.value;
  const requestedStartAt = fromLocalInputValue(ui.taskStartInput.value);
  const deadline = fromLocalInputValue(ui.taskDeadlineInput.value);

  if (!title || !state.categories.some((category) => category.id === categoryId)) {
    return;
  }

  if (modalState.taskId) {
    const task = state.tasks.find((item) => item.id === modalState.taskId);
    if (!task) {
      return;
    }
    const startAt = resolveTaskStartAt({
      existingTask: task,
      requestedStartAt,
      targetCategoryId: categoryId,
    });
    task.title = title;
    task.details = details;
    task.categoryId = categoryId;
    task.startAt = startAt;
    task.deadline = deadline;
  } else {
    const startAt = resolveTaskStartAt({
      requestedStartAt,
      targetCategoryId: categoryId,
    });
    state.tasks.push({
      id: createId(),
      title,
      details,
      categoryId,
      startAt,
      deadline,
      createdAt: new Date().toISOString(),
    });
  }

  state.activeCategoryId = categoryId;
  closeCurrentModal();
  await persistAndRender();
}

async function handleCategorySubmit(event) {
  event.preventDefault();
  const caption = ui.categoryCaptionInput.value.trim();
  const color = modalState.categoryColor || DEFAULT_CATEGORY_COLOR;
  const allowProgress = ui.categoryAllowProgressInput.checked;

  if (!caption || !isHexColor(color)) {
    return;
  }

  if (modalState.categoryId) {
    const category = state.categories.find((item) => item.id === modalState.categoryId);
    if (!category) {
      return;
    }
    category.caption = caption;
    category.color = color;
    category.allowProgress = allowProgress;
  } else {
    const categoryId = createId();
    state.categories.push({ id: categoryId, caption, color, allowProgress });
    state.activeCategoryId = categoryId;
  }

  closeCurrentModal();
  await persistAndRender();
}

async function handleBoardSubmit(event) {
  event.preventDefault();
  state.boardName = ui.boardNameInput.value.trim() || DEFAULT_BOARD_NAME;
  state.uiFont = ui.uiFontSelect.value || DEFAULT_UI_FONT;
  state.itemFont = ui.itemFontSelect.value || DEFAULT_ITEM_FONT;
  closeCurrentModal();
  await persistAndRender();
}

async function handleTaskDelete() {
  if (!modalState.taskId) {
    return;
  }
  state.tasks = state.tasks.filter((task) => task.id !== modalState.taskId);
  closeCurrentModal();
  await persistAndRender();
}

async function handleCategoryDelete() {
  if (!modalState.categoryId || state.categories.length <= 1) {
    return;
  }
  const categoryId = modalState.categoryId;
  const categoryIndex = state.categories.findIndex((category) => category.id === categoryId);
  state.categories = state.categories.filter((category) => category.id !== categoryId);
  const fallbackCategory = state.categories[Math.max(0, categoryIndex - 1)] || state.categories[0];
  state.tasks = state.tasks.map((task) => (
    task.categoryId === categoryId ? { ...task, categoryId: fallbackCategory.id } : task
  ));
  state.activeCategoryId = fallbackCategory.id;
  closeCurrentModal();
  await persistAndRender();
}

function slugify(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "kanban";
}

function handleBoardExport() {
  const payload = JSON.stringify({
    exportedAt: new Date().toISOString(),
    state: getPersistedStateSnapshot(),
  }, null, 2);
  const blob = new Blob([payload], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${slugify(state.boardName)}-kanban.json`;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

async function handleBoardImport(event) {
  const [file] = event.target.files || [];
  if (!file) {
    return;
  }
  try {
    const text = await file.text();
    const parsed = JSON.parse(text);
    syncState(parsed.state || parsed);
    closeCurrentModal();
    await persistAndRender();
  } catch (error) {
    console.error("Import failed", error);
    alert("The selected file is not a valid kanban export.");
  } finally {
    ui.importBoardInput.value = "";
  }
}

async function handleResetTasksAndCategories() {
  const defaultState = createDefaultState();
  state.boardName = defaultState.boardName;
  state.uiFont = defaultState.uiFont;
  state.itemFont = defaultState.itemFont;
  state.categories = defaultState.categories;
  state.tasks = defaultState.tasks;
  state.activeCategoryId = defaultState.activeCategoryId;
  closeCurrentModal();
  await persistAndRender();
}

async function handleResetColors() {
  state.categories = state.categories.map((category) => ({
    ...category,
    color: DEFAULT_CATEGORY_COLOR,
  }));
  closeCurrentModal();
  await persistAndRender();
}

function bindEvents() {
  ui.addCategoryFab.addEventListener("click", () => openCategoryModal());
  ui.openHelp.addEventListener("click", openHelpModal);
  ui.openBoardSettings.addEventListener("click", openBoardModal);
  ui.taskForm.addEventListener("submit", handleTaskSubmit);
  ui.categoryForm.addEventListener("submit", handleCategorySubmit);
  ui.boardForm.addEventListener("submit", handleBoardSubmit);
  ui.deleteTaskButton.addEventListener("click", handleTaskDelete);
  ui.deleteCategoryButton.addEventListener("click", handleCategoryDelete);
  ui.exportBoardButton.addEventListener("click", handleBoardExport);
  ui.importBoardButton.addEventListener("click", () => ui.importBoardInput.click());
  ui.importBoardInput.addEventListener("change", handleBoardImport);
  ui.resetTasksAndCategoriesButton.addEventListener("click", openResetConfirmModal);
  ui.resetColorsButton.addEventListener("click", handleResetColors);
  ui.resetConfirmForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    await handleResetTasksAndCategories();
  });

  document.querySelectorAll("[data-close-modal]").forEach((button) => {
    button.addEventListener("click", closeCurrentModal);
  });

  [ui.taskModal, ui.categoryModal, ui.boardModal, ui.resetConfirmModal, ui.helpModal].forEach((modal) => {
    modal.addEventListener("cancel", (event) => {
      event.preventDefault();
      closeCurrentModal();
    });
    modal.addEventListener("close", syncBackdropWithModalState);
  });

  ui.modalBackdrop.addEventListener("click", (event) => {
    if (event.target === ui.modalBackdrop) {
      closeCurrentModal();
    }
  });

  window.addEventListener("resize", render);
  window.addEventListener("pointermove", handleDragMove);
  window.addEventListener("pointermove", handleCategoryDragMove);
  window.addEventListener("pointerup", finishPointerInteraction);
  window.addEventListener("pointerup", finishCategoryPointerInteraction);
  window.addEventListener("pointercancel", cancelPointerInteraction);
  window.addEventListener("pointercancel", cancelCategoryPointerInteraction);
}

async function initializeApp() {
  applyGeneratedLeatherTexture();
  const storedState = await readState();
  syncState(storedState || createDefaultState());
  bindEvents();
  render();
  if (!state.hasSeenHelp) {
    state.hasSeenHelp = true;
    await writeState();
    openHelpModal();
  }
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) {
    return;
  }

  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch((error) => {
      console.error("Service worker registration failed", error);
    });
  });
}

registerServiceWorker();

initializeApp().catch((error) => {
  console.error("Failed to initialize app", error);
  applyGeneratedLeatherTexture();
  syncState(createDefaultState());
  bindEvents();
  render();
});
