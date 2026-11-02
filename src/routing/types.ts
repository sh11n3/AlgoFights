export interface OsmElement {
  type: string;
  id: number;
  lat?: number;
  lon?: number;
  nodes?: number[];
  tags?: Record<string, string>;
}
export interface CitySnapshot {
  id: string;
  name: string;
  bbox: number[];
  center: number[];
  downloadedAt: string;
  osmTimestamp: string;
  elements: OsmElement[];
}
export interface RoadNode {
  id: number;
  lat: number;
  lon: number;
  x: number;
  y: number;
  street: string;
}
export interface Segment {
  a: number;
  b: number;
  length: number;
  name: string;
  kind: string;
  oneway: number;
}
export interface Arc {
  from: number;
  to: number;
  length: number;
  segment: number;
}
export interface RoadGraph {
  id: string;
  name: string;
  bbox: number[];
  center: number[];
  downloadedAt: string;
  osmTimestamp: string;
  nodes: RoadNode[];
  segments: Segment[];
  arcs: Arc[];
  outgoing: number[][];
  incoming: number[][];
  areas: Array<{ kind: string; points: number[][] }>;
  labels: Array<{ name: string; x: number; y: number }>;
  places: Array<{ name: string; node: number }>;
}
export type RouteAlgorithm =
  "dijkstra" | "astar" | "bidirectional" | "bfs" | "dfs" | "greedy";
export interface RouteResult {
  algorithm: RouteAlgorithm | "custom";
  found: boolean;
  distance: number;
  traceNodes: Uint32Array;
  traceEdges: Int32Array;
  traceSides: Uint8Array;
  path: Uint32Array;
  milliseconds: number;
}
export const ROUTE_ALGORITHMS: Record<
  RouteAlgorithm,
  { name: string; description: string; guarantee: string }
> = {
  dijkstra: {
    name: "Dijkstra",
    description:
      "Erweitert den Knoten mit der kleinsten bisher bekannten Entfernung g(n).",
    guarantee: "Kürzeste Strecke bei nichtnegativen Kantenlängen.",
  },
  astar: {
    name: "A*",
    description:
      "Priorität f(n) = g(n) + h(n). h(n) ist die Luftlinie zum Ziel.",
    guarantee:
      "Kürzeste Strecke: Die Luftlinie überschätzt die Straßenlänge nicht.",
  },
  bidirectional: {
    name: "Bidirektionaler Dijkstra",
    description:
      "Sucht vom Start vorwärts und vom Ziel auf dem umgekehrten Graphen. Stoppt erst, wenn keine bessere Verbindung mehr möglich ist.",
    guarantee:
      "Kürzeste Strecke; berücksichtigt gerichtete Straßen in beiden Suchen.",
  },
  bfs: {
    name: "Breitensuche (BFS)",
    description: "Besucht Knoten schichtweise mit einer FIFO-Warteschlange.",
    guarantee:
      "Wenigste Kanten, aber nicht zwingend die kürzeste Strecke in Metern.",
  },
  dfs: {
    name: "Tiefensuche (DFS)",
    description: "Verfolgt einen Zweig möglichst weit und kehrt dann zurück.",
    guarantee: "Findet einen erreichbaren Weg, ohne Optimalitätsgarantie.",
  },
  greedy: {
    name: "Greedy Best-First",
    description:
      "Wählt nur nach Luftlinie h(n). Die bereits gelaufene Entfernung wird nicht in der Priorität berücksichtigt.",
    guarantee: "Keine Garantie für die kürzeste Strecke.",
  },
};
