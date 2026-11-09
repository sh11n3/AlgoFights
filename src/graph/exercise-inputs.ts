import { MAX_EDGES, MAX_NODES, type GraphLayout } from "./layouts";
import type { Edge, Point } from "./presets";

function circle(
  count: number,
  radius = 0.44,
  rotation = -Math.PI / 2,
): Point[] {
  return Array.from({ length: count }, (_, i) => {
    const angle = (i * 2 * Math.PI) / count + rotation;
    return [0.5 + radius * Math.cos(angle), 0.5 + radius * Math.sin(angle)];
  });
}

export function completeGraph(n: number): GraphLayout {
  if (!Number.isInteger(n) || n < 1 || n > 14)
    throw Error("Ein vollständiger Graph kann hier 1 bis 14 Knoten haben.");
  const edges: Edge[] = [];
  for (let u = 0; u < n; u++)
    for (let v = u + 1; v < n; v++) edges.push([u, v, 1]);
  return {
    id: "",
    name: `Vollständiger Graph K${n}`,
    description: "Jedes Paar verschiedener Knoten ist verbunden.",
    points: circle(n),
    edges,
    directed: false,
    weighted: false,
    start: 0,
    target: n - 1,
  };
}

export function cubeGraph(dimension: number): GraphLayout {
  if (!Number.isInteger(dimension) || dimension < 2 || dimension > 5)
    throw Error("Der Würfel kann hier 2 bis 5 Dimensionen haben.");
  const n = 2 ** dimension,
    edges: Edge[] = [];
  for (let u = 0; u < n; u++)
    for (let bit = 0; bit < dimension; bit++) {
      const v = u ^ (1 << bit);
      if (u < v) edges.push([u, v, 1]);
    }
  const points =
    dimension <= 3
      ? Array.from({ length: n }, (_, id): Point => {
          const margin = id & 4 ? 0.32 : 0.06;
          return [id & 1 ? 1 - margin : margin, id & 2 ? 1 - margin : margin];
        })
      : circle(n);
  return {
    id: "",
    name: `Würfelgraph Q${dimension}`,
    description:
      "Knoten entsprechen Binärwörtern. Eine Kante ändert genau ein Bit.",
    points,
    edges,
    directed: false,
    weighted: false,
    start: 0,
    target: n - 1,
  };
}

export function petersenGraph(): GraphLayout {
  const edges: Edge[] = [];
  for (let i = 0; i < 5; i++)
    edges.push(
      [i, (i + 1) % 5, 1],
      [i, i + 5, 1],
      [i + 5, 5 + ((i + 2) % 5), 1],
    );
  return {
    id: "",
    name: "Petersen-Graph",
    description:
      "Zwei Fünfergruppen, verbunden durch Speichen. Innen verbindet jede Kante übernächste Knoten.",
    points: [...circle(5, 0.46, Math.PI / 2), ...circle(5, 0.23, Math.PI / 2)],
    edges,
    directed: false,
    weighted: false,
    start: 0,
    target: 7,
  };
}

export function gridEdges(rows: number, columns: number): Edge[] {
  if (
    !Number.isInteger(rows) ||
    !Number.isInteger(columns) ||
    rows < 2 ||
    columns < 2 ||
    rows * columns > MAX_NODES
  )
    throw Error(
      `Das Raster benötigt mindestens 2 × 2 und höchstens ${MAX_NODES} Felder.`,
    );
  const edges: Edge[] = [];
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < columns; c++) {
      const u = r * columns + c;
      if (c + 1 < columns) edges.push([u, u + 1, 1]);
      if (r + 1 < rows) edges.push([u, u + columns, 1]);
    }
  return edges;
}

export function mazeGraph(
  rows: number,
  columns: number,
  walls: ReadonlySet<string>,
  start = 0,
  target = rows * columns - 1,
): GraphLayout {
  const edges = gridEdges(rows, columns).filter(
    ([u, v]) => !walls.has(`${u}:${v}`),
  );
  const n = rows * columns;
  if (![start, target].every((id) => Number.isInteger(id) && id >= 0 && id < n))
    throw Error("Start oder Ziel liegt außerhalb des Rasters.");
  const points = Array.from({ length: n }, (_, i): Point => [
    (i % columns) / (columns - 1),
    Math.floor(i / columns) / (rows - 1),
  ]);
  return {
    id: "",
    name: `Labyrinth ${rows} × ${columns}`,
    description:
      "Felder sind Knoten. Jede offene Seite ist eine Kante mit Kosten 1.",
    points,
    edges,
    directed: false,
    weighted: false,
    start,
    target,
  };
}

export function graphFromMatrix(
  source: string,
  weighted: boolean,
  directed: boolean,
): GraphLayout {
  if (source.length > 12000) throw Error("Die Matrix ist zu groß.");
  let rows: unknown;
  if (source.trim().startsWith("[")) {
    try {
      rows = JSON.parse(source);
    } catch {
      throw Error("Die JSON-Matrix konnte nicht gelesen werden.");
    }
  } else
    rows = source
      .trim()
      .split(/\r?\n|;/)
      .filter((row) => row.trim())
      .map((row) => row.trim().split(/[\s,]+/));
  if (
    !Array.isArray(rows) ||
    rows.length < 1 ||
    rows.length > MAX_NODES ||
    !rows.every((row) => Array.isArray(row) && row.length === rows.length)
  )
    throw Error(
      `Die Matrix muss quadratisch sein und 1 bis ${MAX_NODES} Zeilen enthalten.`,
    );
  const n = rows.length;
  const matrix = rows.map((row, i) =>
    row.map((value: unknown, j: number) => {
      if (
        weighted &&
        (value === null ||
          (typeof value === "string" && /^(∞|inf(?:inity)?|-)$/i.test(value)))
      )
        return Infinity;
      const normalized =
        typeof value === "string" ? value.replace(/^−/, "-") : value;
      const numeric =
        typeof normalized === "number" ||
        (typeof normalized === "string" && /^[+-]?\d+$/.test(normalized))
          ? Number(normalized)
          : NaN;
      if (
        !Number.isInteger(numeric) ||
        numeric < -999 ||
        numeric > 999 ||
        (!weighted && numeric !== 0 && numeric !== 1)
      )
        throw Error(`Ungültiger Eintrag in Zeile ${i + 1}, Spalte ${j + 1}.`);
      return numeric;
    }),
  );
  const edges: Edge[] = [];
  for (let u = 0; u < n; u++)
    for (let v = 0; v < n; v++) {
      const value = matrix[u][v];
      if (!directed && value !== matrix[v][u])
        throw Error(
          "Für einen ungerichteten Graphen muss die Matrix symmetrisch sein.",
        );
      if (!Number.isFinite(value) || ((!weighted || u === v) && value === 0))
        continue;
      if (!directed && u === v)
        throw Error("Ungerichtete Schlingen werden nicht unterstützt.");
      if (directed || u < v) edges.push([u, v, value]);
    }
  if (edges.length > MAX_EDGES)
    throw Error(`Maximal ${MAX_EDGES} Kanten pro Graph.`);
  return {
    id: "",
    name: weighted ? "Graph aus Gewichtungsmatrix" : "Graph aus Adjazenzmatrix",
    description:
      "Aus einer quadratischen Matrix erzeugt. Die Kanten stehen in Zeilenreihenfolge.",
    points: circle(n),
    edges,
    directed,
    weighted,
    start: 0,
    target: n - 1,
  };
}
