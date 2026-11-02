import { chooseBuiltin as portableChoose } from "./builtin-arena.js";
import { DIRECTIONS, type Arena, type Direction, type Player } from "./types";

export function neighbor(
  position: number,
  direction: Direction,
  width: number,
  height: number,
): number {
  const x = position % width,
    y = Math.floor(position / width);
  if (direction === "up") return y > 0 ? position - width : -1;
  if (direction === "down") return y < height - 1 ? position + width : -1;
  if (direction === "left") return x > 0 ? position - 1 : -1;
  return x < width - 1 ? position + 1 : -1;
}
export function legalMoves(
  player: Player,
  board: Int8Array,
  arena: Arena,
): Direction[] {
  return DIRECTIONS.filter((d) => {
    const i = neighbor(player.position, d, arena.width, arena.height);
    return i >= 0 && board[i] === -1;
  });
}
export const chooseBuiltin = portableChoose;
