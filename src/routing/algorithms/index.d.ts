import type { RoadGraph, RouteAlgorithm } from "../types";
import type { createQueue } from "../queue";
export interface SearchGraph extends Pick<
  RoadGraph,
  "nodes" | "arcs" | "incoming" | "outgoing"
> {
  start: number;
  target: number;
  nodeCount: number;
  createQueue: typeof createQueue;
  heuristic(node: number): number;
  trace(node: number, edge?: number, side?: number): void;
}
export const algorithms: Record<
  RouteAlgorithm,
  (graph: SearchGraph) => { path: number[] | null }
>;
