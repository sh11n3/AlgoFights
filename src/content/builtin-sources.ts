import arenaSource from "../core/builtin-arena.js?raw";
import routingSource from "../routing/builtin-routing.js?raw";
import { LABELS } from "../core/types";
import { ROUTE_ALGORITHMS } from "../routing/types";

// The readable source is the same module used by the built-in implementations.
const editable = (source: string) => source.replace(/^export /gm, "");
export const ARENA_SOURCES = Object.entries(LABELS).map(([id, name]) => ({
  id,
  name,
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

export const ROUTING_SOURCES = Object.entries(ROUTE_ALGORITHMS).map(
  ([id, info]) => ({
    id,
    name: info.name,
    code: `// Original: ${info.name}. Alle Hilfsfunktionen sind mit enthalten.
// Wähle unten in searchGraph eigene Prioritäten, Abbruchregeln oder Datenstrukturen.
function findRoute(graph) {
  return searchGraph(graph, graph.start, graph.target, ${JSON.stringify(id)});
}

${editable(routingSource)}`,
  }),
);
export const ROUTING_TEMPLATE = `// Breitensuche: zuerst Wege mit wenigen Kanten untersuchen.
function findRoute(graph) {
  const queue = [graph.start];
  const seen = new Set(queue);
  const previous = new Map();
  for (let i = 0; i < queue.length; i++) {
    const node = queue[i];
    graph.trace(node, previous.get(node) ?? -1);
    if (node === graph.target) {
      const path = [];
      for (let v = node; v !== graph.start;) {
        const edge = previous.get(v);
        path.push(edge);
        v = graph.arcs[edge].from;
      }
      return { path: path.reverse() };
    }
    for (const edge of graph.outgoing[node]) {
      const next = graph.arcs[edge].to;
      if (seen.has(next)) continue;
      seen.add(next);
      previous.set(next, edge);
      queue.push(next);
    }
  }
  return { path: null };
}`;
