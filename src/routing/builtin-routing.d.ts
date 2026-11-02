import type { RoadGraph, RouteAlgorithm, RouteResult } from "./types";
export function searchGraph(
  graph: RoadGraph,
  start: number,
  target: number,
  algorithm: RouteAlgorithm,
): RouteResult;
