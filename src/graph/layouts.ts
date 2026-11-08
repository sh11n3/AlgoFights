import type { Edge, GraphPreset, Point } from "./presets";

export const MAX_NODES = 32;
export const MAX_EDGES = 96;
export const MAX_LAYOUTS = 30;
export const LAYOUT_STORAGE_KEY = "graph-layouts";

// Projection only: the saved directed graph keeps its original opposite edges and loops.
export function projectEdges(edges: Edge[], directed: boolean): Edge[] {
  if (directed) return edges.map((e) => [...e] as Edge);
  const pairs = new Map<string, Edge>();
  for (const [a, b, cost] of edges) {
    if (a === b) continue;
    const from = Math.min(a, b),
      to = Math.max(a, b),
      key = `${from}:${to}`,
      previous = pairs.get(key);
    if (!previous || cost < previous[2]) pairs.set(key, [from, to, cost]);
  }
  return [...pairs.values()];
}

export interface GraphLayout extends GraphPreset {
  weighted: boolean;
  directed: boolean;
}

export function cloneLayout(preset: GraphPreset): GraphLayout {
  return {
    ...preset,
    weighted: preset.weighted ?? true,
    directed: preset.directed ?? false,
    points: preset.points.map(([x, y]) => [x, y]),
    edges: preset.edges.map(([from, to, cost]) => [from, to, cost]),
  };
}

export function samePair(
  a: number,
  b: number,
  [from, to]: Edge,
  directed = false,
) {
  return (a === from && b === to) || (!directed && a === to && b === from);
}

export function removeGraphNode(layout: GraphLayout, node: number) {
  const remap = (id: number) => (id > node ? id - 1 : id);
  layout.points.splice(node, 1);
  layout.edges = layout.edges
    .filter(([from, to]) => from !== node && to !== node)
    .map(([from, to, cost]) => [remap(from), remap(to), cost]);
  layout.start =
    layout.start === node
      ? layout.points.length
        ? 0
        : -1
      : remap(layout.start);
  layout.target =
    layout.target === node ? layout.points.length - 1 : remap(layout.target);
}

function isLayout(value: unknown): value is GraphLayout {
  if (!value || typeof value !== "object") return false;
  const {
    id,
    name,
    description,
    points,
    edges,
    start,
    target,
    weighted,
    directed,
  } = value as GraphLayout;
  if (
    typeof id !== "string" ||
    !/^layout:[a-f0-9-]{36}$/.test(id) ||
    typeof name !== "string" ||
    !name.trim() ||
    name.length > 48 ||
    typeof description !== "string" ||
    typeof weighted !== "boolean" ||
    typeof directed !== "boolean" ||
    !Array.isArray(points) ||
    points.length < 1 ||
    points.length > MAX_NODES ||
    !Array.isArray(edges) ||
    edges.length > MAX_EDGES
  )
    return false;
  const nodeId = (id: number) =>
    Number.isInteger(id) && id >= 0 && id < points.length;
  if (
    !nodeId(start) ||
    !nodeId(target) ||
    !points.every(
      (point: Point) =>
        Array.isArray(point) &&
        point.length === 2 &&
        point.every((n) => Number.isFinite(n) && n >= 0 && n <= 1),
    )
  )
    return false;
  const positions = new Set(points.map(([x, y]) => `${x}:${y}`));
  if (positions.size !== points.length) return false;
  const seen = new Set<string>();
  return edges.every((edge: Edge) => {
    if (!Array.isArray(edge) || edge.length !== 3) return false;
    const [from, to, cost] = edge;
    const pair = directed || from < to ? `${from}:${to}` : `${to}:${from}`;
    if (
      !nodeId(from) ||
      !nodeId(to) ||
      (!directed && from === to) ||
      seen.has(pair) ||
      !Number.isInteger(cost) ||
      cost < -999 ||
      cost > 999
    )
      return false;
    seen.add(pair);
    return true;
  });
}

export function decodeLayouts(json: string): GraphLayout[] {
  try {
    const values: unknown = JSON.parse(json);
    return Array.isArray(values)
      ? values.filter(isLayout).slice(0, MAX_LAYOUTS)
      : [];
  } catch {
    return [];
  }
}

export function readLayouts() {
  try {
    return decodeLayouts(
      localStorage.getItem(`algofights.${LAYOUT_STORAGE_KEY}.v1`) ?? "[]",
    );
  } catch {
    return [];
  }
}
