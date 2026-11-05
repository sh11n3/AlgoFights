<script setup lang="ts">
import {
  computed,
  defineAsyncComponent,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  shallowRef,
  watch,
} from "vue";
import {
  ArrowLeft,
  ArrowLeftRight,
  CodeXml,
  LoaderCircle,
  Network,
  Pause,
  Play,
  RotateCcw,
  SkipBack,
  SkipForward,
} from "lucide-vue-next";
import GraphBoard from "./GraphBoard.vue";
import GraphBuilder from "./GraphBuilder.vue";
import { PRESETS } from "../graph/presets";
import {
  cloneLayout,
  LAYOUT_STORAGE_KEY,
  MAX_LAYOUTS,
  readLayouts,
  type GraphLayout,
} from "../graph/layouts";
import {
  createGraph,
  GRAPH_ALGORITHMS,
  graphHeuristic,
  graphResult,
  searchTeachingGraph,
} from "../graph/simulation";
import { runRouteCode } from "../services/route-sandbox";
import { readStrategies, store } from "../services/storage";
import type { CustomStrategy } from "../core/types";
import type { RouteAlgorithm } from "../routing/types";
import "../graph/style.css";

const StrategyEditor = defineAsyncComponent(
  () => import("./StrategyEditor.vue"),
);
const customStrategies = ref(readStrategies("graphs", "graph:"));
const editorSource = ref(""),
  editorShown = ref(false),
  editorHost = ref<HTMLElement>();
const storageNotice = ref("");
const layoutNotice = ref("");
const layouts = ref(readLayouts());
const builder = shallowRef<GraphLayout>();
const graphHost = ref<HTMLElement>();
const presetId = ref(PRESETS[0].id),
  algorithm = ref("dijkstra");
const preset = computed(
  () =>
    layouts.value.find((item) => item.id === presetId.value) ??
    PRESETS.find((item) => item.id === presetId.value) ??
    PRESETS[0],
);
const weighted = ref(true),
  directed = ref(false);
const start = ref(preset.value.start),
  target = ref(preset.value.target);
const selecting = ref<"start" | "target">("target");
const graph = computed(() =>
  createGraph(preset.value, weighted.value, directed.value),
);
const limitInput = ref<number | string>(100);
const stepLimit = computed(() =>
  Math.max(1, Math.min(500, Math.trunc(Number(limitInput.value) || 1))),
);
const delay = ref(360);
const custom = computed(() =>
  customStrategies.value.find((item) => item.id === algorithm.value),
);
const description = computed(
  () =>
    GRAPH_ALGORITHMS[algorithm.value as RouteAlgorithm]?.description ??
    (custom.value
      ? "Lokal gespeicherter JavaScript-Algorithmus."
      : "Beginne im Editor mit einem leeren Codefeld."),
);

const result = shallowRef<ReturnType<typeof graphResult>>();
const step = ref(0),
  playing = ref(false),
  busy = ref(false),
  error = ref("");
let timer: ReturnType<typeof setTimeout> | undefined;
let activeRun: AbortController | undefined;
const total = computed(() => result.value?.traceNodes.length ?? 0);
const atEnd = computed(() => !!result.value && step.value >= total.value);
const shownPath = computed(() =>
  atEnd.value && result.value?.found ? result.value.path : undefined,
);
const trace = computed(() => {
  const visited = new Map<number, number>(),
    edges = new Map<number, number>();
  const run = result.value;
  if (!run) return { visited, edges };
  for (let index = 0; index < step.value; index++) {
    const node = run.traceNodes[index],
      edge = run.traceEdges[index],
      side = run.traceSides[index];
    visited.set(node, side);
    if (edge >= 0) edges.set(graph.value.arcs[edge].segment, side);
  }
  const current = run.traceNodes[step.value - 1];
  const arc = graph.value.arcs[run.traceEdges[step.value - 1]];
  const source = run.traceSides[step.value - 1] === 1 ? arc?.to : arc?.from;
  return { visited, edges, current, source };
});
const status = computed(() => {
  if (busy.value) return "Suche wird berechnet";
  if (error.value) return "Fehler bei der Suche";
  if (!result.value) return "Bereit";
  if (!atEnd.value)
    return playing.value
      ? "Suche läuft"
      : step.value
        ? "Pausiert"
        : "Am Anfang";
  if (result.value.limited) return "Schrittlimit erreicht";
  if (!result.value.found) return "Kein Weg gefunden";
  return "Ziel erreicht";
});
const pathLabels = computed(() =>
  shownPath.value
    ? [
        start.value,
        ...Array.from(shownPath.value, (arc) => graph.value.arcs[arc].to),
      ]
        .map((node) => graph.value.nodes[node].label)
        .join(" → ")
    : "",
);
const currentLabel = computed(() =>
  trace.value.current === undefined
    ? ""
    : graph.value.nodes[trace.value.current].label,
);

