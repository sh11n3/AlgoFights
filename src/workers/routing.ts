import { buildGraph } from "../routing/graph";
import { findRoute } from "../routing/search";
import { validateRouteOutput } from "../routing/custom";
import {
  ROUTE_ALGORITHMS,
  type CitySnapshot,
  type RoadGraph,
  type RouteAlgorithm,
} from "../routing/types";
const scope = self as unknown as DedicatedWorkerGlobalScope;
let graph: RoadGraph | null = null;
scope.onmessage = async ({ data }) => {
  try {
    if (data.type === "load") {
      const response = await fetch(data.url);
      if (!response.ok)
        throw new Error(
          `Kartendaten konnten nicht geladen werden (${response.status}).`,
        );
      graph = buildGraph((await response.json()) as CitySnapshot);
      scope.postMessage({ type: "loaded", graph });
    } else if (data.type === "validate-custom") {
      if (!graph) throw new Error("Bitte zuerst eine Karte laden.");
      const result = validateRouteOutput(
        graph,
        data.start,
        data.target,
        data.output,
      );
      scope.postMessage({ type: "result", id: data.id, result });
    } else if (data.type === "route") {
      if (!graph) throw new Error("Bitte zuerst eine Karte laden.");
      const result = findRoute(graph, data.start, data.target, data.algorithm);
      scope.postMessage({ type: "result", id: data.id, result }, [
        result.traceNodes.buffer,
        result.traceEdges.buffer,
        result.traceSides.buffer,
        result.path.buffer,
      ]);
    } else if (data.type === "compare") {
      if (!graph) throw new Error("Bitte zuerst eine Karte laden.");
      const rows = Object.keys(ROUTE_ALGORITHMS).map((algorithm) => {
        const r = findRoute(
          graph!,
          data.start,
          data.target,
          algorithm as RouteAlgorithm,
        );
        return {
          algorithm,
          found: r.found,
          distance: r.distance,
          expanded: r.traceNodes.length,
          milliseconds: r.milliseconds,
        };
      });
      scope.postMessage({ type: "comparison", id: data.id, rows });
    }
  } catch (e) {
    scope.postMessage({
      type: "error",
      id: data.id,
      error: e instanceof Error ? e.message : String(e),
    });
  }
};
