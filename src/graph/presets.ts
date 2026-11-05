export type Edge = [from: number, to: number, cost: number];
export type Point = [x: number, y: number];
export interface GraphPreset {
  id: string;
  name: string;
  description: string;
  points: Point[];
  edges: Edge[];
  start: number;
  target: number;
  directed?: boolean;
  weighted?: boolean;
}

const circle = (count: number): Point[] =>
  Array.from({ length: count }, (_, i) => {
    const angle = (i * 2 * Math.PI) / count - Math.PI / 2;
    return [0.5 + 0.48 * Math.cos(angle), 0.5 + 0.48 * Math.sin(angle)];
  });
const completeEdges: Edge[] = [];
for (let a = 0; a < 6; a++) {
  for (let b = a + 1; b < 6; b++)
    completeEdges.push([a, b, 2 + ((a * 5 + b * 3) % 9)]);
}

const gridPoints: Point[] = [],
  gridEdges: Edge[] = [];
for (let row = 0; row < 4; row++) {
  for (let col = 0; col < 6; col++) {
    const node = row * 6 + col;
    gridPoints.push([col / 5, row / 3]);
    if (col < 5) gridEdges.push([node, node + 1, 1 + ((node * 5 + 3) % 9)]);
    if (row < 3) gridEdges.push([node, node + 6, 1 + ((node * 7 + 1) % 9)]);
  }
}

const clusterPoints: Point[] = [],
  clusterEdges: Edge[] = [];
for (let group = 0; group < 4; group++) {
  const cx = group % 2 ? 0.77 : 0.23,
    cy = group < 2 ? 0.23 : 0.77;
  for (let i = 0; i < 8; i++) {
    const angle = (i * Math.PI) / 4,
      node = group * 8 + i;
    clusterPoints.push([
      cx + 0.19 * Math.cos(angle),
      cy + 0.19 * Math.sin(angle),
    ]);
    clusterEdges.push([node, group * 8 + ((i + 1) % 8), 1 + ((node * 3) % 7)]);
    if (i % 2 === 0)
      clusterEdges.push([
        node,
        group * 8 + ((i + 2) % 8),
        3 + ((node * 5) % 8),
      ]);
  }
}
clusterEdges.push([0, 12, 6], [2, 22, 3], [10, 30, 8], [16, 28, 4]);

