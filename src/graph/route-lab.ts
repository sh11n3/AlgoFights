import type { LabResult } from "../lab/types";
import type { RouteAlgorithm } from "../routing/types";
import {
  GRAPH_ALGORITHMS,
  type graphResult,
  type TeachingGraph,
} from "./simulation";

export const NEW_ROUTE = "route:new";
export const routeSelection = (id: string) => `route:${id}`;
export const routeChoices = Object.entries(GRAPH_ALGORITHMS).map(
  ([id, { name }]) => ({
    id: routeSelection(id as RouteAlgorithm),
    name: ["bfs", "dfs", "dijkstra"].includes(id)
      ? `${name} · Zielsuche`
      : name,
  }),
);

export function selectedRoute(value: string): RouteAlgorithm | undefined {
  const id = value.slice(6);
  if (value.startsWith("route:") && Object.hasOwn(GRAPH_ALGORITHMS, id))
    return id as RouteAlgorithm;
}

export type GraphRouteResult = ReturnType<typeof graphResult>;

export function routeReplay(
  graph: TeachingGraph,
  start: number,
  route: GraphRouteResult,
): LabResult {
  const label = (id: number) => graph.nodes[id].label;
  const frames: LabResult["frames"] = [
    { message: "Die Start–Ziel-Suche ist vorbereitet.", state: {} },
  ];
  route.traceNodes.forEach((current, index) => {
    const backward = route.traceSides[index] === 1;
    frames.push({
      message: `${backward ? "Rückwärtssuche" : "Suche"}: Knoten ${label(current)} wird untersucht.`,
      state: { current },
    });
  });
  const path = route.found
    ? [
        label(start),
        ...Array.from(route.path, (arc) => label(graph.arcs[arc].to)),
      ]
    : [];
  return {
    frames,
    limited: route.limited,
    milliseconds: route.milliseconds,
    result: route.found
      ? `Ziel erreicht: ${path.join(" → ")} · ${route.path.length} ${route.path.length === 1 ? "Kante" : "Kanten"} · Kosten: ${route.distance.toLocaleString("de-DE")}`
      : route.limited
        ? "Die Suche wurde vorzeitig beendet."
        : "Kein Weg vom Start zum Ziel gefunden.",
  };
}
