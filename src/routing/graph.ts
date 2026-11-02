import type { CitySnapshot, RoadGraph, OsmElement } from "./types";
export function distance(
  a: { lat: number; lon: number },
  b: { lat: number; lon: number },
): number {
  const r = Math.PI / 180,
    dy = (b.lat - a.lat) * r,
    dx = (b.lon - a.lon) * r;
  const h =
    Math.sin(dy / 2) ** 2 +
    Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dx / 2) ** 2;
  return (
    6371008.8 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(Math.max(0, 1 - h)))
  );
}
export function project(lat: number, lon: number, center: number[]): number[] {
  return [
    (lon - center[1]!) * Math.cos((center[0]! * Math.PI) / 180) * 111195,
    -(lat - center[0]!) * 111195,
  ];
}
export function buildGraph(snapshot: CitySnapshot): RoadGraph {
  const graph: RoadGraph = {
    ...snapshot,
    nodes: [],
    segments: [],
    arcs: [],
    outgoing: [],
    incoming: [],
    areas: [],
    labels: [],
    places: [],
  };
  delete (graph as RoadGraph & { elements?: unknown }).elements;
  const raw = new Map<number, OsmElement>();
  for (const e of snapshot.elements) if (e.type === "node") raw.set(e.id, e);
  const indices = new Map<number, number>();
  const inside = (n: OsmElement) =>
    n.lat! >= snapshot.bbox[0]! &&
    n.lat! <= snapshot.bbox[2]! &&
    n.lon! >= snapshot.bbox[1]! &&
    n.lon! <= snapshot.bbox[3]!;
  const addNode = (n: OsmElement, street: string) => {
    let i = indices.get(n.id);
    if (i !== undefined) {
      if (!graph.nodes[i]!.street) graph.nodes[i]!.street = street;
      return i;
    }
    i = graph.nodes.length;
    const [x, y] = project(n.lat!, n.lon!, snapshot.center);
    graph.nodes.push({
      id: n.id,
      lat: n.lat!,
      lon: n.lon!,
      x: x!,
      y: y!,
      street,
    });
    graph.outgoing.push([]);
    graph.incoming.push([]);
    indices.set(n.id, i);
    return i;
  };
  const addArc = (
    from: number,
    to: number,
    length: number,
    segment: number,
  ) => {
    const i = graph.arcs.length;
    graph.arcs.push({ from, to, length, segment });
    graph.outgoing[from]!.push(i);
    graph.incoming[to]!.push(i);
  };
  const allowed = new Set([
    "motorway",
    "motorway_link",
    "trunk",
    "trunk_link",
    "primary",
    "primary_link",
    "secondary",
    "secondary_link",
    "tertiary",
    "tertiary_link",
    "residential",
    "unclassified",
    "living_street",
    "service",
    "road",
  ]);
  const places = new Map<string, number>();
  for (const way of snapshot.elements) {
    const tags = way.tags ?? {};
    if (way.type === "node" && tags.place && tags.name) {
      const [x, y] = project(way.lat!, way.lon!, snapshot.center);
      graph.labels.push({ name: tags.name, x: x!, y: y! });
    }
    if (way.type !== "way" || !way.nodes) continue;
    if (
      tags.natural === "water" ||
      tags.waterway === "riverbank" ||
      tags.leisure === "park"
    ) {
      const points = way.nodes
        .map((id) => raw.get(id))
        .filter((n): n is OsmElement => !!n)
        .map((n) => project(n.lat!, n.lon!, snapshot.center));
      if (points.length >= 3)
        graph.areas.push({
          kind: tags.leisure === "park" ? "park" : "water",
          points,
        });
    }
    if (
      !allowed.has(tags.highway ?? "") ||
      ["no", "private"].includes(tags.access ?? "") ||
      ["no", "private"].includes(tags.motor_vehicle ?? "") ||
      ["no", "private"].includes(tags.vehicle ?? "")
    )
      continue;
    const one =
      tags["oneway:motor_vehicle"] ??
      tags.oneway ??
      (tags.junction === "roundabout" ? "yes" : "no");
    const direction =
      one === "-1" ? -1 : ["yes", "1", "true"].includes(one) ? 1 : 0;
    for (let n = 1; n < way.nodes.length; n++) {
      const a = raw.get(way.nodes[n - 1]!),
        b = raw.get(way.nodes[n]!);
      if (!a || !b || !inside(a) || !inside(b)) continue;
      const ai = addNode(a, tags.name ?? ""),
        bi = addNode(b, tags.name ?? "");
      if (ai === bi) continue;
      const length = distance(graph.nodes[ai]!, graph.nodes[bi]!);
      if (!Number.isFinite(length) || length <= 0) continue;
      const segment = graph.segments.length;
      graph.segments.push({
        a: ai,
        b: bi,
        length,
        name: tags.name ?? "",
        kind: tags.highway!,
        oneway: direction,
      });
      if (direction !== -1) addArc(ai, bi, length, segment);
      if (direction !== 1) addArc(bi, ai, length, segment);
      if (tags.name && !places.has(tags.name)) places.set(tags.name, ai);
    }
  }
  graph.places = [...places]
    .map(([name, node]) => ({ name, node }))
    .sort((a, b) => a.name.localeCompare(b.name, "de"));
  if (graph.nodes.length < 10)
    throw new Error(
      "Der Kartenausschnitt enthält zu wenige befahrbare Straßen.",
    );
  return graph;
}
export function nearestNode(graph: RoadGraph, x: number, y: number): number {
  let best = 0,
    bestD = Infinity;
  graph.nodes.forEach((n, i) => {
    const d = (n.x - x) ** 2 + (n.y - y) ** 2;
    if (d < bestD) {
      best = i;
      bestD = d;
    }
  });
  return best;
}
