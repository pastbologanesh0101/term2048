// Dev-only: render a mid-game board to docs/screenshot.svg for the README.
// Run with: node --import tsx scripts/screenshot.mjs

import { writeFileSync, mkdirSync } from "node:fs";
import { newGame, move, maxTile } from "../src/game.ts";
import { bestMove } from "../src/ai.ts";

// Play a seeded game until there's a satisfying board to show.
let s = newGame({ seed: 2024 });
for (let i = 0; i < 4000; i++) {
  const dir = bestMove(s.grid);
  if (!dir) break;
  s = move(s, dir).state;
  // stop on a full-looking board that already has a 2048
  if (maxTile(s.grid) >= 2048 && s.grid.flat().filter((v) => v === 0).length <= 6) break;
}

const PALETTE = {
  0: ["#cdc1b4", "#cdc1b4"],
  2: ["#eee4da", "#776e65"],
  4: ["#ede0c8", "#776e65"],
  8: ["#f2b179", "#f9f6f2"],
  16: ["#f59563", "#f9f6f2"],
  32: ["#f67c5f", "#f9f6f2"],
  64: ["#f65e3b", "#f9f6f2"],
  128: ["#edcf72", "#f9f6f2"],
  256: ["#edcc61", "#f9f6f2"],
  512: ["#edc850", "#f9f6f2"],
  1024: ["#edc53f", "#f9f6f2"],
  2048: ["#edc22e", "#f9f6f2"],
};
const big = ["#3c3a32", "#f9f6f2"];

const N = s.size;
const PAD = 24;
const GAP = 10;
const TILE = 78;
const TOP = 108;
const boardPx = N * TILE + (N + 1) * GAP;
const W = boardPx + PAD * 2 + 64;
const H = TOP + boardPx + 64;

const parts = [];
parts.push(
  `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="ui-monospace, SFMono-Regular, Menlo, monospace">`,
);
parts.push(`<rect width="${W}" height="${H}" rx="12" fill="#1c1c1e"/>`);
// title bar dots
parts.push(`<circle cx="24" cy="24" r="6" fill="#ff5f57"/>`);
parts.push(`<circle cx="44" cy="24" r="6" fill="#febc2e"/>`);
parts.push(`<circle cx="64" cy="24" r="6" fill="#28c840"/>`);
parts.push(
  `<text x="${W / 2}" y="28" fill="#8a8a8e" font-size="13" text-anchor="middle">term2048</text>`,
);
// header
parts.push(`<text x="${PAD}" y="64" fill="#f2f2f7" font-size="22" font-weight="700">2048 <tspan fill="#6c6c70" font-weight="400">· terminal · [AI]</tspan></text>`);
parts.push(`<text x="${PAD}" y="90" fill="#8a8a8e" font-size="15">score ${s.score}    best ${s.score}    moves ${s.moves}</text>`);
// board bed
parts.push(`<rect x="${PAD}" y="${TOP}" width="${boardPx}" height="${boardPx}" rx="10" fill="#2c2c2e"/>`);

for (let r = 0; r < N; r++) {
  for (let c = 0; c < N; c++) {
    const v = s.grid[r][c];
    const [bg, fg] = PALETTE[v] ?? big;
    const x = PAD + GAP + c * (TILE + GAP);
    const y = TOP + GAP + r * (TILE + GAP);
    parts.push(`<rect x="${x}" y="${y}" width="${TILE}" height="${TILE}" rx="7" fill="${bg}"${v === 0 ? ' fill-opacity="0.35"' : ""}/>`);
    if (v !== 0) {
      const size = v < 100 ? 34 : v < 1000 ? 28 : 22;
      parts.push(
        `<text x="${x + TILE / 2}" y="${y + TILE / 2}" fill="${fg}" font-size="${size}" font-weight="700" text-anchor="middle" dominant-baseline="central">${v}</text>`,
      );
    }
  }
}
parts.push(
  `<text x="${PAD}" y="${TOP + boardPx + 34}" fill="#6c6c70" font-size="12">wasd / arrows move · u undo · r restart · a AI · q quit</text>`,
);
parts.push(`</svg>`);

mkdirSync(new URL("../docs/", import.meta.url), { recursive: true });
writeFileSync(new URL("../docs/screenshot.svg", import.meta.url), parts.join("\n"));
console.log(`wrote docs/screenshot.svg  (max tile ${maxTile(s.grid)}, score ${s.score})`);
