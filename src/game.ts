/**
 * The rules of 2048, as pure functions.
 *
 * A board is an `N x N` array of numbers, row-major, where `0` is an empty
 * cell. Nothing here touches the terminal or the clock: the random number
 * generator is a seedable 32-bit integer that lives inside {@link GameState},
 * so a game is fully reproducible and serialisable.
 */

export type Grid = number[][];
export type Direction = "up" | "down" | "left" | "right";
export type GameStatus = "playing" | "won" | "lost";

export const DIRECTIONS: readonly Direction[] = ["up", "down", "left", "right"];

export interface GameState {
  grid: Grid;
  score: number;
  status: GameStatus;
  /** Board side length. */
  size: number;
  /** Tile value that counts as a win. */
  target: number;
  /** Latches once the target has been reached, so "keep playing" works. */
  won: boolean;
  /** Number of moves that actually changed the board. */
  moves: number;
  /** mulberry32 state. Advance it only through {@link nextRandom}. */
  rngState: number;
}

export interface NewGameOptions {
  size?: number;
  target?: number;
  seed?: number;
}

export interface Spawn {
  r: number;
  c: number;
  value: 2 | 4;
}

export interface MoveResult {
  state: GameState;
  /** False when the chosen direction was a no-op (board unchanged). */
  changed: boolean;
  /** The tile the game added after the slide, if any. */
  spawn: Spawn | null;
}

// --- RNG --------------------------------------------------------------------

/**
 * One step of mulberry32. Returns the float in [0, 1) together with the new
 * generator state, so callers thread the state explicitly.
 */
export function nextRandom(state: number): [value: number, nextState: number] {
  const a = (state + 0x6d2b79f5) | 0;
  let t = a;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  const value = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  return [value, a];
}

// --- grid helpers ---------------------------------------------------------

const cloneGrid = (g: Grid): Grid => g.map((row) => row.slice());

const emptyGrid = (size: number): Grid =>
  Array.from({ length: size }, () => new Array<number>(size).fill(0));

export function emptyCells(g: Grid): Array<[number, number]> {
  const cells: Array<[number, number]> = [];
  for (let r = 0; r < g.length; r++) {
    const row = g[r]!;
    for (let c = 0; c < row.length; c++) {
      if (row[c] === 0) cells.push([r, c]);
    }
  }
  return cells;
}

export function gridEquals(a: Grid, b: Grid): boolean {
  for (let r = 0; r < a.length; r++) {
    for (let c = 0; c < a[r]!.length; c++) {
      if (a[r]![c] !== b[r]![c]) return false;
    }
  }
  return true;
}

export function maxTile(g: Grid): number {
  let m = 0;
  for (const row of g) for (const v of row) if (v > m) m = v;
  return m;
}

const transpose = (g: Grid): Grid =>
  g[0]!.map((_, c) => g.map((row) => row[c] as number));

const reverseRows = (g: Grid): Grid => g.map((row) => row.slice().reverse());

/**
 * Collapse a single row to the left: drop gaps, then merge each equal pair
 * once, left to right. Returns the new row (same length) and the points won.
 */
export function collapseRow(row: number[]): { row: number[]; gained: number } {
  const nums = row.filter((v) => v !== 0);
  const out: number[] = [];
  let gained = 0;
  let i = 0;
  while (i < nums.length) {
    const cur = nums[i] as number;
    if (nums[i + 1] === cur) {
      const merged = cur * 2;
      out.push(merged);
      gained += merged;
      i += 2;
    } else {
      out.push(cur);
      i += 1;
    }
  }
  while (out.length < row.length) out.push(0);
  return { row: out, gained };
}

/**
 * Slide the whole board one direction. Pure: no tile is spawned, the input is
 * not mutated. `left` is the canonical case; the others are reflections of it.
 */
export function slide(grid: Grid, dir: Direction): { grid: Grid; gained: number } {
  let work = cloneGrid(grid);
  if (dir === "up" || dir === "down") work = transpose(work);
  if (dir === "right" || dir === "down") work = reverseRows(work);

  let gained = 0;
  work = work.map((row) => {
    const res = collapseRow(row);
    gained += res.gained;
    return res.row;
  });

  if (dir === "right" || dir === "down") work = reverseRows(work);
  if (dir === "up" || dir === "down") work = transpose(work);
  return { grid: work, gained };
}

/** True while at least one legal move exists. */
export function canMove(grid: Grid): boolean {
  if (emptyCells(grid).length > 0) return true;
  for (let r = 0; r < grid.length; r++) {
    for (let c = 0; c < grid[r]!.length; c++) {
      const v = grid[r]![c]!;
      if (c + 1 < grid.length && grid[r]![c + 1] === v) return true;
      if (r + 1 < grid.length && grid[r + 1]![c] === v) return true;
    }
  }
  return false;
}

export const isWin = (grid: Grid, target: number): boolean =>
  maxTile(grid) >= target;

/** Place a 2 (90%) or 4 (10%) on a random empty cell. */
export function spawnTile(
  grid: Grid,
  rngState: number,
): { grid: Grid; rngState: number; spawn: Spawn | null } {
  const cells = emptyCells(grid);
  if (cells.length === 0) return { grid, rngState, spawn: null };

  const [pick, s1] = nextRandom(rngState);
  const [r, c] = cells[Math.floor(pick * cells.length)]!;
  const [roll, s2] = nextRandom(s1);
  const value: 2 | 4 = roll < 0.9 ? 2 : 4;

  const next = cloneGrid(grid);
  next[r]![c] = value;
  return { grid: next, rngState: s2, spawn: { r, c, value } };
}

// --- game lifecycle -----------------------------------------------------

export function newGame(opts: NewGameOptions = {}): GameState {
  const size = opts.size ?? 4;
  if (size < 2) throw new Error("size must be at least 2");
  const target = opts.target ?? 2048;
  const seed = (opts.seed ?? (Date.now() >>> 0)) | 0;

  let grid = emptyGrid(size);
  let rngState = seed;
  for (let i = 0; i < 2; i++) {
    const s = spawnTile(grid, rngState);
    grid = s.grid;
    rngState = s.rngState;
  }

  return { grid, score: 0, status: "playing", size, target, won: false, moves: 0, rngState };
}

/** Try to move; on a real move, spawn a tile and refresh the status. */
export function move(state: GameState, dir: Direction): MoveResult {
  const { grid: slid, gained } = slide(state.grid, dir);
  if (gridEquals(slid, state.grid)) {
    return { state, changed: false, spawn: null };
  }

  const spawned = spawnTile(slid, state.rngState);
  const won = state.won || isWin(spawned.grid, state.target);
  let status: GameStatus;
  if (won && !state.won) status = "won";
  else if (!canMove(spawned.grid)) status = "lost";
  else status = "playing";

  const next: GameState = {
    ...state,
    grid: spawned.grid,
    score: state.score + gained,
    won,
    status,
    moves: state.moves + 1,
    rngState: spawned.rngState,
  };
  return { state: next, changed: true, spawn: spawned.spawn };
}

/** Dismiss the win banner and carry on from a won position. */
export function keepPlaying(state: GameState): GameState {
  return state.status === "won" ? { ...state, status: "playing" } : state;
}

/** Directions that would actually change the board right now. */
export function legalMoves(grid: Grid): Direction[] {
  return DIRECTIONS.filter((d) => !gridEquals(slide(grid, d).grid, grid));
}
