import arenaSource from "../core/builtin-arena.js?raw";
import dijkstraSource from "../routing/algorithms/dijkstra.js?raw";
import astarSource from "../routing/algorithms/astar.js?raw";
import bidirectionalSource from "../routing/algorithms/bidirectional.js?raw";
import bfsSource from "../routing/algorithms/bfs.js?raw";
import dfsSource from "../routing/algorithms/dfs.js?raw";
import greedySource from "../routing/algorithms/greedy.js?raw";
import { LABELS } from "../core/types";
import { ROUTE_ALGORITHMS, type RouteAlgorithm } from "../routing/types";
import { arenaReference } from "./arena-references";
import { routeReference } from "./route-references";

// The readable source is the same module used by the built-in implementations.
const editable = (source: string) => source.replace(/^export /gm, "");
export const ARENA_SOURCES = Object.entries(LABELS).map(([id, name]) => ({
  id,
  name,
  ...arenaReference(id),
  code: `// Original: ${name}. Ändere die Prioritäten oder die Bewertung unten.
// Der Adapter übersetzt die Editor-API in die gemeinsame Implementierung.
function nextMove(state, memory) {
  const cache = new Map();
  const board = new Proxy({}, {
    get(_, key) {
      const index = Number(key);
      if (!Number.isInteger(index)) return undefined;
      if (!cache.has(index)) {
        const type = state.cell(index % state.width, Math.floor(index / state.width));
        cache.set(index, type === "free" ? -1 : type === "wall" ? -2
          : type === "self" ? state.id : (state.id + 1) % 4);
      }
      return cache.get(index);
    }
  });
  const player = { id: state.id, position: state.y * state.width + state.x,
    direction: state.direction, score: state.score, strategy: ${JSON.stringify(id)} };
  const arena = { width: state.width, height: state.height };
  return { direction: chooseBuiltin(player, state.availableMoves, board, arena, state.random), memory };
}

${editable(arenaSource)}`,
}));

const routeSources = {
  dijkstra: dijkstraSource,
  astar: astarSource,
  bidirectional: bidirectionalSource,
  bfs: bfsSource,
  dfs: dfsSource,
  greedy: greedySource,
};
export const ROUTING_SOURCES = Object.entries(ROUTE_ALGORITHMS).map(
  ([id, info]) => ({
    id,
    name: info.name,
    ...routeReference(id as RouteAlgorithm),
    code: routeSources[id as keyof typeof routeSources].replace(
      /^export default /m,
      "",
    ),
  }),
);
export const ROUTING_TEMPLATE = "";
