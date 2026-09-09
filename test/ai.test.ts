import { describe, it, expect } from "vitest";
import {
  newGame,
  move,
  bestMove,
  heuristic,
  legalMoves,
  maxTile,
  type Grid,
  type GameState,
} from "../src/index.js";

describe("heuristic", () => {
  it("prefers the board with more room", () => {
    const roomy: Grid = [
      [2, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 4],
    ];
    const cramped: Grid = [
      [2, 4, 8, 16],
      [4, 8, 16, 32],
      [8, 16, 32, 64],
      [16, 32, 64, 0],
    ];
    expect(heuristic(roomy)).toBeGreaterThan(heuristic(cramped));
  });

  it("rewards keeping the biggest tile in a corner", () => {
    const corner: Grid = [
      [64, 8, 2, 0],
      [4, 2, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ];
    const centre: Grid = [
      [8, 2, 0, 0],
      [4, 64, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ];
    expect(heuristic(corner)).toBeGreaterThan(heuristic(centre));
  });
});

describe("bestMove", () => {
  it("returns a legal direction for a normal board", () => {
    const s = newGame({ seed: 101 });
    const dir = bestMove(s.grid);
    expect(dir).not.toBeNull();
    expect(legalMoves(s.grid)).toContain(dir);
  });

  it("returns null when the board is locked", () => {
    const locked: Grid = [
      [2, 4, 2, 4],
      [4, 2, 4, 2],
      [2, 4, 2, 4],
      [4, 2, 4, 2],
    ];
    expect(bestMove(locked)).toBeNull();
  });

  it("takes the only move that does something", () => {
    // Every column is already packed upward and no vertical merges exist, and
    // the top row cannot merge; only "down" (or nothing) is possible here.
    const grid: Grid = [
      [2, 4, 2, 4],
      [4, 2, 4, 2],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ];
    expect(legalMoves(grid)).toEqual(["down"]);
    expect(bestMove(grid)).toBe("down");
  });
});

describe("full games", () => {
  it("never plays an illegal move and always makes progress", () => {
    let s = newGame({ seed: 7 });
    for (let i = 0; i < 120; i++) {
      const dir = bestMove(s.grid);
      if (!dir) break;
      expect(legalMoves(s.grid)).toContain(dir);
      const res = move(s, dir);
      expect(res.changed).toBe(true);
      s = res.state;
    }
    expect(s.score).toBeGreaterThan(0);
  });

  it("reaches a large tile from a fixed seed", () => {
    let s: GameState = newGame({ seed: 2024 });
    for (let i = 0; i < 3000; i++) {
      const dir = bestMove(s.grid);
      if (!dir) break;
      s = move(s, dir).state;
    }
    // The expectimax player clears 512 comfortably on essentially every seed.
    expect(maxTile(s.grid)).toBeGreaterThanOrEqual(512);
  });
});
