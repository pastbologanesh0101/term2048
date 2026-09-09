/**
 * An expectimax player for 2048.
 *
 * The move layer is a max node (the player picks a direction); the tile the
 * game drops afterwards is a chance node (every empty cell, times {2: 0.9,
 * 4: 0.1}). Leaves are scored by {@link heuristic}. Search depth adapts to how
 * crowded the board is so a full game stays quick.
 */

import {
  type Grid,
  type Direction,
  DIRECTIONS,
  slide,
  gridEquals,
  emptyCells,
  maxTile,
} from "./game.js";

export interface AiOptions {
  /** Force a fixed search depth instead of the adaptive one. */
  depth?: number;
}

const log2 = (v: number): number => (v > 0 ? Math.log2(v) : 0);

function adaptiveDepth(grid: Grid): number {
  const free = emptyCells(grid).length;
  if (free >= 6) return 3;
  if (free >= 3) return 4;
  return 5;
}

/** Reward rows/columns that keep a consistent ascending or descending order. */
function monotonicity(grid: Grid): number {
  let best = 0;
  for (const orient of [grid, transpose(grid)]) {
    let inc = 0;
    let dec = 0;
    for (const line of orient) {
      for (let i = 0; i + 1 < line.length; i++) {
        const a = log2(line[i]!);
        const b = log2(line[i + 1]!);
        if (a > b) dec -= a - b;
        else inc -= b - a;
      }
    }
    best += Math.max(inc, dec);
  }
  return best;
}

/** Penalise neighbouring tiles that are far apart in magnitude. */
function smoothness(grid: Grid): number {
  let s = 0;
  const n = grid.length;
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      const v = grid[r]![c]!;
      if (v === 0) continue;
      if (c + 1 < n && grid[r]![c + 1]! !== 0) {
        s -= Math.abs(log2(v) - log2(grid[r]![c + 1]!));
      }
      if (r + 1 < n && grid[r + 1]![c]! !== 0) {
        s -= Math.abs(log2(v) - log2(grid[r + 1]![c]!));
      }
    }
  }
  return s;
}

function maxInCorner(grid: Grid): number {
  const n = grid.length - 1;
  const m = maxTile(grid);
  const corners = [grid[0]![0]!, grid[0]![n]!, grid[n]![0]!, grid[n]![n]!];
  return corners.includes(m) ? 1 : 0;
}

const transpose = (g: Grid): Grid =>
  g[0]!.map((_, c) => g.map((row) => row[c] as number));

/** Static evaluation of a board. Higher is better. */
export function heuristic(grid: Grid): number {
  return (
    emptyCells(grid).length * 270 +
    monotonicity(grid) * 47 +
    smoothness(grid) * 11 +
    maxInCorner(grid) * 700 +
    log2(maxTile(grid)) * 10
  );
}

function expectimax(grid: Grid, depth: number, node: "max" | "chance"): number {
  if (depth <= 0) return heuristic(grid);

  if (node === "max") {
    let best = -Infinity;
    let moved = false;
    for (const dir of DIRECTIONS) {
      const { grid: g, gained } = slide(grid, dir);
      if (gridEquals(g, grid)) continue;
      moved = true;
      best = Math.max(best, gained * 0.1 + expectimax(g, depth - 1, "chance"));
    }
    return moved ? best : heuristic(grid);
  }

  const cells = emptyCells(grid);
  if (cells.length === 0) return heuristic(grid);
  const weight = 1 / cells.length;
  let sum = 0;
  for (const [r, c] of cells) {
    for (const [value, prob] of [
      [2, 0.9],
      [4, 0.1],
    ] as const) {
      const g = grid.map((row) => row.slice());
      g[r]![c] = value;
      sum += weight * prob * expectimax(g, depth - 1, "max");
    }
  }
  return sum;
}

/** Best direction for the current board, or null if the game is stuck. */
export function bestMove(grid: Grid, opts: AiOptions = {}): Direction | null {
  const depth = opts.depth ?? adaptiveDepth(grid);
  let best: Direction | null = null;
  let bestValue = -Infinity;
  for (const dir of DIRECTIONS) {
    const { grid: g, gained } = slide(grid, dir);
    if (gridEquals(g, grid)) continue;
    const value = gained * 0.1 + expectimax(g, depth - 1, "chance");
    if (value > bestValue) {
      bestValue = value;
      best = dir;
    }
  }
  return best;
}
