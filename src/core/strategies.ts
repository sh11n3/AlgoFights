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
export function chooseBuiltin(
  player: Player,
  legal: Direction[],
  board: Int8Array,
  arena: Arena,
  rng: () => number,
): Direction {
  const facing = DIRECTIONS.indexOf(player.direction);
  if (player.strategy === "random")
    return legal[Math.floor(rng() * legal.length)]!;
  if (player.strategy === "right" || player.strategy === "left") {
    const order = player.strategy === "right" ? [1, 0, 3, 2] : [3, 0, 1, 2];
    return order
      .map((n) => DIRECTIONS[(facing + n) % 4]!)
      .find((d) => legal.includes(d))!;
  }
  // Bounded local reachability: at most 40 cells per option, never a full flood fill.
  let best = legal[0]!,
    bestValue = -Infinity;
  for (const d of legal) {
    const start = neighbor(player.position, d, arena.width, arena.height);
    const queue = [start],
      seen = new Set([start]);
    let cursor = 0,
      degree = 0;
    while (cursor < queue.length && seen.size < 40) {
      const cell = queue[cursor++]!;
      for (const next of DIRECTIONS) {
        const n = neighbor(cell, next, arena.width, arena.height);
        if (n >= 0 && board[n] === -1 && !seen.has(n)) {
          seen.add(n);
          queue.push(n);
          if (cursor === 1) degree++;
        }
        if (seen.size >= 40) break;
      }
    }
    const value =
      seen.size * 10 +
      degree * 2 +
      (d === player.direction ? 1 : 0) +
      rng() * 0.1;
    if (value > bestValue) {
      bestValue = value;
      best = d;
    }
  }
  return best;
}
