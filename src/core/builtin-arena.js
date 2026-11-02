const DIRECTIONS = ["up", "right", "down", "left"];
export function neighbor(position, direction, width, height) {
  const x = position % width,
    y = Math.floor(position / width);
  if (direction === "up") return y > 0 ? position - width : -1;
  if (direction === "down") return y < height - 1 ? position + width : -1;
  if (direction === "left") return x > 0 ? position - 1 : -1;
  return x < width - 1 ? position + 1 : -1;
}
export function legalMoves(player, board, arena) {
  return DIRECTIONS.filter((d) => {
    const i = neighbor(player.position, d, arena.width, arena.height);
    return i >= 0 && board[i] === -1;
  });
}
export function chooseBuiltin(player, legal, board, arena, rng) {
  const facing = DIRECTIONS.indexOf(player.direction);
  const prioritize = (order) =>
    order
      .map((n) => DIRECTIONS[(facing + n) % 4])
      .find((d) => legal.includes(d));
  if (player.strategy === "random")
    return legal[Math.floor(rng() * legal.length)];
  if (player.strategy === "right" || player.strategy === "left") {
    const order = player.strategy === "right" ? [1, 0, 3, 2] : [3, 0, 1, 2];
    return prioritize(order);
  }
  if (player.strategy === "straight") return prioritize([0, 1, 3, 2]);
  if (player.strategy === "zigzag")
    return prioritize([
      player.score % 2 ? 1 : 3,
      0,
      player.score % 2 ? 3 : 1,
      2,
    ]);
  if (player.strategy === "serpentine") {
    const row = Math.floor(player.position / arena.width);
    const horizontal = row % 2 === player.id % 2 ? "right" : "left";
    return [
      horizontal,
      "down",
      "up",
      horizontal === "right" ? "left" : "right",
    ].find((d) => legal.includes(d));
  }
  if (player.strategy === "spiral") {
    // Leg lengths 1,1,2,2,3,3,..., with a quarter-turn between legs.
    const t = Math.max(0, player.score - 1);
    // Locate the current leg in O(1), then adapt to collisions with turn priorities.
    const k = Math.floor((Math.sqrt(4 * t + 1) - 1) / 2);
    const leg = 2 * k + (t - k * (k + 1) >= k + 1 ? 1 : 0);
    const preferred = DIRECTIONS[(player.id + leg) % 4];
    return legal.includes(preferred) ? preferred : prioritize([1, 0, 3, 2]);
  }
  if (player.strategy === "edge" || player.strategy === "invasion") {
    let best = legal[0],
      bestValue = -Infinity;
    for (const d of legal) {
      const cell = neighbor(player.position, d, arena.width, arena.height);
      let boundary = 0,
        opponents = 0;
      for (const next of DIRECTIONS) {
        const n = neighbor(cell, next, arena.width, arena.height);
        if (n < 0 || board[n] !== -1) boundary++;
        if (n >= 0 && board[n] >= 0 && board[n] !== player.id) opponents++;
      }
      // Invasion looks along bounded rays, without scanning the whole board.
      if (player.strategy === "invasion")
        for (const ray of DIRECTIONS) {
          let n = cell;
          for (let distance = 1; distance <= 12; distance++) {
            n = neighbor(n, ray, arena.width, arena.height);
            if (n < 0 || board[n] === -2) break;
            if (board[n] >= 0 && board[n] !== player.id) {
              opponents += (13 - distance) / 12;
              break;
            }
          }
        }
      const value =
        player.strategy === "edge"
          ? boundary * 10 + (d === player.direction ? 1 : 0) + rng() * 0.1
          : opponents * 20 -
            boundary +
            (d === player.direction ? 0.5 : 0) +
            rng() * 0.1;
      if (value > bestValue) {
        best = d;
        bestValue = value;
      }
    }
    return best;
  }
  // Bounded local reachability: at most 40 cells per option, never a full flood fill.
  let best = legal[0],
    bestValue = -Infinity;
  for (const d of legal) {
    const start = neighbor(player.position, d, arena.width, arena.height);
    const queue = [start],
      seen = new Set([start]);
    let cursor = 0,
      degree = 0;
    while (cursor < queue.length && seen.size < 40) {
      const cell = queue[cursor++];
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