function pause() {
  clearTimeout(timer);
  playing.value = false;
}
function tick() {
  if (!playing.value) return;
  step.value++;
  if (atEnd.value) pause();
  else timer = setTimeout(tick, delay.value);
}
function play() {
  if (!result.value || total.value === 0) return;
  if (atEnd.value) step.value = 0;
  playing.value = true;
  timer = setTimeout(tick, delay.value);
}
function seek(value: number) {
  pause();
  step.value = Math.max(0, Math.min(total.value, value));
}
function cancel() {
  activeRun?.abort();
  activeRun = undefined;
  busy.value = false;
}
function clear() {
  cancel();
  pause();
  result.value = undefined;
  step.value = 0;
  error.value = "";
}
async function run() {
  clear();
  limitInput.value = stepLimit.value;
  const controller = new AbortController();
  activeRun = controller;
  busy.value = true;
  const network = graph.value,
    from = start.value,
    to = target.value;
  const options = {
    heuristic: graphHeuristic(network, to),
    stepLimit: stepLimit.value,
    weighted: weighted.value,
    directed: directed.value,
  };
  try {
    const output = custom.value
      ? await runRouteCode(
          network,
          from,
          to,
          custom.value.code,
          controller.signal,
          options,
        )
      : searchTeachingGraph(
          network,
          from,
          to,
          algorithm.value as RouteAlgorithm,
          options.stepLimit,
          options.heuristic,
        );
    if (activeRun !== controller) return;
    result.value = graphResult(network, from, to, output);
    play();
  } catch (cause) {
    if (activeRun === controller)
      error.value = `${custom.value?.name ?? "Suche"}: ${cause instanceof Error ? cause.message : String(cause)}`;
  } finally {
    if (activeRun === controller) {
      activeRun = undefined;
      busy.value = false;
    }
  }
}
function selectNode(node: number) {
  if (selecting.value === "start") start.value = node;
  else target.value = node;
}
function swap() {
  [start.value, target.value] = [target.value, start.value];
}
function openBuilder(copy: boolean) {
  pause();
  cancel();
  if (copy) {
    const current = preset.value;
    const own = layouts.value.some((item) => item.id === current.id);
    builder.value = cloneLayout({
      ...current,
      weighted: weighted.value,
      directed: directed.value,
      start: start.value,
      target: target.value,
      id: own ? current.id : "",
      name: own ? current.name : `${current.name} – Kopie`.slice(0, 48),
      description: "Lokal erstellter Graph.",
    });
  } else {
    builder.value = {
      id: "",
      name: "Mein Graph",
      description: "Lokal erstellter Graph.",
      weighted: true,
      directed: false,
      points: [],
      edges: [],
      start: -1,
      target: -1,
    };
  }
  graphHost.value?.scrollIntoView({ block: "start", behavior: "instant" });
}
function persistLayouts() {
  layoutNotice.value = store(LAYOUT_STORAGE_KEY, layouts.value)
    ? ""
    : "Der Browser konnte die Änderung nicht dauerhaft speichern.";
}
function saveLayout(layout: GraphLayout) {
  if (layout.id)
    layouts.value = layouts.value.map((item) =>
      item.id === layout.id ? layout : item,
    );
  else {
    if (layouts.value.length >= MAX_LAYOUTS) return;
    layout.id = `layout:${crypto.randomUUID()}`;
    layouts.value = [...layouts.value, layout];
  }
  presetId.value = layout.id;
  persistLayouts();
  builder.value = undefined;
}
function removeLayout(id: string) {
  if (presetId.value === id) presetId.value = PRESETS[0].id;
  layouts.value = layouts.value.filter((item) => item.id !== id);
  persistLayouts();
  builder.value = undefined;
}
async function openEditor() {
  pause();
  editorSource.value =
    algorithm.value === "new" || custom.value
      ? algorithm.value
      : `builtin:${algorithm.value}`;
  editorShown.value = true;
  await nextTick();
  editorHost.value?.scrollIntoView({ behavior: "instant", block: "start" });
}
function saveStrategy(strategy: CustomStrategy) {
  const index = customStrategies.value.findIndex(
    (item) => item.id === strategy.id,
  );
  if (index < 0 && customStrategies.value.length >= 30) {
    storageNotice.value =
      "Höchstens 30 eigene Graphalgorithmen. Bitte zuerst einen löschen.";
    return;
  }
  if (index < 0) customStrategies.value.push(strategy);
  else customStrategies.value[index] = strategy;
  storageNotice.value = store("graphs", customStrategies.value)
    ? ""
    : "Lokales Speichern fehlgeschlagen. Du kannst den Code exportieren.";
  algorithm.value = strategy.id;
  clear();
}
function removeStrategy(id: string) {
  customStrategies.value = customStrategies.value.filter(
    (item) => item.id !== id,
  );
  storageNotice.value = store("graphs", customStrategies.value)
    ? ""
    : "Die Änderung konnte nicht lokal gespeichert werden.";
  if (algorithm.value === id) algorithm.value = "dijkstra";
}
watch(preset, (item) => {
  start.value = item.start;
  target.value = item.target;
  if (item.weighted !== undefined) weighted.value = item.weighted;
  if (item.directed !== undefined) directed.value = item.directed;
});
watch([preset, weighted, directed, start, target, algorithm, stepLimit], clear);
watch(algorithm, (value) => {
  if (value === "new") void openEditor();
});
function onVisibilityChange() {
  if (document.hidden) pause();
}
onMounted(() =>
  document.addEventListener("visibilitychange", onVisibilityChange),
);
onBeforeUnmount(() => {
  clear();
  document.removeEventListener("visibilitychange", onVisibilityChange);
});
</script>

