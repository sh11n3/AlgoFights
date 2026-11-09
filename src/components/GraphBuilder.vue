<script setup lang="ts">
import { computed, ref } from "vue";
import {
  ArrowLeftRight,
  CirclePlus,
  Link2,
  Move,
  Save,
  Trash2,
} from "lucide-vue-next";
import GraphBoard from "./GraphBoard.vue";
import {
  cloneLayout,
  MAX_EDGES,
  MAX_LAYOUTS,
  MAX_NODES,
  removeGraphNode,
  samePair,
  type GraphLayout,
} from "../graph/layouts";
import type { Point } from "../graph/presets";
import { createGraph } from "../graph/simulation";
import { GRAPH_LESSONS } from "../lab/catalog";
import { ROUTE_ALGORITHMS } from "../routing/types";
import { snapshotGraph, type Example } from "../sharing/examples";
import ShareExample from "./ShareExample.vue";

const props = defineProps<{
  initial: GraphLayout;
  canSave: boolean;
  shareMode?: "route";
  shareAlgorithm?: string;
}>();
const shareChoices =
  props.shareMode === "route"
    ? Object.entries(ROUTE_ALGORITHMS).map(([id, item]) => ({
        id,
        name: item.name,
      }))
    : GRAPH_LESSONS;
const shareAlgorithm = ref(
  shareChoices.some((c) => c.id === props.shareAlgorithm)
    ? props.shareAlgorithm!
    : shareChoices[0].id,
);
const shared = computed<Example | null>(() => {
  if (!draft.value.points.length || !draft.value.name.trim()) return null;
  const graph = snapshotGraph(draft.value);
  return props.shareMode === "route"
    ? {
        v: 1,
        kind: "graph-route",
        graph,
        algorithm: shareAlgorithm.value,
        limit: 100,
        delay: 360,
      }
    : {
        v: 1,
        kind: "graph-lesson",
        graph,
        algorithm: shareAlgorithm.value,
        mode: "source",
        limit: 2000,
        delay: 450,
      };
});
const emit = defineEmits<{
  save: [layout: GraphLayout];
  remove: [id: string];
}>();
const draft = ref(cloneLayout(props.initial));
const mode = ref<"node" | "edge" | "move">("node");
const selectedNode = ref<number | null>(null),
  selectedEdge = ref<number | null>(null);
const edgeCost = ref<number | string>(1);
const message = ref(""),
  confirming = ref(false);
const graph = computed(() =>
  createGraph(draft.value, draft.value.weighted, draft.value.directed),
);
const selected = computed(() =>
  selectedEdge.value === null
    ? undefined
    : draft.value.edges[selectedEdge.value],
);
const nameOf = (node: number) => graph.value.nodes[node]?.label ?? "—";
const hint = computed(() => {
  if (mode.value === "node")
    return "Tippe auf eine freie Stelle, um einen Knoten zu setzen. Ein Klick auf einen Knoten wählt ihn aus.";
  if (mode.value === "move")
    return selectedNode.value === null
      ? "Wähle den Knoten, den du verschieben möchtest."
      : `Tippe auf die neue Position für Knoten ${nameOf(selectedNode.value)}.`;
  return selectedNode.value === null
    ? "Wähle den ersten Knoten oder eine vorhandene Kante."
    : `Wähle das Ziel ab ${nameOf(selectedNode.value)}.${draft.value.directed ? " Erneuter Klick auf denselben Knoten erzeugt eine Schlinge." : ""}`;
});

