/**
 * The interactive terminal loop: raw-mode key handling, an undo stack, a best
 * score cached in the home directory, and an AI autoplay toggle.
 */

import { homedir } from "node:os";
import { join } from "node:path";
import { readFileSync, writeFileSync } from "node:fs";

import {
  type GameState,
  type Direction,
  newGame,
  move,
  keepPlaying,
} from "./game.js";
import { bestMove } from "./ai.js";
import { render } from "./render.js";

const BEST_FILE = join(homedir(), ".term2048.json");

function loadBest(size: number): number {
  try {
    const data = JSON.parse(readFileSync(BEST_FILE, "utf8")) as Record<string, number>;
    return data[`s${size}`] ?? 0;
  } catch {
    return 0;
  }
}

function saveBest(size: number, score: number): void {
  try {
    let data: Record<string, number> = {};
    try {
      data = JSON.parse(readFileSync(BEST_FILE, "utf8")) as Record<string, number>;
    } catch {
      /* first run */
    }
    if (score > (data[`s${size}`] ?? 0)) {
      data[`s${size}`] = score;
      writeFileSync(BEST_FILE, JSON.stringify(data));
    }
  } catch {
    /* read-only home; not fatal */
  }
}

const KEY_TO_DIR: Record<string, Direction> = {
  "\x1b[A": "up",
  "\x1b[B": "down",
  "\x1b[C": "right",
  "\x1b[D": "left",
  w: "up",
  s: "down",
  d: "right",
  a: "left",
  k: "up",
  j: "down",
  l: "right",
  h: "left",
};

export interface TuiOptions {
  size: number;
  target: number;
  seed?: number;
  ai?: boolean;
}

export function runTui(opts: TuiOptions): void {
  const { stdin, stdout } = process;
  let state: GameState = newGame(opts);
  let history: GameState[] = [];
  let best = loadBest(opts.size);
  let aiOn = opts.ai ?? false;
  let note = opts.seed != null ? `seed ${opts.seed}` : "";
  let aiTimer: NodeJS.Timeout | undefined;

  stdout.write("\x1b[?25l"); // hide cursor
  stdin.setRawMode?.(true);
  stdin.resume();
  stdin.setEncoding("utf8");

  const draw = (): void => {
    stdout.write("\x1b[2J\x1b[H" + render(state, { best, ai: aiOn, note }) + "\n");
  };

  const cleanup = (): void => {
    if (aiTimer) clearInterval(aiTimer);
    saveBest(opts.size, state.score);
    stdout.write("\x1b[?25h\x1b[0m\n"); // show cursor, reset
    stdin.setRawMode?.(false);
    stdin.pause();
  };

  const quit = (): void => {
    cleanup();
    process.exit(0);
  };

  const step = (dir: Direction): void => {
    const res = move(state, dir);
    if (!res.changed) return;
    history.push(state);
    if (history.length > 200) history.shift();
    state = res.state;
    note = "";
    if (state.score > best) best = state.score;
    draw();
  };

  const stopAi = (): void => {
    aiOn = false;
    if (aiTimer) {
      clearInterval(aiTimer);
      aiTimer = undefined;
    }
  };

  const startAi = (): void => {
    aiOn = true;
    aiTimer = setInterval(() => {
      if (state.status === "lost") return stopAi(), draw();
      const dir = bestMove(state.grid);
      if (!dir) return stopAi(), draw();
      step(dir);
    }, 90);
  };

  stdin.on("data", (chunk: string) => {
    for (const key of splitKeys(chunk)) {
      if (key === "\x03" || key === "q") return quit();

      if (key === "a") {
        aiOn ? stopAi() : startAi();
        draw();
        continue;
      }
      if (aiOn && key !== "r") continue; // ignore manual moves while AI drives

      if (key === "r") {
        stopAi();
        state = newGame({ ...opts, seed: undefined });
        history = [];
        note = "new game";
        draw();
        continue;
      }
      if (key === "u") {
        const prev = history.pop();
        if (prev) {
          state = prev;
          note = "undo";
          draw();
        }
        continue;
      }
      if ((key === " " || key === "\r") && state.status === "won") {
        state = keepPlaying(state);
        draw();
        continue;
      }
      const dir = KEY_TO_DIR[key];
      if (dir) step(dir);
    }
  });

  process.on("SIGINT", quit);
  process.on("SIGTERM", quit);

  draw();
  if (aiOn) {
    aiOn = false;
    startAi();
  }
}

/** Split a read into individual keys, keeping escape sequences intact. */
function splitKeys(chunk: string): string[] {
  const keys: string[] = [];
  for (let i = 0; i < chunk.length; i++) {
    if (chunk[i] === "\x1b" && chunk[i + 1] === "[" && chunk[i + 2]) {
      keys.push(chunk.slice(i, i + 3));
      i += 2;
    } else {
      keys.push(chunk[i]!);
    }
  }
  return keys;
}
