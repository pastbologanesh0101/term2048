import { describe, it, expect } from "vitest";
import {
  newGame,
  move,
  slide,
  collapseRow,
  canMove,
  isWin,
  keepPlaying,
  legalMoves,
  nextRandom,
  type Grid,
} from "../src/index.js";

const nonZero = (g: Grid) => g.flat().filter((v) => v !== 0).length;

describe("collapseRow", () => {
  it("slides tiles over gaps", () => {
    expect(collapseRow([0, 2, 0, 2])).toEqual({ row: [4, 0, 0, 0], gained: 4 });
    expect(collapseRow([2, 0, 0, 0])).toEqual({ row: [2, 0, 0, 0], gained: 0 });
  });

  it("merges each tile at most once per move", () => {
    expect(collapseRow([2, 2, 2, 2])).toEqual({ row: [4, 4, 0, 0], gained: 8 });
    expect(collapseRow([4, 4, 8])).toEqual({ row: [8, 8, 0], gained: 8 });
  });

  it("merges the leftmost pair first", () => {
    expect(collapseRow([2, 2, 2])).toEqual({ row: [4, 2, 0], gained: 4 });
  });

  it("does not merge unequal neighbours", () => {
    expect(collapseRow([2, 4, 2, 4])).toEqual({ row: [2, 4, 2, 4], gained: 0 });
  });

  it("preserves row length", () => {
    expect(collapseRow([2, 2, 4, 4, 8, 8]).row).toHaveLength(6);
  });
});

describe("slide", () => {
  const grid: Grid = [
    [2, 2, 0, 0],
    [0, 4, 4, 0],
    [0, 0, 0, 2],
    [8, 0, 8, 0],
  ];

  it("slides left", () => {
    expect(slide(grid, "left")).toEqual({
      grid: [
        [4, 0, 0, 0],
        [8, 0, 0, 0],
        [2, 0, 0, 0],
        [16, 0, 0, 0],
      ],
      gained: 4 + 8 + 16,
    });
  });

  it("slides right", () => {
    expect(slide(grid, "right").grid).toEqual([
      [0, 0, 0, 4],
      [0, 0, 0, 8],
      [0, 0, 0, 2],
      [0, 0, 0, 16],
    ]);
  });

  it("slides up and down", () => {
    expect(slide(grid, "up").grid).toEqual([
      [2, 2, 4, 2],
      [8, 4, 8, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ]);
    expect(slide(grid, "down").grid).toEqual([
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [2, 2, 4, 0],
      [8, 4, 8, 2],
    ]);
  });

  it("is a no-op when nothing can move that way", () => {
    const packed: Grid = [
      [2, 4, 2, 4],
      [4, 2, 4, 2],
      [2, 4, 2, 4],
      [4, 2, 4, 2],
    ];
    expect(slide(packed, "left").grid).toEqual(packed);
  });
});

describe("move", () => {
  it("spawns exactly one tile on a real move", () => {
    const s = newGame({ seed: 1 });
    const before = nonZero(s.grid);
    const res = move(s, bestScoringDir(s.grid));
    expect(res.changed).toBe(true);
    expect(nonZero(res.state.grid)).toBe(before + 1);
    expect(res.spawn).not.toBeNull();
  });

  it("returns the same state and no spawn on a no-op move", () => {
    const s = newGame({ seed: 2 });
    // Find a direction that does nothing, if any; otherwise skip.
    const dead = (["up", "down", "left", "right"] as const).find(
      (d) => slide(s.grid, d).grid.flat().join() === s.grid.flat().join(),
    );
    if (!dead) return;
    const res = move(s, dead);
    expect(res.changed).toBe(false);
    expect(res.state).toBe(s);
    expect(res.spawn).toBeNull();
  });

  it("adds the merge value to the score", () => {
    const s = {
      ...newGame({ seed: 3 }),
      grid: [
        [2, 2, 0, 0],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
      ] as Grid,
      score: 0,
    };
    const res = move(s, "left");
    expect(res.state.score).toBe(4);
  });
});

describe("status", () => {
  it("canMove is false only on a locked board", () => {
    expect(
      canMove([
        [2, 4, 2, 4],
        [4, 2, 4, 2],
        [2, 4, 2, 4],
        [4, 2, 4, 8],
      ]),
    ).toBe(false);
    expect(
      canMove([
        [2, 4, 2, 4],
        [4, 2, 4, 2],
        [2, 4, 2, 4],
        [4, 2, 4, 4],
      ]),
    ).toBe(true);
  });

  it("isWin respects the target", () => {
    const g: Grid = [
      [2048, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ];
    expect(isWin(g, 2048)).toBe(true);
    expect(isWin(g, 4096)).toBe(false);
  });

  it("latches 'won' and lets you keep playing", () => {
    let s = {
      ...newGame({ seed: 5 }),
      grid: [
        [1024, 1024, 0, 0],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
      ] as Grid,
      won: false,
      status: "playing" as const,
    };
    s = move(s, "left").state;
    expect(s.status).toBe("won");
    expect(s.won).toBe(true);

    s = keepPlaying(s);
    expect(s.status).toBe("playing");

    // reaching the target again does not re-pop the banner
    s = move(s, "left").state;
    expect(s.status).not.toBe("won");
  });

  it("lists only board-changing directions", () => {
    const g: Grid = [
      [2, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ];
    expect(legalMoves(g).sort()).toEqual(["down", "right"]);
  });
});

describe("determinism", () => {
  it("newGame is reproducible from a seed", () => {
    expect(newGame({ seed: 777 }).grid).toEqual(newGame({ seed: 777 }).grid);
  });

  it("starts with two tiles, each a 2 or a 4", () => {
    const s = newGame({ seed: 9 });
    const tiles = s.grid.flat().filter((v) => v !== 0);
    expect(tiles).toHaveLength(2);
    expect(tiles.every((v) => v === 2 || v === 4)).toBe(true);
  });

  it("a full seeded game replays identically", () => {
    const play = () => {
      let s = newGame({ seed: 12345 });
      for (let i = 0; i < 40; i++) s = move(s, (["up", "left", "down", "right"] as const)[i % 4]!).state;
      return s;
    };
    expect(play().grid).toEqual(play().grid);
    expect(play().score).toBe(play().score);
  });

  it("nextRandom yields reproducible values in [0, 1)", () => {
    let state = 42;
    const seq: number[] = [];
    for (let i = 0; i < 5; i++) {
      const [v, next] = nextRandom(state);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
      seq.push(v);
      state = next;
    }
    let replay = 42;
    for (const expected of seq) {
      const [v, next] = nextRandom(replay);
      expect(v).toBe(expected);
      replay = next;
    }
  });
});

/** Pick whichever legal direction exists (helper for spawn tests). */
function bestScoringDir(grid: Grid) {
  return legalMoves(grid)[0] ?? "left";
}
