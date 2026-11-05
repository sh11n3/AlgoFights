<script setup lang="ts">
import { computed, ref } from "vue";
import {
  ALGORITHM_NOTATION,
  graphNotation,
  HEURISTIC_NOTATION,
} from "../graph/notation";
import { searchTeachingGraph, type TeachingGraph } from "../graph/simulation";
import type { GraphPreset } from "../graph/presets";
import type { RouteAlgorithm, RouteResult } from "../routing/types";

const props = defineProps<{
  preset: GraphPreset;
  graph: TeachingGraph;
  directed: boolean;
  weighted: boolean;
  start: number;
  target: number;
  algorithm?: RouteAlgorithm;
  algorithmName: string;
  customNotation?: string;
  result?: Pick<RouteResult, "found" | "path" | "distance"> & {
    limited: boolean;
  };
  step: number;
  current?: number;
}>();
const representation = ref<"list" | "adjacency" | "weight">("list");
const model = computed(() =>
  graphNotation(props.preset, props.graph, props.directed, props.weighted),
);
const rules = computed(() =>
  props.algorithm ? ALGORITHM_NOTATION[props.algorithm] : undefined,
);
const matrix = computed(() =>
  representation.value === "list"
    ? []
    : model.value.matrix(representation.value),
);
const displayNumber = (n: number) => (Number.isFinite(n) ? n : "∞");
const referenceDistance = computed(() => {
  const { graph, start, target } = props;
  const { path } = searchTeachingGraph(
    graph,
    start,
    target,
    "dijkstra",
    graph.nodes.length,
  );
  if (path === null) return Infinity;
  return Array.from(path).reduce(
    (sum, edge) => sum + graph.arcs[edge].length,
    0,
  );
});
const evaluatedPath = computed(() => {
  const result = props.result;
  if (!result?.found) return undefined;
  const path = result.path;
  const visibleEdges = Array.from(path.slice(0, 10));
  const shortened = path.length > visibleEdges.length;
  const nodes: (number | string)[] = [
    props.start,
    ...visibleEdges.map((edge) => props.graph.arcs[edge].to),
  ];
  if (shortened) nodes.push("…", props.target);
  const weights = visibleEdges.map((edge) => props.graph.arcs[edge].length);
  const terms = weights.join(" + ") + (shortened ? " + …" : "");
  return { sequence: `⟨${nodes.join(", ")}⟩`, terms, length: path.length };
});
</script>