export const PRESETS: GraphPreset[] = [
  {
    id: "shortcut",
    name: "Abkürzung",
    description:
      "Ein kurzer Weg kann teuer sein. Vergleiche Breitensuche und Dijkstra mit und ohne Kantengewichte.",
    points: [
      [0, 0.5],
      [0.5, 0],
      [0.28, 1],
      [0.72, 1],
      [1, 0.5],
    ],
    edges: [
      [0, 1, 8],
      [1, 4, 8],
      [0, 2, 2],
      [2, 3, 2],
      [3, 4, 2],
      [1, 2, 3],
    ],
    start: 0,
    target: 4,
  },
  {
    id: "tree",
    name: "Verzweigter Baum",
    description:
      "Zwischen zwei Knoten gibt es ungerichtet genau einen einfachen Weg. BFS und DFS erkunden die Zweige in anderer Reihenfolge.",
    points: [
      [0.5, 0],
      [0.25, 0.3],
      [0.75, 0.3],
      [0.1, 0.63],
      [0.37, 0.63],
      [0.63, 0.63],
      [0.9, 0.63],
      [0, 1],
      [0.2, 1],
      [0.35, 1],
      [0.62, 1],
      [0.82, 1],
      [1, 1],
    ],
    edges: [
      [0, 1, 4],
      [0, 2, 2],
      [1, 3, 2],
      [1, 4, 7],
      [2, 5, 3],
      [2, 6, 4],
      [3, 7, 3],
      [3, 8, 1],
      [4, 9, 6],
      [5, 10, 2],
      [6, 11, 8],
      [6, 12, 2],
    ],
    start: 0,
    target: 12,
  },
  {
    id: "ladder",
    name: "Leiternetz",
    description:
      "Zwei Korridore sind über Querstreben verbunden. Zyklen erlauben Umwege und mehrere Wege zum Ziel.",
    points: Array.from({ length: 14 }, (_, i) => [
      (i % 7) / 6,
      i < 7 ? 0.2 : 0.8,
    ]),
    edges: [
      ...Array.from(
        { length: 6 },
        (_, i): Edge => [i, i + 1, 2 + ((i * 3) % 7)],
      ),
      ...Array.from(
        { length: 6 },
        (_, i): Edge => [i + 7, i + 8, 2 + ((i * 4) % 7)],
      ),
      ...Array.from(
        { length: 7 },
        (_, i): Edge => (i % 2 ? [i + 7, i, 4] : [i, i + 7, 2]),
      ),
    ],
    start: 0,
    target: 13,
  },
  {
    id: "grid",
    name: "Rastergraph",
    description:
      "Viele Wege haben dieselbe Kantenzahl. Mit Gewichten und A* lässt sich beobachten, welche Teilbereiche die Suche bevorzugt.",
    points: gridPoints,
    edges: gridEdges,
    start: 0,
    target: 23,
  },
  {
    id: "clusters",
    name: "Clusternetz",
    description:
      "Vier dichte Teilnetze sind über wenige Übergänge verbunden. Die Richtungen dieser Übergänge bestimmen, welche Gruppen erreichbar sind.",
    points: clusterPoints,
    edges: clusterEdges,
    start: 4,
    target: 24,
  },
  {
    id: "cycle",
    name: "Zyklus",
    description:
      "Zwei Wege führen um den Ring. Mit Pfeilen sind die Kanten nur im Uhrzeigersinn passierbar.",
    points: circle(10),
    edges: Array.from(
      { length: 10 },
      (_, i): Edge => [i, (i + 1) % 10, 1 + (i % 4)],
    ),
    start: 0,
    target: 7,
  },
  {
    id: "star",
    name: "Sternnetz",
    description:
      "Alle äußeren Knoten hängen an einer Nabe. Im ungerichteten Graphen führt jeder Weg zwischen zwei Blättern über diesen zentralen Knoten.",
    points: [[0.5, 0.5], ...circle(8)],
    edges: Array.from(
      { length: 8 },
      (_, i): Edge => (i === 0 ? [1, 0, 2] : [0, i + 1, i + 1]),
    ),
    start: 1,
    target: 5,
  },
  {
    id: "complete",
    name: "Vollständiger Graph K₆",
    description:
      "Jedes Knotenpaar ist verbunden. Die direkte Kante kann teurer sein als ein Weg über mehrere Knoten.",
    points: circle(6),
    edges: completeEdges,
    start: 0,
    target: 4,
  },
  {
    id: "bipartite",
    name: "Bipartiter Graph K₃,₄",
    description:
      "Kanten verbinden zwei Knotengruppen. Ein Weg zwischen Knoten derselben Gruppe braucht eine gerade Kantenzahl.",
    points: [
      [0.05, 0.12],
      [0.05, 0.5],
      [0.05, 0.88],
      [0.95, 0],
      [0.95, 0.32],
      [0.95, 0.68],
      [0.95, 1],
    ],
    edges: Array.from(
      { length: 12 },
      (_, i): Edge => [Math.floor(i / 4), 3 + (i % 4), 1 + ((i * 5) % 9)],
    ),
    start: 0,
    target: 2,
    directed: false,
  },
  {
    id: "dag",
    name: "Schichtgraph (DAG)",
    description:
      "Gerichtet führen alle Kanten in die nächste Schicht. Die Suche kann daher nie zu einem früheren Knoten zurückkehren.",
    points: [
      [0, 0.5],
      [0.24, 0.15],
      [0.24, 0.5],
      [0.24, 0.85],
      [0.51, 0.1],
      [0.51, 0.5],
      [0.51, 0.9],
      [0.76, 0.2],
      [0.76, 0.8],
      [1, 0.5],
    ],
    edges: [
      [0, 1, 5],
      [0, 2, 2],
      [0, 3, 3],
      [1, 4, 1],
      [1, 5, 3],
      [2, 5, 6],
      [2, 6, 4],
      [3, 6, 1],
      [4, 7, 5],
      [5, 7, 2],
      [5, 8, 1],
      [6, 8, 2],
      [7, 9, 2],
      [8, 9, 4],
    ],
    start: 0,
    target: 9,
    directed: true,
  },
  {
    id: "disconnected",
    name: "Getrennte Komponenten",
    description:
      "Zwischen den beiden Teilgraphen fehlt eine Verbindung. Mit den voreingestellten Endpunkten kann keine Suche das Ziel erreichen.",
    points: [
      [0, 0.2],
      [0.34, 0.35],
      [0.05, 0.8],
      [0.68, 0.25],
      [1, 0.35],
      [0.7, 0.78],
      [0.97, 0.84],
    ],
    edges: [
      [0, 1, 3],
      [0, 2, 5],
      [1, 2, 2],
      [3, 4, 1],
      [3, 5, 2],
      [4, 6, 4],
      [5, 6, 2],
    ],
    start: 0,
    target: 6,
  },
];