function setMode(value: typeof mode.value) {
  mode.value = value;
  if (value === "edge") selectedNode.value = null;
  selectedEdge.value = null;
  message.value = "";
}
function cost(value: unknown) {
  return Math.max(-999, Math.min(999, Math.trunc(Number(value) || 0)));
}
function available([x, y]: Point, except: number | null = null) {
  return draft.value.points.every(
    ([px, py], id) => id === except || Math.hypot(x - px, y - py) >= 0.065,
  );
}
function add(point: Point) {
  if (draft.value.points.length >= MAX_NODES) {
    message.value = `Maximal ${MAX_NODES} Knoten pro Graph.`;
    return;
  }
  if (!available(point)) {
    message.value = "Die Position liegt zu nah an einem anderen Knoten.";
    return;
  }
  const id = draft.value.points.length;
  draft.value.points.push(point);
  selectedNode.value = id;
  selectedEdge.value = null;
  if (id === 0) draft.value.start = draft.value.target = 0;
  if (id === 1) draft.value.target = 1;
  message.value = `Knoten ${nameOf(id)} hinzugefügt.`;
}
function addWithButton() {
  const spots: Point[] = [
    [0.2, 0.5],
    [0.8, 0.5],
    [0.5, 0.2],
    [0.5, 0.8],
  ];
  for (let y = 0; y <= 10; y++)
    for (let x = 0; x <= 10; x++) spots.push([x / 10, y / 10]);
  const point = spots.find((position) => available(position));
  if (point) {
    setMode("node");
    add(point);
  }
}
function place(point: Point) {
  if (mode.value === "node") add(point);
  if (mode.value === "move" && selectedNode.value !== null) {
    if (!available(point, selectedNode.value)) {
      message.value = "Die Position liegt zu nah an einem anderen Knoten.";
      return;
    }
    draft.value.points[selectedNode.value] = point;
    message.value = `Knoten ${nameOf(selectedNode.value)} verschoben.`;
  }
}
function selectEdge(edge: number | null) {
  selectedNode.value = null;
  selectedEdge.value = edge;
  if (selected.value) edgeCost.value = selected.value[2];
  message.value = "";
}
function selectNode(node: number) {
  const from = selectedNode.value;
  selectedEdge.value = null;
  message.value = "";
  if (
    mode.value !== "edge" ||
    from === null ||
    (from === node && !draft.value.directed)
  ) {
    selectedNode.value = mode.value === "edge" && from === node ? null : node;
    return;
  }
  const existing = draft.value.edges.findIndex((edge) =>
    samePair(from, node, edge, draft.value.directed),
  );
  if (existing >= 0) {
    selectEdge(existing);
    message.value = "Diese Verbindung existiert bereits.";
    return;
  }
  if (draft.value.edges.length >= MAX_EDGES) {
    message.value = `Maximal ${MAX_EDGES} Kanten pro Graph.`;
    return;
  }
  draft.value.edges.push([from, node, cost(edgeCost.value)]);
  selectEdge(draft.value.edges.length - 1);
  message.value = "Kante hinzugefügt.";
}
function updateCost() {
  const value = cost(edgeCost.value);
  edgeCost.value = value;
  if (selected.value) selected.value[2] = value;
}
function reverseEdge() {
  if (!selected.value) return;
  const edge = selected.value;
  if (
    draft.value.edges.some(
      (other, id) =>
        id !== selectedEdge.value &&
        other[0] === edge[1] &&
        other[1] === edge[0],
    )
  ) {
    message.value = "Die umgekehrte Kante existiert bereits.";
    return;
  }
  [edge[0], edge[1]] = [edge[1], edge[0]];
}
function toggleDirected() {
  if (
    draft.value.directed &&
    (draft.value.edges.some((e) => e[0] === e[1]) ||
      draft.value.edges.some((e, i) =>
        draft.value.edges.some((f, j) => j < i && samePair(e[0], e[1], f)),
      ))
  ) {
    message.value =
      "Vor dem Umschalten Schlingen und doppelte Gegenverbindungen entfernen. Deine Kanten bleiben erhalten.";
    return;
  }
  draft.value.directed = !draft.value.directed;
}
function deleteEdge() {
  if (selectedEdge.value === null) return;
  draft.value.edges.splice(selectedEdge.value, 1);
  selectEdge(null);
  message.value = "Kante entfernt.";
}
function deleteNode() {
  if (selectedNode.value === null) return;
  removeGraphNode(draft.value, selectedNode.value);
  selectedNode.value = null;
  selectedEdge.value = null;
  message.value = "Knoten und zugehörige Kanten entfernt.";
}
function save() {
  updateCost();
  if (!props.canSave || !draft.value.points.length || !draft.value.name.trim())
    return;
  emit("save", cloneLayout({ ...draft.value, name: draft.value.name.trim() }));
}
</script>

