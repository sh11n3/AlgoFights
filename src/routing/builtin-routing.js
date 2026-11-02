import { algorithms } from "./algorithms/index.js";
import { createQueue } from "./queue.js";
import { distance } from "./graph";

// The editor loads each of these algorithm modules verbatim, without this adapter.
export function searchGraph(graph, start, target, algorithm) {
  if (
    !Number.isInteger(start) ||
    !Number.isInteger(target) ||
    !graph.nodes[start] ||
    !graph.nodes[target]
  )
    throw new Error("Start und Ziel müssen gültige Straßenknoten sein.");
  if (!algorithms[algorithm]) throw new Error("Unbekannter Routenalgorithmus.");
  const begin = performance.now(),
    nodes = [],
    edges = [],
    sides = [];
  const result = algorithms[algorithm]({
    nodes: graph.nodes,
    arcs: graph.arcs,
    outgoing: graph.outgoing,
    incoming: graph.incoming,
    start,
    target,
    nodeCount: graph.nodes.length,
    createQueue,
    heuristic: (node) => distance(graph.nodes[node], graph.nodes[target]),
    trace(node, edge = -1, side = 0) {
      nodes.push(node);
      edges.push(edge);
      sides.push(side);
    },
  });
  const found = result.path !== null,
    path = result.path ?? [];
  return {
    algorithm,
    found,
    distance: found
      ? path.reduce((sum, e) => sum + graph.arcs[e].length, 0)
      : Infinity,
    traceNodes: Uint32Array.from(nodes),
    traceEdges: Int32Array.from(edges),
    traceSides: Uint8Array.from(sides),
    path: Uint32Array.from(path),
    milliseconds: performance.now() - begin,
  };
}
