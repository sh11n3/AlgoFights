import type { RouteAlgorithm } from "../routing/types";
import type { GraphPreset } from "./presets";
import type { TeachingGraph } from "./simulation";

export const MAX_NOTATION_LENGTH = 1200;

export function readGraphNotation(value: unknown) {
  return typeof value === "string"
    ? value.slice(0, MAX_NOTATION_LENGTH).trim()
    : "";
}

const relaxation = [
  "dis(s) = 0, dis(v) = ∞ für v ≠ s",
  "dis(u) + w(u, v) < dis(v) ⇒",
  "dis(v) ← dis(u) + w(u, v), pre(v) ← u",
];
const heuristic = [
  "α = min { w(u, v) / ‖xᵤ − xᵥ‖₂ : (u, v) ∈ E }",
  "h(v) = α · ‖xᵥ − xₜ‖₂",
];

export const ALGORITHM_NOTATION: Record<
  RouteAlgorithm,
  { rules: string[]; result: string; legend: string; heuristic?: boolean }
> = {
  dijkstra: {
    rules: [
      ...relaxation,
      "u ∈ arg min { dis(v) : v ∈ Q }",
      "dis(u) = δ(s, u) bei der Entnahme aus Q",
    ],
    result:
      "Bei nichtnegativen Gewichten ist der Pfad optimal, wenn das Ziel aus der Warteschlange entnommen wird.",
    legend:
      "dis(v) ist die bisher bekannte obere Schranke für δ(s, v), pre(v) der Vorgängerknoten und Q die Min-Prioritätswarteschlange.",
  },
  astar: {
    rules: [
      ...relaxation,
      "f(v) = dis(v) + h(v)",
      "u ∈ arg min { f(v) : v ∈ Q }",
      "h(u) ≤ w(u, v) + h(v), h(t) = 0",
    ],
    result:
      "Die hier verwendete Heuristik ist konsistent. Beim Entnehmen des Ziels ist sein Pfadgewicht minimal.",
    legend:
      "dis(v) sind die bisher bekannten Kosten ab s. h(v) schätzt die Restkosten. Q ordnet offene Knoten nach f(v).",
    heuristic: true,
  },
  bidirectional: {
    rules: [
      "dis₊(s) = dis₋(t) = 0, alle anderen Startwerte = ∞",
      "dis₊(v) ← min { dis₊(v), dis₊(u) + w(u, v) }",
      "dis₋(u) ← min { dis₋(u), w(u, v) + dis₋(v) }",
      "μ = min { dis₊(v) + dis₋(v) : v ∈ V }",
      "Stopp, sobald min dis₊(Q₊) + min dis₋(Q₋) ≥ μ",
    ],
    result:
      "Die Rückwärtssuche nutzt eingehende Kanten. Ein endlicher bester Verbindungswert μ ergibt beim Stopp das optimale Pfadgewicht.",
    legend:
      "Q₊ und Q₋ sind die offenen Knoten der Vorwärts- und Rückwärtssuche. Die Werte dis₊ und dis₋ beziehen sich auf s bzw. t.",
  },
  bfs: {
    rules: [
      "Q = ⟨s⟩, dis(s) = 0",
      "Beim ersten Entdecken von v ab u: dis(v) ← dis(u) + 1, pre(v) ← u",
      "Entnimm vorne aus Q, füge hinten an Q an (FIFO)",
    ],
    result:
      "Der gefundene Pfad hat minimale Länge k. Bei verschiedenen Kantengewichten kann sein Gewicht w(p) größer als δ(s, t) sein.",
    legend:
      "dis(v) zählt hier Kanten. pre(v) speichert den Knoten, von dem aus v zuerst entdeckt wurde.",
  },
  dfs: {
    rules: [
      "S = ⟨s⟩",
      "Beim ersten Entdecken von v ab u: pre(v) ← u",
      "Entnimm und ergänze am Ende von S (LIFO)",
    ],
    result:
      "Die Vorgänger ergeben einen gültigen Pfad zum erreichbaren Ziel. Seine Länge und sein Gewicht können über dem jeweiligen Minimum liegen.",
    legend:
      "S ist der Stapel offener Knoten. pre(v) speichert die erste Entdeckung von v.",
  },
  greedy: {
    rules: [...relaxation, "u ∈ arg min { h(v) : v ∈ Q }"],
    result:
      "Für die Reihenfolge zählt allein h(v). dis(v) und pre(v) helfen bei der Pfadbildung, liefern hier aber keine Optimalitätsgarantie.",
    legend:
      "Q ordnet offene Knoten nach den geschätzten Restkosten h(v). Verbesserungen der bekannten Kosten werden nur für offene Knoten übernommen.",
    heuristic: true,
  },
};

export const HEURISTIC_NOTATION = heuristic;

export function graphNotation(
  preset: GraphPreset,
  graph: TeachingGraph,
  directed: boolean,
  weighted: boolean,
) {
  const ids = graph.nodes.map(({ id }) => id);
  const edgeTerms = preset.edges.map(([u, v]) =>
    directed ? `(${u}, ${v})` : `{${Math.min(u, v)}, ${Math.max(u, v)}}`,
  );
  const adjacency = graph.outgoing.map((outgoing) =>
    outgoing.map((edge) => graph.arcs[edge].to),
  );
  const weights = graph.outgoing.map(
    (outgoing) =>
      new Map(
        outgoing.map((edge) => {
          const { to, length } = graph.arcs[edge];
          return [to, length] as const;
        }),
      ),
  );
  const matrix = (mode: "adjacency" | "weight") =>
    ids.map((u) =>
      ids.map((v) =>
        mode === "adjacency"
          ? weights[u].has(v)
            ? 1
            : 0
          : u === v
            ? 0
            : (weights[u].get(v) ?? Infinity),
      ),
    );
  return {
    ids,
    edgeTerms,
    adjacency,
    matrix,
    weights: weighted ? preset.edges.map((edge) => edge[2]) : [],
  };
}