<template>
  <section aria-label="Graph Builder">
    <div class="graph-layout">
      <section class="panel graph-panel" aria-label="Zeichenfläche">
        <div class="builder-toolbar">
          <div class="graph-toggles" role="group" aria-label="Werkzeuge">
            <button :aria-pressed="mode === 'node'" @click="setMode('node')">
              <CirclePlus :size="15" /> Knoten
            </button>
            <button :aria-pressed="mode === 'edge'" @click="setMode('edge')">
              <Link2 :size="15" /> Kante
            </button>
            <button :aria-pressed="mode === 'move'" @click="setMode('move')">
              <Move :size="15" /> Verschieben
            </button>
          </div>
          <span
            >{{ draft.points.length }} / {{ MAX_NODES }} Knoten ·
            {{ draft.edges.length }} / {{ MAX_EDGES }} Kanten</span
          >
        </div>
        <div class="graph-result builder-instruction">
          <span>{{ hint }}</span>
          <strong v-if="message" role="status">{{ message }}</strong>
        </div>
        <GraphBoard
          :preset="draft"
          :graph="graph"
          :weighted="draft.weighted"
          :directed="draft.directed"
          :start="draft.start"
          :target="draft.target"
          :builder="{ selectedNode, selectedEdge, edgeMode: mode === 'edge' }"
          @select="selectNode"
          @place="place"
          @select-edge="selectEdge"
        />
      </section>

      <section
        class="panel graph-settings builder-settings"
        aria-label="Graph bearbeiten"
      >
        <h2>Graph bearbeiten</h2>
        <label
          >Name des Graphen<input v-model="draft.name" maxlength="48"
        /></label>
        <button
          class="primary-button graph-run"
          :disabled="!canSave || !draft.points.length || !draft.name.trim()"
          @click="save"
        >
          <Save :size="16" /> Speichern und öffnen
        </button>
        <p v-if="!canSave" class="graph-field-help">
          Maximal {{ MAX_LAYOUTS }} gespeicherte Graphen. Du kannst den Entwurf
          weiterhin als Beispiel teilen.
        </p>
        <div
          class="graph-toggles"
          role="group"
          aria-label="Kanteneigenschaften"
        >
          <button
            :aria-pressed="draft.weighted"
            @click="draft.weighted = !draft.weighted"
          >
            Gewichtet
          </button>
          <button :aria-pressed="draft.directed" @click="toggleDirected">
            Gerichtet
          </button>
        </div>
        <div class="builder-fields">
          <label
            >Start<select
              v-model="draft.start"
              :disabled="!draft.points.length"
            >
              <option v-if="!draft.points.length" :value="-1">—</option>
              <option
                v-for="node in graph.nodes"
                :key="node.id"
                :value="node.id"
              >
                {{ node.label }}
              </option>
            </select></label
          >
          <label
            >Ziel<select
              v-model="draft.target"
              :disabled="!draft.points.length"
            >
              <option v-if="!draft.points.length" :value="-1">—</option>
              <option
                v-for="node in graph.nodes"
                :key="node.id"
                :value="node.id"
              >
                {{ node.label }}
              </option>
            </select></label
          >
        </div>
        <div class="builder-tools">
          <button
            class="secondary-button"
            :disabled="draft.points.length >= MAX_NODES"
            @click="addWithButton"
          >
            <CirclePlus :size="15" /> Knoten hinzufügen
          </button>
          <button
            class="icon-button"
            :disabled="selectedNode === null"
            aria-label="Ausgewählten Knoten löschen"
            title="Ausgewählten Knoten löschen"
            @click="deleteNode"
          >
            <Trash2 :size="16" />
          </button>
        </div>
        <label
          >Kante bearbeiten<select
            :value="selectedEdge ?? ''"
            :disabled="!draft.edges.length"
            @change="
              selectEdge(
                ($event.target as HTMLSelectElement).value === ''
                  ? null
                  : Number(($event.target as HTMLSelectElement).value),
              )
            "
          >
            <option value="">Kante auswählen …</option>
            <option
              v-for="([from, to], id) in draft.edges"
              :key="id"
              :value="id"
            >
              {{ nameOf(from) }} {{ draft.directed ? "→" : "—" }}
              {{ nameOf(to) }}
            </option>
          </select></label
        >
        <label
          >{{ selected ? "Kosten der Kante" : "Kosten für neue Kante"
          }}<input
            v-model="edgeCost"
            type="number"
            min="-999"
            max="999"
            step="1"
            @change="updateCost"
        /></label>
        <div v-if="selected" class="builder-tools">
          <button
            class="secondary-button"
            :disabled="!draft.directed"
            @click="reverseEdge"
          >
            <ArrowLeftRight :size="15" /> Richtung umkehren
          </button>
          <button
            class="icon-button"
            aria-label="Ausgewählte Kante löschen"
            title="Ausgewählte Kante löschen"
            @click="deleteEdge"
          >
            <Trash2 :size="16" />
          </button>
        </div>
        <div class="builder-share">
          <label
            >Verfahren für Beispiel-Link<select v-model="shareAlgorithm">
              <option
                v-for="item in shareChoices"
                :key="item.id"
                :value="item.id"
              >
                {{ item.name }}
              </option>
            </select></label
          >
          <ShareExample
            :example="shared"
            reason="Zuerst mindestens einen Knoten und einen Namen anlegen."
          />
        </div>
        <div v-if="draft.id && !confirming" class="builder-tools">
          <button class="secondary-button" @click="confirming = true">
            <Trash2 :size="16" /> Gespeicherten Graph löschen
          </button>
        </div>
        <div
          v-if="confirming"
          class="builder-confirm"
          role="group"
          aria-label="Graph löschen bestätigen"
        >
          <p>Gespeicherten Graph „{{ initial.name }}“ löschen?</p>
          <button class="secondary-button" @click="emit('remove', draft.id)">
            Graph löschen
          </button>
          <button class="secondary-button" @click="confirming = false">
            Behalten
          </button>
        </div>
      </section>
    </div>
  </section>
</template>
