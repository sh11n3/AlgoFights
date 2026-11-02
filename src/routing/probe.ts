import type { RoadGraph } from "./types";
// Small directed teaching graph; A->B->D is shortest, A->C->D is longer.
export function routeProbe(): RoadGraph {
  return {
    id: "probe",
    name: "Editor-Probe",
    bbox: [],
    center: [],
    downloadedAt: "",
    osmTimestamp: "",
    nodes: [0, 1, 2, 3].map((id) => ({
      id,
      lat: 49 + id * 0.00001,
      lon: 8,
      x: id,
      y: 0,
      street: "Probe",
    })),
    arcs: [
      { from: 0, to: 1, length: 10, segment: 0 },
      { from: 1, to: 3, length: 10, segment: 1 },
      { from: 0, to: 2, length: 15, segment: 2 },
      { from: 2, to: 3, length: 20, segment: 3 },
    ],
    outgoing: [[0, 2], [1], [3], []],
    incoming: [[], [0], [2], [1, 3]],
    segments: [],
    areas: [],
    labels: [],
    places: [],
  };
}
