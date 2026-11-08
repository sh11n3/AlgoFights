<script setup lang="ts">
import { computed, ref } from "vue";
import type { LabInput } from "../lab/types";
const props = defineProps<{ input: LabInput }>();
const path = ref("");
const label = (v: number) => props.input.nodes[v]?.label ?? String(v);
const model = computed(() => {
  const g = props.input,
    n = g.nodes.length,
    out = g.nodes.map(() => [] as number[]),
    inc = Array(n).fill(0),
    W = g.nodes.map((_, u) => g.nodes.map((_, v) => (u === v ? 0 : Infinity)));
  for (const e of g.edges) {
    out[e.from].push(e.to);
    inc[e.to]++;
    W[e.from][e.to] = Math.min(W[e.from][e.to], e.weight);
    if (!g.directed && e.from !== e.to) {
      out[e.to].push(e.from);
      inc[e.from]++;
      W[e.to][e.from] = Math.min(W[e.to][e.from], e.weight);
    }
  }
  const reach = g.nodes.map((_, u) =>
    g.nodes.map((_, v) => u === v || out[u].includes(v)),
  );
  for (let z = 0; z < n; z++)
    for (let u = 0; u < n; u++)
      for (let v = 0; v < n; v++) reach[u][v] ||= reach[u][z] && reach[z][v];
  return {
    out,
    inc,
    W,
    reach,
    terms: g.edges.map((e) =>
      g.directed
        ? `(${label(e.from)}, ${label(e.to)})`
        : `{${label(e.from)}, ${label(e.to)}}`,
    ),
  };
});
const checkedPath = computed(() => {
  const names = path.value
    .trim()
    .split(/[\s,;→]+/)
    .filter(Boolean);
  if (!names.length)
    return "Gib eine Knotenfolge ein, etwa A B C. Auch ein einzelner Knoten ist ein Pfad der Länge 0.";
  const nodes = names.map(
    (name) =>
      props.input.nodes.find(
        (n) => n.label.toUpperCase() === name.toUpperCase(),
      )?.id ?? -1,
  );
  if (nodes.includes(-1))
    return "Mindestens eine Knotenbezeichnung gehört nicht zum Graphen.";
  const edges: number[] = [];
  let weight = 0;
  for (let i = 1; i < nodes.length; i++) {
    const id = props.input.edges.findIndex(
      (e) =>
        (e.from === nodes[i - 1] && e.to === nodes[i]) ||
        (!props.input.directed && e.to === nodes[i - 1] && e.from === nodes[i]),
    );
    if (id < 0)
      return `Kein Pfad: Die Verbindung ${label(nodes[i - 1])} → ${label(nodes[i])} fehlt.`;
    edges.push(id);
    weight += props.input.edges[id].weight;
  }
  const cycle =
    nodes.length > 1 &&
    nodes[0] === nodes.at(-1) &&
    (props.input.directed || new Set(edges).size === edges.length);
  return `p = ⟨${nodes.map(label).join(", ")}⟩ · k = ${edges.length} · w(p) = ${weight}. ${new Set(nodes).size === nodes.length ? "Einfacher Pfad." : cycle && new Set(nodes.slice(0, -1)).size === nodes.length - 1 ? "Einfacher Zyklus." : cycle ? "Zyklus mit Wiederholungen." : "Kein einfacher Pfad und kein Zyklus im hier verwendeten Sinn."}`;
});
const mode = ref("list");
</script>
<template>
  <section class="lab-explanation graph-facts">
    <h2>Der aktuelle Graph in mathematischer Form</h2>
    <p class="notation-math">
      G = (V,E) · n = {{ input.nodes.length }} · m = {{ input.edges.length
      }}<template v-if="input.edges.some((e) => e.weight !== 1)">
        · w: E → ℝ</template
      >
    </p>
    <p>
      <code>V = { {{ input.nodes.map((n) => n.label).join(", ") }} }</code>
    </p>
    <p class="lab-set">
      <code>E = { {{ model.terms.join(", ") }} }</code>
    </p>
    <p>
      Gerichtete Kanten sind geordnete Paare; ungerichtete Kanten ungeordnete
      Mengen. Adjazenz beschreibt benachbarte Knoten, Inzidenz die Zugehörigkeit
      einer Kante zu ihren Enden. Eine gerichtete Schlinge verbindet einen
      Knoten mit sich selbst.
    </p>
    <label
      >Darstellung<select v-model="mode">
        <option value="list">Adjazenzlisten & Grade</option>
        <option value="adjacency">Adjazenzmatrix A</option>
        <option value="weight">Gewichtungsmatrix W</option>
        <option value="reach">Erreichbarkeitsmatrix R</option>
      </select></label
    >
    <div class="lab-scroll lab-matrix-scroll">
      <table class="lab-matrix">
        <thead>
          <tr>
            <th>v</th>
            <template v-if="mode === 'list'"
              ><th>Nachbarn / Nachfolger</th>
              <th>{{ input.directed ? "indeg" : "deg" }}</th>
              <th v-if="input.directed">outdeg</th></template
            >
            <th
              v-for="node in mode === 'list' ? [] : input.nodes"
              :key="node.id"
            >
              {{ node.label }}
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="node in input.nodes" :key="node.id">
            <th>{{ node.label }}</th>
            <template v-if="mode === 'list'"
              ><td>{{ model.out[node.id].map(label).join(", ") || "∅" }}</td>
              <td>
                {{
                  input.directed
                    ? model.inc[node.id]
                    : model.out[node.id].length
                }}
              </td>
              <td v-if="input.directed">
                {{ model.out[node.id].length }}
              </td></template
            >
            <td
              v-for="other in mode === 'list' ? [] : input.nodes"
              :key="other.id"
            >
              {{
                mode === "reach"
                  ? Number(model.reach[node.id][other.id])
                  : mode === "adjacency"
                    ? Number(model.out[node.id].includes(other.id))
                    : model.W[node.id][other.id] === Infinity
                      ? "∞"
                      : model.W[node.id][other.id]
              }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <p>
      {{
        input.directed
          ? "∑ indeg(v) = ∑ outdeg(v) = m."
          : "∑ deg(v) = 2m für ungerichtete Graphen ohne Schlingen."
      }}
      Adjazenzmatrix: aᵤᵥ = 1 genau bei einer Kante. Erreichbarkeit: rᵤᵥ = 1 bei
      einem Pfad, einschließlich Länge 0. Für W gilt auf der Diagonale 0 oder
      ein kleineres negatives Schlingengewicht.
    </p>
    <p>
      Adjazenzlisten benötigen O(n+m) Platz; eine Nachbarschaft lässt sich in
      O(deg(v)) durchlaufen. Eine einfache Liste prüft Kanten in O(deg(v)), eine
      Matrix in O(1). Eine n×n-Matrix benötigt O(n²) Platz und O(n) für das
      Durchlaufen einer vollständigen Zeile. Diese Ansicht wird aus derselben
      Eingabe berechnet wie die Animation.
    </p>
    <label
      >Pfad prüfen<input v-model="path" placeholder="A B C" maxlength="200"
    /></label>
    <p role="status">{{ checkedPath }}</p>
    <p>
      Im ungerichteten Graphen ist Erreichbarkeit reflexiv, symmetrisch und
      transitiv. Im gerichteten Graphen ist erst gegenseitige Erreichbarkeit
      eine Äquivalenzrelation. Schwache Komponenten ignorieren die
      Pfeilrichtungen, starke Komponenten verlangen Wege in beiden Richtungen.
    </p>
  </section>
</template>
