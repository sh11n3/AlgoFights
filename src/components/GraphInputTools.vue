<script setup lang="ts">
import { computed, ref, watch } from "vue";
import {
  completeGraph,
  cubeGraph,
  graphFromMatrix,
  gridEdges,
  mazeGraph,
  petersenGraph,
} from "../graph/exercise-inputs";
import { MAX_NODES, type GraphLayout } from "../graph/layouts";
import { nodeLabel } from "../graph/simulation";

const props = defineProps<{ initialTool?: "maze" }>();
const emit = defineEmits<{ apply: [layout: GraphLayout] }>();
const open = ref(!!props.initialTool);
const tool = ref<"matrix" | "maze" | "complete" | "cube" | "petersen">(
  props.initialTool ?? "matrix",
);
const weighted = ref(false),
  directed = ref(true);
const matrix = ref("0 1 0 1\n0 0 1 0\n0 0 0 1\n0 0 0 0");
const order = ref(5),
  dimension = ref(3);
const rows = ref(4),
  columns = ref(4),
  start = ref(0),
  target = ref(15);
const walls = ref(new Set<string>()),
  picking = ref<"start" | "target">("start");
const error = ref(""),
  notice = ref("");
const size = computed(() => rows.value * columns.value);
const links = computed(() =>
  size.value <= MAX_NODES ? gridEdges(rows.value, columns.value) : [],
);
const gridStyle = computed(() => ({
  gridTemplateColumns: `repeat(${columns.value - 1}, minmax(25px, 1fr) 22px) minmax(25px, 1fr)`,
  gridTemplateRows: `repeat(${rows.value - 1}, 42px 22px) 42px`,
}));
watch([rows, columns], () => {
  start.value = 0;
  target.value = size.value - 1;
  walls.value = new Set();
  notice.value = "";
});
watch(tool, () => {
  error.value = "";
  notice.value = "";
});
function toggleWall(u: number, v: number) {
  const key = `${u}:${v}`;
  if (!walls.value.delete(key)) walls.value.add(key);
}
function field(id: number) {
  return {
    gridColumn: 2 * (id % columns.value) + 1,
    gridRow: 2 * Math.floor(id / columns.value) + 1,
  };
}
function wallPosition(u: number, v: number) {
  const cell = field(u);
  return {
    gridColumn: cell.gridColumn + Number(v === u + 1),
    gridRow: cell.gridRow + Number(v !== u + 1),
  };
}
function selectField(id: number) {
  if (picking.value === "start") start.value = id;
  else target.value = id;
}
function apply() {
  error.value = "";
  notice.value = "";
  try {
    let layout: GraphLayout;
    switch (tool.value) {
      case "matrix":
        layout = graphFromMatrix(matrix.value, weighted.value, directed.value);
        break;
      case "maze":
        layout = mazeGraph(
          rows.value,
          columns.value,
          walls.value,
          start.value,
          target.value,
        );
        break;
      case "complete":
        layout = completeGraph(Number(order.value));
        break;
      case "cube":
        layout = cubeGraph(Number(dimension.value));
        break;
      case "petersen":
        layout = petersenGraph();
        break;
    }
    emit("apply", layout);
    notice.value = `${layout.name} im Entwurf: ${layout.points.length} Knoten, ${layout.edges.length} Kanten.`;
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : String(cause);
  }
}
</script>

