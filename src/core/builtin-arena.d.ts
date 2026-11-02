import type { Arena, Direction, Player } from "./types";
export function chooseBuiltin(
  player: Player,
  legal: Direction[],
  board: ArrayLike<number>,
  arena: Arena,
  rng: () => number,
): Direction;