<template>
  <section class="panel graph-notation" aria-label="Mathematische Notation">
    <div class="notation-grid">
      <section>
        <h3>Graph · {{ preset.name }}</h3>
        <div class="notation-math">
          G = (V, E)<span v-if="weighted">, w: E → ℝ</span>
        </div>
        <p>
          <code>|V| = n = {{ model.ids.length }}</code> ·
          <code>|E| = m = {{ model.edgeTerms.length }}</code> ·
          {{ directed ? "gerichtet" : "ungerichtet" }} ·
          {{ weighted ? "gewichtet" : "ungewichtet" }}
        </p>
        <p class="notation-endpoints">
          <code>s = {{ start }}</code> ({{ graph.nodes[start].label }}) ·
          <code>t = {{ target }}</code> ({{ graph.nodes[target].label }})
        </p>

        <details :open="model.edgeTerms.length <= 12">
          <summary>
            Knotenmenge, Kantenmenge<span v-if="weighted"> und Gewichte</span>
          </summary>
          <div class="notation-set" data-set="vertices">
            <b>V =</b><span>{ {{ model.ids.join(", ") }} }</span>
          </div>
          <div class="notation-set" data-set="edges">
            <b>E =</b
            ><span
              >{
              <template v-for="(edge, index) in model.edgeTerms" :key="index"
                ><span class="notation-token"
                  >{{ edge
                  }}{{ index < model.edgeTerms.length - 1 ? ", " : " " }}</span
                ></template
              >}</span
            >
          </div>
          <div
            v-if="weighted && model.edgeTerms.length"
            class="notation-set"
            data-set="weights"
          >
            <b>w</b
            ><span>
              <span
                v-for="(edge, index) in model.edgeTerms"
                :key="index"
                class="notation-token"
                >{{ edge }} ↦ {{ model.weights[index]
                }}{{ index < model.edgeTerms.length - 1 ? ", " : "" }}</span
              >
            </span>
          </div>
        </details>

        <details>
          <summary>Adjazenz, Grade und Matrizen</summary>
          <label class="notation-select"
            >Graphdarstellung<select v-model="representation">
              <option value="list">Adjazenzliste und Grade</option>
              <option value="adjacency">Adjazenzmatrix A</option>
              <option value="weight">Gewichtungsmatrix W</option>
            </select></label
          >
          <p v-if="representation === 'adjacency'">
            <code>a<sub>uv</sub> = 1</code> bei einer Kante von <i>u</i> nach
            <i>v</i>, sonst <code>0</code>.
          </p>
          <p v-if="representation === 'weight'">
            <code>w<sub>uu</sub> = 0</code>. Für <code>u ≠ v</code> steht das
            Kantengewicht in der Zelle oder <code>∞</code> bei einer fehlenden
            Kante.
          </p>
          <p v-if="representation === 'list'">
            <code>{{
              directed ? "∑ indeg(v) = ∑ outdeg(v) = m" : "∑ deg(v) = 2m"
            }}</code>
          </p>
          <div
            class="notation-table"
            tabindex="0"
            aria-label="Graphdarstellung, horizontal scrollbar"
          >
            <table
              v-if="representation === 'list'"
              aria-label="Adjazenzliste und Knotengrade"
            >
              <thead>
                <tr>
                  <th scope="col">v</th>
                  <th scope="col">Im Graph</th>
                  <th scope="col">
                    {{ directed ? "Nachfolger" : "Nachbarn" }}
                  </th>
                  <th v-if="directed" scope="col">indeg(v)</th>
                  <th scope="col">{{ directed ? "outdeg(v)" : "deg(v)" }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="v in model.ids" :key="v">
                  <th scope="row">{{ v }}</th>
                  <td>{{ graph.nodes[v].label }}</td>
                  <td>{{ model.adjacency[v].join(", ") || "∅" }}</td>
                  <td v-if="directed">{{ graph.incoming[v].length }}</td>
                  <td>{{ graph.outgoing[v].length }}</td>
                </tr>
              </tbody>
            </table>
            <table
              v-else
              :aria-label="
                representation === 'adjacency'
                  ? 'Adjazenzmatrix'
                  : 'Gewichtungsmatrix'
              "
            >
              <thead>
                <tr>
                  <th scope="col">u \ v</th>
                  <th v-for="v in model.ids" :key="v" scope="col">{{ v }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(row, u) in matrix" :key="u">
                  <th scope="row">{{ u }}</th>
                  <td v-for="(value, v) in row" :key="v">
                    {{ displayNumber(value) }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </details>
      </section>

      <section>
        <h3>Algorithmus · {{ algorithmName }}</h3>
        <template v-if="rules">
          <div class="notation-rules">
            <div v-for="rule in rules.rules" :key="rule" class="notation-math">
              {{ rule }}
            </div>
          </div>
          <p>{{ rules.legend }}</p>
          <p>{{ rules.result }}</p>
          <details v-if="rules.heuristic">
            <summary>Heuristik h in Graph Sim</summary>
            <div
              v-for="rule in HEURISTIC_NOTATION"
              :key="rule"
              class="notation-math"
            >
              {{ rule }}
            </div>
            <p>
              <code>x<sub>v</sub></code> bezeichnet die Modellkoordinaten von
              Knoten <i>v</i>. Wenn keine Kante vorhanden ist, gilt
              <code>h(v) = 0</code>.
            </p>
          </details>
        </template>
        <div v-else-if="customNotation" class="notation-math notation-own">
          {{ customNotation }}
        </div>
        <p v-else>
          Eigene Algorithmen können ihre Auswahlregel und Formeln im Code-Editor
          unter „Mathematische Notation“ hinterlegen.
        </p>

        <div class="notation-path">
          <h3>Pfad und Pfadgewicht</h3>
          <div class="notation-math notation-equation">
            <math
              display="inline"
              aria-label="p ist die Knotenfolge von v null bis v k"
              ><mi>p</mi><mo>=</mo><mo>⟨</mo><msub><mi>v</mi><mn>0</mn></msub
              ><mo>,</mo><mo>…</mo><mo>,</mo><msub><mi>v</mi><mi>k</mi></msub
              ><mo>⟩</mo></math
            >
            <math
              display="inline"
              aria-label="Gewicht von p ist die Summe der Kantengewichte"
              ><mi>w</mi><mo stretchy="false">(</mo><mi>p</mi
              ><mo stretchy="false">)</mo><mo>=</mo
              ><munderover
                ><mo movablelimits="false">∑</mo
                ><mrow><mi>i</mi><mo>=</mo><mn>1</mn></mrow
                ><mi>k</mi></munderover
              ><mi>w</mi><mo>(</mo
              ><msub
                ><mi>v</mi><mrow><mi>i</mi><mo>−</mo><mn>1</mn></mrow></msub
              ><mo>,</mo><msub><mi>v</mi><mi>i</mi></msub
              ><mo stretchy="false">)</mo></math
            >
          </div>
          <div class="notation-math notation-equation">
            <math
              display="inline"
              aria-label="Delta von s nach t ist das kleinste Gewicht eines Pfads von s nach t"
              ><mi>δ</mi><mo stretchy="false">(</mo><mi>s</mi><mo>,</mo
              ><mi>t</mi><mo>)</mo><mo>=</mo><mi mathvariant="normal">min</mi
              ><mo>{</mo><mi>w</mi><mo stretchy="false">(</mo><mi>p</mi
              ><mo stretchy="false">)</mo><mo>:</mo><mi>s</mi
              ><mover><mo>↝</mo><mi>p</mi></mover
              ><mi>t</mi><mo>}</mo></math
            >
          </div>
          <p>
            <code>v₀ = s</code> und <code>vₖ = t</code>. <code>k</code> zählt
            die Kanten des Pfads. Ohne erreichbaren Pfad gilt
            <code>δ(s, t) = ∞</code>.<template v-if="!weighted">
              Für diese Suche gilt <code>w(e) = 1</code> und damit
              <code>w(p) = k</code>.</template
            >
          </p>
          <p v-if="current !== undefined && !result" class="notation-current">
            Suchschritt {{ step }} · Knoten <code>{{ current }}</code> ({{
              graph.nodes[current].label
            }})
          </p>
          <div
            v-if="result"
            class="notation-evaluation"
            aria-label="Auswertung des Suchlaufs"
          >
            <template v-if="evaluatedPath">
              <div class="notation-math">
                p = {{ evaluatedPath.sequence }} · k =
                {{ evaluatedPath.length }}
              </div>
              <div class="notation-math">
                w(p) =
                <template v-if="evaluatedPath.length > 1"
                  >{{ evaluatedPath.terms }} = </template
                >{{ result.distance }}
              </div>
            </template>
            <p v-else>
              {{
                result.limited
                  ? "Der Suchlauf endete am Schrittlimit."
                  : "Der Suchlauf hat keinen Pfad ausgegeben."
              }}
            </p>
            <div class="notation-math">
              δ({{ start }}, {{ target }}) =
              {{ displayNumber(referenceDistance) }}
            </div>
            <p v-if="evaluatedPath">
              {{
                result.distance === referenceDistance
                  ? "Der gefundene Pfad hat minimales Gewicht."
                  : `Der gefundene Pfad liegt um ${result.distance - referenceDistance} über dem Mindestgewicht.`
              }}
            </p>
            <p v-else-if="Number.isFinite(referenceDistance)">
              Die unabhängige Referenzsuche findet für diese Endpunkte einen
              Pfad.
            </p>
            <p v-else>
              Das Ziel ist im aktuellen Graphen vom Start aus unerreichbar.
            </p>
          </div>
        </div>
      </section>
    </div>
  </section>
</template>
