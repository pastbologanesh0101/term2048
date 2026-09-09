export {
  newGame,
  move,
  slide,
  collapseRow,
  canMove,
  isWin,
  keepPlaying,
  legalMoves,
  emptyCells,
  gridEquals,
  maxTile,
  spawnTile,
  nextRandom,
  DIRECTIONS,
} from "./game.js";
export type {
  Grid,
  Direction,
  GameState,
  GameStatus,
  MoveResult,
  Spawn,
  NewGameOptions,
} from "./game.js";

export { bestMove, heuristic } from "./ai.js";
export type { AiOptions } from "./ai.js";

export { render } from "./render.js";
export type { RenderOptions } from "./render.js";
