import "./style.css";
import {
  newGame,
  move,
  keepPlaying,
  type GameState,
  type Direction,
} from "../src/game.js";
import { bestMove } from "../src/ai.js";

const SIZE = 4;
const BEST_KEY = `term2048.best.${SIZE}`;

const $ = <T extends HTMLElement>(id: string): T =>
  document.getElementById(id) as T;

const els = {
  board: $("board"),
  cells: $("cells"),
  tiles: $("tiles"),
  score: $("score"),
  best: $("best"),
  overlay: $("overlay"),
  overlayText: $<HTMLParagraphElement>("overlayText"),
  overlayBtn: $<HTMLButtonElement>("overlayBtn"),
  new: $<HTMLButtonElement>("new"),
  undo: $<HTMLButtonElement>("undo"),
  ai: $<HTMLButtonElement>("ai"),
};

let state: GameState = newGame({ size: SIZE });
let history: GameState[] = [];
let prevGrid: number[][] = blank();
let best = loadBest();
let aiTimer: number | undefined;

function blank(): number[][] {
  return Array.from({ length: SIZE }, () => new Array<number>(SIZE).fill(0));
}

function loadBest(): number {
  try {
    return Number(localStorage.getItem(BEST_KEY)) || 0;
  } catch {
    return 0;
  }
}

function saveBest(): void {
  try {
    if (state.score > best) {
      best = state.score;
      localStorage.setItem(BEST_KEY, String(best));
    }
  } catch {
    /* private mode — ignore */
  }
}

// --- rendering ---------------------------------------------------------

function buildCells(): void {
  els.board.style.setProperty("--n", String(SIZE));
  els.cells.replaceChildren(
    ...Array.from({ length: SIZE * SIZE }, () => document.createElement("i")),
  );
}

function render(): void {
  const frag = document.createDocumentFragment();
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      const v = state.grid[r]![c]!;
      if (v === 0) continue;
      const tile = document.createElement("div");
      tile.className = "tile";
      tile.style.gridArea = `${r + 1} / ${c + 1}`;
      tile.textContent = String(v);
      tile.dataset["len"] = String(String(v).length);
      if (v <= 2048) tile.dataset["v"] = String(v);
      else tile.dataset["big"] = "";
      if (prevGrid[r]![c] !== v) tile.dataset["changed"] = "";
      frag.appendChild(tile);
    }
  }
  els.tiles.replaceChildren(frag);
  els.score.textContent = String(state.score);
  els.best.textContent = String(Math.max(best, state.score));
  els.undo.disabled = history.length === 0;

  if (state.status === "won") {
    showOverlay(`You made ${state.target}!`, "Keep going", () => {
      state = keepPlaying(state);
      hideOverlay();
      render();
    });
  } else if (state.status === "lost") {
    showOverlay("Game over", "New game", reset);
  } else {
    hideOverlay();
  }

  prevGrid = state.grid.map((row) => row.slice());
}

function showOverlay(text: string, btn: string, onClick: () => void): void {
  els.overlayText.textContent = text;
  els.overlayBtn.textContent = btn;
  els.overlayBtn.onclick = onClick;
  els.overlay.hidden = false;
}

function hideOverlay(): void {
  els.overlay.hidden = true;
}

// --- actions ---------------------------------------------------------

function step(dir: Direction): void {
  if (state.status === "lost") return;
  const res = move(state, dir);
  if (!res.changed) return;
  history.push(state);
  if (history.length > 100) history.shift();
  state = res.state;
  saveBest();
  render();
}

function undo(): void {
  const prev = history.pop();
  if (!prev) return;
  stopAi();
  state = prev;
  prevGrid = state.grid.map((row) => row.slice());
  render();
}

function reset(): void {
  stopAi();
  state = newGame({ size: SIZE });
  history = [];
  prevGrid = blank();
  render();
}

function stopAi(): void {
  if (aiTimer !== undefined) {
    clearInterval(aiTimer);
    aiTimer = undefined;
  }
  els.ai.setAttribute("aria-pressed", "false");
  els.ai.textContent = "Let AI play";
}

function startAi(): void {
  els.ai.setAttribute("aria-pressed", "true");
  els.ai.textContent = "Stop AI";
  aiTimer = window.setInterval(() => {
    if (state.status === "lost") return stopAi();
    const dir = bestMove(state.grid);
    if (!dir) return stopAi();
    step(dir);
  }, 110);
}

// --- input -----------------------------------------------------------

const KEYS: Record<string, Direction> = {
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
  w: "up",
  s: "down",
  a: "left",
  d: "right",
  k: "up",
  j: "down",
  h: "left",
  l: "right",
};

window.addEventListener("keydown", (e) => {
  const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  if (key === "u") return undo();
  if (key === "a" && !e.repeat) {
    return aiTimer === undefined ? startAi() : stopAi();
  }
  const dir = KEYS[key];
  if (dir) {
    e.preventDefault();
    stopAiIfDriving();
    step(dir);
  }
});

function stopAiIfDriving(): void {
  if (aiTimer !== undefined) stopAi();
}

let touch: { x: number; y: number } | null = null;
els.board.addEventListener(
  "touchstart",
  (e) => {
    const t = e.changedTouches[0]!;
    touch = { x: t.clientX, y: t.clientY };
  },
  { passive: true },
);
els.board.addEventListener("touchend", (e) => {
  if (!touch) return;
  const t = e.changedTouches[0]!;
  const dx = t.clientX - touch.x;
  const dy = t.clientY - touch.y;
  touch = null;
  if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;
  stopAiIfDriving();
  if (Math.abs(dx) > Math.abs(dy)) step(dx > 0 ? "right" : "left");
  else step(dy > 0 ? "down" : "up");
});

els.new.addEventListener("click", reset);
els.undo.addEventListener("click", undo);
els.ai.addEventListener("click", () =>
  aiTimer === undefined ? startAi() : stopAi(),
);

// --- go ------------------------------------------------------------

buildCells();
render();
els.board.focus();
