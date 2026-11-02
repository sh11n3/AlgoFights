import { TEMPLATE } from "../services/storage";
export const STRATEGY_EXAMPLES = [
  { name: "Seed-Zufall", code: TEMPLATE },
  {
    name: "Rechtsregel",
    code: `function nextMove(state, memory) {
  const directions = ["up", "right", "down", "left"];
  const facing = directions.indexOf(state.direction);
  for (const turn of [1, 0, 3, 2]) {
    const direction = directions[(facing + turn) % 4];
    if (state.availableMoves.includes(direction)) {
      return { direction, memory };
    }
  }
}`,
  },
  {
    name: "Geradeaus mit Gedächtnis",
    code: `function nextMove(state, memory) {
  // Nach einem Rücklauf einen neuen Plan beginnen.
  if (state.afterReturn) memory = {};
  const choices = state.availableMoves;
  const direction = choices.includes(state.direction)
    ? state.direction
    : choices[Math.floor(state.random() * choices.length)];
  return {
    direction,
    memory: { decisions: (memory.decisions || 0) + 1 }
  };
}`,
  },
  {
    name: "Begrenzte Freiraumsuche",
    code: `function nextMove(state, memory) {
  const offsets = { up: [0,-1], right: [1,0], down: [0,1], left: [-1,0] };
  function room(direction) {
    const [dx, dy] = offsets[direction];
    const queue = [[state.x + dx, state.y + dy]];
    const seen = new Set([queue[0].join(",")]);
    for (let i = 0; i < queue.length && seen.size < 28; i++) {
      const [x, y] = queue[i];
      for (const [a, b] of Object.values(offsets)) {
        const nx = x + a, ny = y + b, key = nx + "," + ny;
        if (seen.has(key) || state.cell(nx, ny) !== "free") continue;
        seen.add(key);
        queue.push([nx, ny]);
        if (seen.size >= 28) break;
      }
    }
    return seen.size;
  }
  let direction = state.availableMoves[0], best = -Infinity;
  for (const choice of state.availableMoves) {
    const score = room(choice) * 10
      + (choice === state.direction ? 0.5 : 0) + state.random() * 0.1;
    if (score > best) { best = score; direction = choice; }
  }
  return { direction, memory };
}`,
  },
];