<template>
  <section ref="graphHost" class="graph-sim" aria-label="Graph Sim">
    <header class="graph-heading">
      <div>
        <h1>{{ builder ? "Graph Builder" : "Graph Sim" }}</h1>
        <p>
          {{
            builder
              ? "Knoten und Kanten zeichnen"
              : `${PRESETS.length} Vorlagen und eigene Graphen`
          }}
        </p>
      </div>
      <div v-if="!builder" class="graph-heading-actions">
        <button class="secondary-button" @click="openEditor">
          <CodeXml :size="17" /> Code-Editor
        </button>
        <button class="primary-button" @click="openBuilder(false)">
          <Network :size="17" /> Graph Builder
        </button>
      </div>
      <button v-else class="secondary-button" @click="builder = undefined">
        <ArrowLeft :size="15" /> Abbrechen
      </button>
    </header>

    <GraphBuilder
      v-if="builder"
      :initial="builder"
      :can-save="!!builder.id || layouts.length < MAX_LAYOUTS"
      @save="saveLayout"
      @remove="removeLayout"
    />
    <div v-else class="graph-layout">
      <section class="panel graph-panel" aria-label="Graph und Wiedergabe">
        <div class="graph-readout">
          <div class="graph-readout-title">
            <h2>{{ preset.name }}</h2>
            <span
              >{{ graph.nodes.length }} Knoten · {{ preset.edges.length }}
              {{ preset.edges.length === 1 ? "Kante" : "Kanten" }}</span
            >
          </div>
          <div>
            <span>Suchschritte</span
            ><strong class="search-value"
              >{{ step }} <small v-if="result">/ {{ total }}</small></strong
            >
          </div>
          <div>
            <span>Wegkanten</span
            ><strong>{{ shownPath?.length ?? "—" }}</strong>
          </div>
          <div>
            <span>Kosten</span
            ><strong class="path-value">{{
              shownPath ? result?.distance : "—"
            }}</strong>
          </div>
        </div>
        <GraphBoard
          :preset="preset"
          :graph="graph"
          :weighted="weighted"
          :directed="directed"
          :start="start"
          :target="target"
          :visited="trace.visited"
          :search-edges="trace.edges"
          :current="trace.current"
          :source="trace.source"
          :tempo="delay"
          :step="step"
          :path="shownPath"
          @select="selectNode"
        />
        <div class="graph-legend">
          <span class="graph-start-key">Start</span
          ><span class="graph-target-key">Ziel</span
          ><span class="search-key">Suche</span>
          <span
            v-if="algorithm === 'bidirectional' || custom"
            class="backward-key"
            >Rückwärtssuche</span
          >
          <span class="route-key">Gefundener Weg</span>
        </div>
        <div class="graph-playback">
          <button
            class="icon-button"
            aria-label="Zum Anfang"
            title="Zum Anfang"
            :disabled="!result || step === 0"
            @click="seek(0)"
          >
            <RotateCcw :size="17" />
          </button>
          <button
            class="icon-button"
            aria-label="Vorheriger Suchschritt"
            title="Vorheriger Suchschritt"
            :disabled="step === 0"
            @click="seek(step - 1)"
          >
            <SkipBack :size="17" />
          </button>
          <button
            class="icon-button"
            :aria-label="
              playing ? 'Wiedergabe pausieren' : 'Wiedergabe starten'
            "
            :title="playing ? 'Pause' : 'Wiedergabe'"
            :disabled="!total"
            @click="playing ? pause() : play()"
          >
            <Pause v-if="playing" :size="18" /><Play v-else :size="18" />
          </button>
          <button
            class="icon-button"
            aria-label="Nächster Suchschritt"
            title="Nächster Suchschritt"
            :disabled="step >= total"
            @click="seek(step + 1)"
          >
            <SkipForward :size="17" />
          </button>
          <input
            type="range"
            min="0"
            :max="total || 1"
            :value="step"
            :disabled="!total"
            aria-label="Fortschritt der Graphsuche"
            :style="{ '--progress': `${total ? (step / total) * 100 : 0}%` }"
            @input="seek(Number(($event.target as HTMLInputElement).value))"
          />
          <span class="graph-frame">{{ step }} / {{ total }}</span>
        </div>
        <div class="graph-result">
          <strong role="status">{{ status }}</strong>
          <span v-if="error" role="alert">{{ error }}</span>
          <span v-else-if="pathLabels"
            >{{ pathLabels
            }}<template v-if="!total">
              · Kein Suchprotokoll aufgezeichnet</template
            ></span
          >
          <span v-else-if="atEnd && result?.limited"
            >{{ total }} Expansionen ausgeführt. Starte mit einem höheren Limit
            neu.</span
          >
          <span v-else-if="atEnd"
            >Prüfe die Endpunkte oder die Richtung der Kanten.</span
          >
          <span v-else-if="currentLabel"
            >{{
              trace.visited.get(trace.current!) === 1
                ? "Rückwärts expandiert"
                : "Expandiert"
            }}: Knoten {{ currentLabel }}</span
          >
          <span v-else
            >Wähle {{ selecting === "start" ? "den Start" : "das Ziel" }} direkt
            im Graphen oder in den Einstellungen.</span
          >
        </div>
      </section>

      <section class="panel graph-settings" aria-label="Suche konfigurieren">
        <h2>Suche konfigurieren</h2>
        <label
          >Graph<select v-model="presetId">
            <optgroup label="Vorlagen">
              <option v-for="item in PRESETS" :key="item.id" :value="item.id">
                {{ item.name }}
              </option>
            </optgroup>
            <optgroup v-if="layouts.length" label="Eigene Graphen">
              <option v-for="item in layouts" :key="item.id" :value="item.id">
                {{ item.name }}
              </option>
            </optgroup>
          </select></label
        >
        <p class="graph-field-help">{{ preset.description }}</p>
        <button
          class="secondary-button graph-edit-button"
          @click="openBuilder(true)"
        >
          <Network :size="14" /> Im Builder öffnen
        </button>
        <div
          class="graph-toggles"
          role="group"
          aria-label="Kanteneigenschaften"
        >
          <button :aria-pressed="weighted" @click="weighted = !weighted">
            Gewichtet
          </button>
          <button :aria-pressed="directed" @click="directed = !directed">
            Gerichtet
          </button>
        </div>
        <div class="graph-endpoints">
          <label
            >Start<select v-model="start">
              <option
                v-for="node in graph.nodes"
                :key="node.id"
                :value="node.id"
              >
                {{ node.label }}
              </option>
            </select></label
          >
          <button
            class="icon-button"
            title="Start und Ziel tauschen"
            aria-label="Start und Ziel tauschen"
            @click="swap"
          >
            <ArrowLeftRight :size="17" />
          </button>
          <label
            >Ziel<select v-model="target">
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
        <div
          class="graph-toggles graph-pick"
          role="group"
          aria-label="Klick im Graphen setzt"
        >
          <button
            :aria-pressed="selecting === 'start'"
            @click="selecting = 'start'"
          >
            Start setzen
          </button>
          <button
            :aria-pressed="selecting === 'target'"
            @click="selecting = 'target'"
          >
            Ziel setzen
          </button>
        </div>
        <label
          >Algorithmus<select v-model="algorithm">
            <optgroup label="Eingebaute Algorithmen">
              <option
                v-for="(info, id) in GRAPH_ALGORITHMS"
                :key="id"
                :value="id"
              >
                {{ info.name }}
              </option>
            </optgroup>
            <optgroup v-if="customStrategies.length" label="Eigene Algorithmen">
              <option
                v-for="item in customStrategies"
                :key="item.id"
                :value="item.id"
              >
                {{ item.name }}
              </option>
            </optgroup>
            <option value="new">Eigenen Algorithmus bauen</option>
          </select></label
        >
        <p class="graph-field-help">{{ description }}</p>
        <label
          >Schrittlimit<input
            v-model="limitInput"
            type="number"
            min="1"
            max="500"
            step="1"
            @blur="limitInput = stepLimit"
        /></label>
        <p class="graph-field-help">
          Ein Schritt zählt, wenn die Suche einen Knoten expandiert. Der Start
          zählt mit.
        </p>
        <label
          >Tempo<select v-model="delay">
            <option :value="720">Langsam</option>
            <option :value="360">Normal</option>
            <option :value="160">Schnell</option>
          </select></label
        >
        <button v-if="busy" class="secondary-button graph-run" @click="cancel">
          <LoaderCircle :size="17" class="spin" /> Suche abbrechen
        </button>
        <button
          v-else
          class="primary-button graph-run"
          :disabled="algorithm === 'new'"
          @click="run"
        >
          <Play :size="17" /> Suche starten
        </button>
      </section>
    </div>

    <p v-if="layoutNotice" class="graph-field-help" role="status">
      {{ layoutNotice }}
    </p>
    <div
      v-if="editorShown"
      v-show="!builder"
      ref="editorHost"
      class="graph-editor-host"
    >
      <StrategyEditor
        mode="graph"
        :source-id="editorSource"
        :strategies="customStrategies"
        @save="saveStrategy"
        @remove="removeStrategy"
        @close="editorShown = false"
      />
      <p v-if="storageNotice" class="graph-field-help" role="status">
        {{ storageNotice }}
      </p>
    </div>
  </section>
</template>
