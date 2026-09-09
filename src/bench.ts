/**
 * Quick AI benchmark. `npm run bench -- 30` plays 30 games with the expectimax
 * player and prints the win rate, average score and best-tile distribution.
 */

import { newGame, move, maxTile, type GameState } from "./game.js";
import { bestMove } from "./ai.js";

const games = Math.max(1, Math.trunc(Number(process.argv[2] ?? 20)));
const target = 2048;

const tally = new Map<number, number>();
let wins = 0;
let totalScore = 0;
let totalMoves = 0;
const started = Date.now();

for (let g = 0; g < games; g++) {
  let state: GameState = newGame({ target, seed: (g + 1) * 2654435761 });
  for (;;) {
    const dir = bestMove(state.grid);
    if (!dir) break;
    const res = move(state, dir);
    if (!res.changed) break;
    state = res.state;
  }
  const top = maxTile(state.grid);
  tally.set(top, (tally.get(top) ?? 0) + 1);
  totalScore += state.score;
  totalMoves += state.moves;
  if (top >= target) wins++;
  process.stdout.write(
    `game ${String(g + 1).padStart(3)}  score ${String(state.score).padStart(7)}  max ${String(top).padStart(5)}\n`,
  );
}

const dist = [...tally.entries()]
  .sort((a, b) => a[0] - b[0])
  .map(([tile, n]) => `${tile}×${n}`)
  .join("  ");

process.stdout.write(
  `\n${games} games in ${((Date.now() - started) / 1000).toFixed(1)}s\n` +
    `reached ${target}: ${wins}/${games} (${((wins / games) * 100).toFixed(0)}%)\n` +
    `avg score ${Math.round(totalScore / games)} · avg moves ${Math.round(totalMoves / games)}\n` +
    `best tile: ${dist}\n`,
);
