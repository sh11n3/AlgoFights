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
    incoming = g.nodes.map(() => [] as number[]),
    inc = Array(n).fill(0),
    W = g.nodes.map((_, u) => g.nodes.map((_, v) => (u === v ? 0 : Infinity)));
  for (const e of g.edges) {
    out[e.from].push(e.to);
    incoming[e.to].push(e.from);
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
    incoming,
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
const degreeSum = computed(() =>
  model.value.out.reduce((sum, neighbors) => sum + neighbors.length, 0),
);
const oddDegrees = computed(() =>
  props.input.nodes
    .filter(({ id }) => model.value.out[id].length % 2 !== 0)
    .map(({ label }) => label),
);
const cubeDimension = computed(() => {
  const n = props.input.nodes.length;
  const d = Math.log2(n);
  if (
    props.input.directed ||
    !Number.isInteger(d) ||
    d < 2 ||
    props.input.edges.length !== (d * n) / 2
  )
    return;
  if (
    props.input.edges.every(({ from, to }) => {
      const difference = from ^ to;
      return difference > 0 && (difference & (difference - 1)) === 0;
    })
  )
    return d;
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
              <th v-if="input.directed">Vorgänger</th>
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
              <td v-if="input.directed">
                {{ model.incoming[node.id].map(label).join(", ") || "∅" }}
              </td>
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
    <details class="experiment-options">
      <summary>Knotengrade, Kantenzahl und Begründungen</summary>
      <template v-if="!input.directed">
        <p>
          Dieser Graph hat Grad-Summe {{ degreeSum }} und
          {{ input.edges.length }} Kanten. Ungerader Grad bei
          {{ oddDegrees.length }} Knoten{{
            oddDegrees.length ? ": " + oddDegrees.join(", ") : ""
          }}.
        </p>
        <p>
          Jede Kante trägt an ihren beiden Enden je eins zur Grad-Summe bei.
          Deshalb gilt ∑deg(v) = 2m. Gerade Grade ändern die Parität der Summe
          nicht. Damit muss die Zahl der ungeraden Grade gerade sein. Sieben
          Knoten, die alle Grad 3 hätten, wären beispielsweise unmöglich.
        </p>
        <p>
          In Kₙ ist jedes der n(n−1) geordneten Knotenpaare mit verschiedenen
          Enden verbunden. Jede ungerichtete Kante tritt darin zweimal auf: m =
          n(n−1)/2. Beim d-dimensionalen Würfel entspricht jeder der d Nachbarn
          einem einzelnen Bitwechsel. Bei 2ᵈ Knoten folgt m = d·2ᵈ⁻¹.
        </p>
        <p v-if="cubeDimension">
          Binärwörter dieses Würfelgraphen:
          <code>{{
            input.nodes
              .map(
                ({ id, label }) =>
                  `${label}=${id.toString(2).padStart(cubeDimension!, "0")}`,
              )
              .join(" · ")
          }}</code>
        </p>
      </template>
      <template v-else>
        <p>
          Ausgehende Adjazenzlisten zeigen den Ausgangsgrad direkt als
          Listenlänge. Für den Eingangsgrad muss man ohne separate
          Vorgängerlisten alle Listen nach dem Knoten durchsuchen. Das kostet
          O(n+m), im dichten Fall O(n²). Eine 0/1-Matrix liefert den
          Ausgangsgrad per Zeilensumme und den Eingangsgrad per Spaltensumme,
          jeweils in O(n).
        </p>
        <p>
          Hat jeder Knoten eine ausgehende Kante, kann man immer weitergehen. Da
          es nur endlich viele Knoten gibt, wiederholt sich irgendwann ein
          Knoten. Der Abschnitt zwischen seinem ersten und zweiten Auftreten ist
          ein einfacher Zyklus.
        </p>
        <p>
          Eine vollständige DFS startet auch bei isolierten Knoten und schließt
          sie ab. Ein Knoten mit ein- und ausgehenden Kanten kann trotzdem
          allein in einem Suchbaum stehen, wenn seine Nachbarn schon besucht
          sind. Bei beg(v) &lt; beg(u) &lt; end(u) &lt; end(v) liegt v auf der
          Vorfahrenkette von u. Die Kante u→v ist dann eine Rückwärtskante.
        </p>
      </template>
    </details>
  </section>
</template>
