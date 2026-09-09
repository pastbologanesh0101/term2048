/**
 * Turn a {@link GameState} into a printable string. 24-bit colour when the
 * terminal allows it, plain boxes otherwise (`NO_COLOR` / non-TTY).
 */

import type { GameState } from "./game.js";

const CELL_WIDTH = 6;

const colorsEnabled =
  !process.env["NO_COLOR"] && process.stdout.isTTY !== false;

/** foreground + background rgb for each tile value */
const TILE_RGB: Record<number, [fg: string, bg: string]> = {
  0: ["238;228;218", "205;193;180"],
  2: ["119;110;101", "238;228;218"],
  4: ["119;110;101", "237;224;200"],
  8: ["249;246;242", "242;177;121"],
  16: ["249;246;242", "245;149;99"],
  32: ["249;246;242", "246;124;95"],
  64: ["249;246;242", "246;94;59"],
  128: ["249;246;242", "237;207;114"],
  256: ["249;246;242", "237;204;97"],
  512: ["249;246;242", "237;200;80"],
  1024: ["249;246;242", "237;197;63"],
  2048: ["249;246;242", "237;194;46"],
};
const BIG: [string, string] = ["249;246;242", "60;58;50"];

function paint(value: number): string {
  const label = value === 0 ? "" : String(value);
  const cell = label.padStart(Math.ceil((CELL_WIDTH + label.length) / 2)).padEnd(CELL_WIDTH);
  if (!colorsEnabled) return cell;
  const [fg, bg] = TILE_RGB[value] ?? BIG;
  return `\x1b[38;2;${fg}m\x1b[48;2;${bg}m${cell}\x1b[0m`;
}

const dim = (s: string): string => (colorsEnabled ? `\x1b[2m${s}\x1b[0m` : s);
const bold = (s: string): string => (colorsEnabled ? `\x1b[1m${s}\x1b[0m` : s);

export interface RenderOptions {
  best?: number;
  ai?: boolean;
  /** Extra line under the board (e.g. "New game — seed 42"). */
  note?: string;
}

export function render(state: GameState, opts: RenderOptions = {}): string {
  const { grid, size } = state;
  const inner = "─".repeat(CELL_WIDTH);
  const top = `┌${Array(size).fill(inner).join("┬")}┐`;
  const mid = `├${Array(size).fill(inner).join("┼")}┤`;
  const bot = `└${Array(size).fill(inner).join("┴")}┘`;

  const lines: string[] = [];
  lines.push(
    `${bold("2048")} ${dim("· terminal")}${opts.ai ? "  " + bold("[AI]") : ""}`,
  );
  lines.push(
    `${dim("score")} ${String(state.score).padEnd(8)}${
      opts.best != null ? dim("best ") + String(Math.max(opts.best, state.score)) : ""
    }`,
  );
  lines.push("");
  lines.push(top);
  grid.forEach((row, r) => {
    lines.push("│" + row.map(paint).join("│") + "│");
    if (r < size - 1) lines.push(mid);
  });
  lines.push(bot);
  lines.push("");

  if (state.status === "won") {
    lines.push(bold(`  you hit ${state.target}!  `) + dim("space keeps going · r restarts"));
  } else if (state.status === "lost") {
    lines.push(bold("  no moves left  ") + dim("· r restarts"));
  } else {
    lines.push(
      dim("←↑→↓/wasd move · u undo · r restart · a AI · q quit"),
    );
  }
  if (opts.note) lines.push(dim("  " + opts.note));

  return lines.join("\n");
}
