import {
  newGame,
  move,
  type GameState,
  type Direction,
} from "./game.js";
import { bestMove } from "./ai.js";
import { render } from "./render.js";
import { runTui } from "./tui.js";

const VERSION = "1.0.0";

const HELP = `term2048 ${VERSION} — 2048 in the terminal

USAGE
  term2048 [options]

OPTIONS
  --size <n>       board side length (default 4, min 2)
  --target <n>     winning tile (default 2048)
  --seed <n>       fixed RNG seed for a reproducible game
  --ai             start with the expectimax AI driving
  --depth <n>      force a fixed AI search depth
  --headless <n>   don't open the UI: let the AI play <n> games, print a summary
  -h, --help       show this help
  -v, --version    print the version

CONTROLS (in-game)
  arrows / wasd / hjkl   move          u  undo
  a                      toggle AI     r  restart
  space                  keep playing after a win
  q or Ctrl-C            quit
`;

function num(args: string[], flag: string): number | undefined {
  const i = args.indexOf(flag);
  if (i === -1) return undefined;
  const v = Number(args[i + 1]);
  if (!Number.isFinite(v)) {
    process.stderr.write(`term2048: ${flag} needs a number\n`);
    process.exit(2);
  }
  return v;
}

function headless(games: number, size: number, target: number, depth?: number): void {
  const maxTiles: number[] = [];
  let wins = 0;
  let totalScore = 0;

  for (let g = 0; g < games; g++) {
    let state: GameState = newGame({ size, target, seed: (g + 1) * 2654435761 });
    for (;;) {
      const dir: Direction | null = bestMove(state.grid, depth != null ? { depth } : {});
      if (!dir) break;
      const res = move(state, dir);
      if (!res.changed) break;
      state = res.state;
    }
    const top = Math.max(...state.grid.flat());
    maxTiles.push(top);
    totalScore += state.score;
    if (top >= target) wins++;
    process.stdout.write(
      `game ${String(g + 1).padStart(3)}  score ${String(state.score).padStart(7)}  max ${String(top).padStart(5)}  moves ${state.moves}\n`,
    );
  }

  const tally = new Map<number, number>();
  for (const t of maxTiles) tally.set(t, (tally.get(t) ?? 0) + 1);
  const dist = [...tally.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([tile, n]) => `${tile}×${n}`)
    .join("  ");

  process.stdout.write(
    `\n${games} games · reached ${target}: ${wins} (${((wins / games) * 100).toFixed(0)}%) · ` +
      `avg score ${Math.round(totalScore / games)}\nmax-tile distribution: ${dist}\n`,
  );
}

function main(argv: string[]): void {
  const args = argv.slice(2);
  if (args.includes("-h") || args.includes("--help")) {
    process.stdout.write(HELP);
    return;
  }
  if (args.includes("-v") || args.includes("--version")) {
    process.stdout.write(VERSION + "\n");
    return;
  }

  const size = Math.max(2, Math.trunc(num(args, "--size") ?? 4));
  const target = Math.trunc(num(args, "--target") ?? 2048);
  const seed = num(args, "--seed");
  const depth = num(args, "--depth");
  const games = num(args, "--headless");

  if (games != null) {
    headless(Math.max(1, Math.trunc(games)), size, target, depth);
    return;
  }

  if (!process.stdin.isTTY) {
    process.stderr.write(
      "term2048: no interactive terminal. Try `--headless 10` for an AI run,\n" +
        "or run it directly in your shell to play.\n",
    );
    process.exit(1);
  }

  runTui({ size, target, seed: seed != null ? seed | 0 : undefined, ai: args.includes("--ai") });
}

main(process.argv);

// re-export a tiny helper for snapshot tooling / docs
export { render };
