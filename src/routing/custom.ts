import type { SearchNetwork, RouteResult } from "./types";

export interface RouteOutput {
  path: number[] | Uint32Array | null;
  traceNodes: number[] | Uint32Array;
  traceEdges: number[] | Int32Array;
  traceSides: number[] | Uint8Array;
  milliseconds: number;
  limited?: boolean;
}
export function validateRouteOutput(
  graph: SearchNetwork,
  start: number,
  target: number,
  raw: RouteOutput,
): RouteResult {
  if (!graph.nodes[start] || !graph.nodes[target])
    throw new Error("Ungültige Endpunkte.");
  if (
    !raw ||
    !(
      raw.path === null ||
      Array.isArray(raw.path) ||
      raw.path instanceof Uint32Array
    )
  )
    throw new Error(
      "Erwartet wird { path: [Kanten-IDs] } oder { path: null }.",
    );
  if (
    (raw.path?.length ?? 0) > 250000 ||
    !raw.traceNodes ||
    raw.traceNodes.length > 250000 ||
    raw.traceNodes.length !== raw.traceEdges?.length ||
    raw.traceNodes.length !== raw.traceSides?.length
  )
    throw new Error("Ungültiges Suchprotokoll oder mehr als 250.000 Einträge.");
  for (let i = 0; i < raw.traceNodes.length; i++) {
    const node = raw.traceNodes[i]!,
      edge = raw.traceEdges[i]!,
      side = raw.traceSides[i]!;
    if (
      !Number.isInteger(node) ||
      !graph.nodes[node] ||
      (side !== 0 && side !== 1)
    )
      throw new Error(`Ungültiger Suchknoten bei Eintrag ${i}.`);
    if (
      edge !== -1 &&
      (!Number.isInteger(edge) ||
        !graph.arcs[edge] ||
        (side ? graph.arcs[edge]!.from : graph.arcs[edge]!.to) !== node)
    )
      throw new Error(
        `Suchkante bei Eintrag ${i} passt nicht zum Knoten oder zur Suchrichtung.`,
      );
  }
  let current = start,
    distance = 0;
  for (const edge of raw.path ?? []) {
    const arc = graph.arcs[edge];
    if (!Number.isInteger(edge) || !arc || arc.from !== current)
      throw new Error(
        `Die Route enthält eine unverbundene oder falsch gerichtete Kante (${edge}).`,
      );
    current = arc.to;
    distance += arc.length;
  }
  if (raw.path !== null && current !== target)
    throw new Error("Die zurückgegebene Route erreicht das Ziel nicht.");
  return {
    algorithm: "custom",
    found: raw.path !== null,
    distance: raw.path !== null ? distance : Infinity,
    path: Uint32Array.from(raw.path ?? []),
    traceNodes: Uint32Array.from(raw.traceNodes),
    traceEdges: Int32Array.from(raw.traceEdges),
    traceSides: Uint8Array.from(raw.traceSides),
    milliseconds: Number.isFinite(raw.milliseconds)
      ? Math.max(0, raw.milliseconds)
      : 0,
  };
}
