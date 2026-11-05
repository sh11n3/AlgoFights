export type Edge = [from: number, to: number, cost: number];
type Point = [x: number, y: number];
export interface GraphPreset {
  id: string;
  name: string;
  description: string;
  points: Point[];
  edges: Edge[];
  start: number;
  target: number;
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
];
