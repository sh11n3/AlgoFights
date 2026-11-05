import { algorithms } from "../routing/algorithms/index.js";
import { createQueue } from "../routing/queue.js";
import { validateRouteOutput, type RouteOutput } from "../routing/custom";
import type { Arc, RouteAlgorithm } from "../routing/types";
import type { GraphPreset } from "./presets";
import { createArrayTrace } from "./array-trace.js";

export const GRAPH_ALGORITHMS = {
  dijkstra: {
    name: "Dijkstra",
    description:
      "Expandiert nach bisher bekannten Kosten und minimiert die Gesamtkosten.",
  },
  astar: {
    name: "A*",
    description:
      "Priorisiert bisherige Kosten plus eine untere Schranke für die Restkosten.",
  },
  bfs: {
    name: "Breitensuche (BFS)",
    description:
      "Besucht Knoten schichtweise und findet einen Weg mit möglichst wenigen Kanten.",
  },
  dfs: {
    name: "Tiefensuche (DFS)",
    description:
      "Erkundet zuerst einen Zweig bis in die Tiefe. Der gefundene Weg kann länger sein.",
  },
  bidirectional: {
    name: "Bidirektionaler Dijkstra",
    description:
      "Sucht vom Start vorwärts und vom Ziel über eingehende Kanten rückwärts.",
  },
  greedy: {
    name: "Greedy Best-First",
    description:
      "Bevorzugt die kleinste geschätzte Restdistanz. Der gefundene Weg kann teurer sein.",
  },
} satisfies Record<RouteAlgorithm, { name: string; description: string }>;

export function createGraph(
  preset: GraphPreset,
  weighted: boolean,
  directed: boolean,
) {
  const nodes = preset.points.map(([x, y], id) => ({
    id,
    x,
    y,
    label:
      id < 26
        ? String.fromCharCode(65 + id)
        : `A${String.fromCharCode(65 + id - 26)}`,
  }));
  const outgoing: number[][] = nodes.map(() => []);
  const incoming: number[][] = nodes.map(() => []);
  const arcs: Arc[] = [];
  function addArc(from: number, to: number, length: number, segment: number) {
    outgoing[from].push(arcs.length);
    incoming[to].push(arcs.length);
    arcs.push({ from, to, length, segment });
  }
  preset.edges.forEach(([from, to, cost], segment) => {
    const length = weighted ? cost : 1;
    addArc(from, to, length, segment);
    if (!directed) addArc(to, from, length, segment);
  });
  return { nodes, arcs, outgoing, incoming };
}
export type TeachingGraph = ReturnType<typeof createGraph>;

// This scale makes the Euclidean estimate consistent on every arc by the triangle inequality.
export function graphHeuristic(graph: TeachingGraph, target: number) {
  const distance = (a: number, b: number) =>
    Math.hypot(
      graph.nodes[a].x - graph.nodes[b].x,
      graph.nodes[a].y - graph.nodes[b].y,
    );
  const scale = Math.min(
    ...graph.arcs.map(({ from, to, length }) => length / distance(from, to)),
  );
  return graph.nodes.map((node) =>
    Number.isFinite(scale) ? distance(node.id, target) * scale : 0,
  );
}

export function searchTeachingGraph(
  graph: TeachingGraph,
  start: number,
  target: number,
  algorithm: RouteAlgorithm,
  stepLimit: number,
  heuristic = graphHeuristic(graph, target),
  trackArrays = false,
): RouteOutput {
  const traceNodes: number[] = [],
    traceEdges: number[] = [],
    traceSides: number[] = [];
  const stop = {};
  let limited = false,
    path: number[] | null = null;
  const begin = performance.now();
  const arrays = trackArrays
    ? createArrayTrace(graph.nodes.length, graph.arcs)
    : undefined;
  try {
    ({ path } = algorithms[algorithm]({
      ...graph,
      start,
      target,
      nodeCount: graph.nodes.length,
      createQueue,
      heuristic: (node) => heuristic[node],
      track: arrays?.track,
      trace(node, edge = -1, side = 0) {
        if (traceNodes.length >= stepLimit) throw stop;
        arrays?.capture();
        traceNodes.push(node);
        traceEdges.push(edge);
        traceSides.push(side);
      },
    }));
  } catch (error) {
    if (error !== stop) throw error;
    limited = true;
  }
  arrays?.capture();
  return {
    path,
    limited,
    traceNodes,
    traceEdges,
    traceSides,
    arrayFrames: arrays?.frames,
    milliseconds: performance.now() - begin,
  };
}

export function graphResult(
  graph: TeachingGraph,
  start: number,
  target: number,
  output: RouteOutput,
) {
  return {
    ...validateRouteOutput(graph, start, target, output),
    limited: output.limited === true,
    arrayFrames: output.arrayFrames,
  };
}