<template>
  <details
    class="panel graph-input-tools experiment-reference"
    :open="open"
    @toggle="open = ($event.currentTarget as HTMLDetailsElement).open"
  >
    <summary>Graph aus Matrix, Labyrinth oder Vorlage erzeugen</summary>
    <div class="graph-input-fields">
      <label
        >Eingabeart<select v-model="tool">
          <option value="matrix">Matrix einfügen</option>
          <option value="maze">Labyrinth zeichnen</option>
          <option value="complete">Vollständiger Graph Kₙ</option>
          <option value="cube">Würfelgraph Qᵈ</option>
          <option value="petersen">Petersen-Graph</option>
        </select></label
      >
      <template v-if="tool === 'matrix'">
        <div class="experiment-inputs">
          <label
            >Matrixtyp<select v-model="weighted">
              <option :value="false">Adjazenzmatrix (0/1)</option>
              <option :value="true">Gewichtungsmatrix</option>
            </select></label
          >
          <label
            >Richtung<select v-model="directed">
              <option :value="true">Gerichtet</option>
              <option :value="false">Ungerichtet (symmetrisch)</option>
            </select></label
          >
        </div>
        <label
          >Quadratische Matrix<textarea
            v-model="matrix"
            rows="5"
            maxlength="12000"
            spellcheck="false"
          />
        </label>
        <p class="graph-field-help">
          Eine Zeile pro Knoten, Werte durch Leerzeichen oder Kommas trennen.
          JSON-Zeilenarrays gehen ebenfalls.
          {{
            weighted
              ? "∞ oder „inf“ bedeutet keine Kante; 0 außerhalb der Diagonale ist ein echtes Gewicht."
              : "1 steht für eine Kante, 0 für keine Kante."
          }}
        </p>
      </template>
      <template v-else-if="tool === 'maze'">
        <div class="experiment-inputs">
          <label
            >Zeilen<select v-model.number="rows">
              <option v-for="n in [2, 3, 4, 5, 6, 7, 8]" :key="n">
                {{ n }}
              </option>
            </select></label
          >
          <label
            >Spalten<select v-model.number="columns">
              <option v-for="n in [2, 3, 4, 5, 6, 7, 8]" :key="n">
                {{ n }}
              </option>
            </select></label
          >
        </div>
        <p v-if="size > MAX_NODES" class="graph-field-help" role="status">
          Höchstens {{ MAX_NODES }} Felder.
        </p>
        <template v-else>
          <div
            class="graph-toggles maze-controls"
            role="group"
            aria-label="Feld im Labyrinth setzen"
          >
            <button
              :aria-pressed="picking === 'start'"
              @click="picking = 'start'"
            >
              Start setzen
            </button>
            <button
              :aria-pressed="picking === 'target'"
              @click="picking = 'target'"
            >
              Ziel setzen
            </button>
          </div>
          <p class="graph-field-help">
            Feld anklicken, um Start oder Ziel zu setzen. Die Schalter zwischen
            den Feldern öffnen und schließen Wände.
          </p>
          <div class="maze-grid" :style="gridStyle" aria-label="Labyrinth">
            <button
              v-for="id in size"
              :key="`field-${id}`"
              class="maze-cell"
              :style="field(id - 1)"
              :class="{
                'maze-start': id - 1 === start,
                'maze-target': id - 1 === target,
              }"
              :aria-label="`Feld ${nodeLabel(id - 1)}${id - 1 === start ? ', Start' : ''}${id - 1 === target ? ', Ziel' : ''}`"
              @click="selectField(id - 1)"
            >
              {{ nodeLabel(id - 1)
              }}<small v-if="id - 1 === start || id - 1 === target"
                >{{ id - 1 === start ? "S" : ""
                }}{{ id - 1 === target ? "Z" : "" }}</small
              >
            </button>
            <button
              v-for="[u, v] in links"
              :key="`wall-${u}:${v}`"
              class="maze-wall"
              :style="wallPosition(u, v)"
              :aria-pressed="walls.has(`${u}:${v}`)"
              :aria-label="`Wand zwischen ${nodeLabel(u)} und ${nodeLabel(v)}`"
              @click="toggleWall(u, v)"
            >
              {{ walls.has(`${u}:${v}`) ? (v === u + 1 ? "│" : "─") : "·" }}
            </button>
          </div>
        </template>
      </template>
      <template v-else-if="tool === 'complete'">
        <label
          >Knotenanzahl<input
            v-model.number="order"
            type="number"
            min="1"
            max="14"
        /></label>
        <p class="graph-field-help">
          Kₙ verbindet jedes Paar verschiedener Knoten. Die Zahl seiner Kanten
          ist n(n−1)/2.
        </p>
      </template>
      <template v-else-if="tool === 'cube'">
        <label
          >Dimension<select v-model.number="dimension">
            <option v-for="d in [2, 3, 4, 5]" :key="d">{{ d }}</option>
          </select></label
        >
        <p class="graph-field-help">
          2ᵈ Knoten. Jede Kante ändert genau ein Bit. Jeder Knoten hat Grad d,
          also gibt es d·2ᵈ⁻¹ Kanten.
        </p>
      </template>
      <p v-else class="graph-field-help">
        Zehn Knoten, jeweils drei Nachbarn. Geeignet zum Untersuchen von
        Färbungen und Hamiltonpfaden.
      </p>
      <button
        class="primary-button"
        :disabled="tool === 'maze' && size > MAX_NODES"
        @click="apply"
      >
        In Entwurf übernehmen
      </button>
      <p v-if="error" class="graph-field-help" role="alert">{{ error }}</p>
      <p v-if="notice" class="graph-field-help" role="status">{{ notice }}</p>
    </div>
  </details>
</template>
