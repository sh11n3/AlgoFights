<script setup lang="ts">
import {
  computed,
  defineAsyncComponent,
  nextTick,
  onBeforeUnmount,
  ref,
  shallowRef,
  watch,
} from "vue";
import { CodeXml, Network, Play, Square, Download } from "lucide-vue-next";
import GraphBoard from "./GraphBoard.vue";
import GraphBuilder from "./GraphBuilder.vue";
import GraphFacts from "./GraphFacts.vue";
import StringBoard from "./StringBoard.vue";
import LabState from "./LabState.vue";
import LabPlayback from "./LabPlayback.vue";
import { GRAPH_LESSONS, STRING_LESSONS } from "../lab/catalog";
import { LAB_PRESETS } from "../lab/presets";
import { PRESETS } from "../graph/presets";
import {
  cloneLayout,
  readLayouts,
  projectEdges,
  MAX_LAYOUTS,
  LAYOUT_STORAGE_KEY,
  type GraphLayout,
} from "../graph/layouts";
import { createGraph } from "../graph/simulation";
import { readOwn, type OwnLesson } from "../lab/storage";
import { store } from "../services/storage";
import { runLesson } from "../services/lesson-runner";
import type { LabInput, LabResult } from "../lab/types";
import "../lab/style.css";
const LessonEditor = defineAsyncComponent(() => import("./LessonEditor.vue"));
const props = defineProps<{ kind: "graph" | "string" }>();
const isGraph = props.kind === "graph",
  lessons = isGraph ? GRAPH_LESSONS : STRING_LESSONS;
const categories = [...new Set(lessons.map((l) => l.category))];
const category = ref(isGraph ? "Traversierung" : categories[0]),
  selected = ref(isGraph ? "bfs" : "levenshtein"),
  base = ref(selected.value);
const own = ref(readOwn(props.kind)),
  activeOwn = computed(() => own.value.find((v) => v.id === selected.value));
const lesson = computed(
  () =>
    lessons.find(
      (v) =>
        v.id ===
        (activeOwn.value?.base ??
          (selected.value === "new" ? base.value : selected.value)),
    ) ?? lessons[0],
);
const layouts = ref(readLayouts()),
  presets = [...PRESETS, ...LAB_PRESETS],
  presetId = ref(PRESETS[0].id);
const preset = computed(
  () =>
    layouts.value.find((v) => v.id === presetId.value) ??
    presets.find((v) => v.id === presetId.value) ??
    PRESETS[0],
);
const weighted = ref(true),
  directed = ref(false),
  start = ref(0),
  target = ref(4),
  mode = ref<LabInput["mode"]>("source"),
  limit = ref(2000),
  delay = ref(450),
  step = ref(0);
const s = ref("garten"),
  t = ref("karten");
const result = shallowRef<LabResult>(),
  error = ref(""),
  notice = ref(""),
  busy = ref(false),
  editorOpen = ref(false),
  editorHost = ref<HTMLElement>(),
  editorBlank = ref(false);
const runName = ref(""),
  runSource = ref("");
const builder = shallowRef<GraphLayout>();
let controller: AbortController | undefined;
const xmlMode = ref(false),
  xmlText = ref(
    '<sammlung>\n  <buch titel="Graphen"><kapitel thema="Pfade"/><kapitel thema="Bäume"/></buch>\n  <buch titel="Texte"><kapitel thema="Mustersuche"/></buch>\n</sammlung>',
  ),
  xpath = ref("//kapitel"),
  xmlError = ref(""),
  xmlLayout = shallowRef<GraphLayout>(),
  xmlTags = ref<string[]>([]),
  xmlSelected = ref<number[]>([]);
let xmlDocument: Document | undefined,
  xmlElements: Element[] = [];
const effective = computed(() =>
  xmlMode.value && xmlLayout.value ? xmlLayout.value : preset.value,
);
const network = computed(() =>
  createGraph(
    effective.value,
    xmlMode.value ? false : weighted.value,
    xmlMode.value ? true : directed.value,
  ),
);
const input = computed<LabInput>(() => ({
  kind: props.kind,
  nodes: network.value.nodes,
  edges: projectEdges(
    effective.value.edges,
    xmlMode.value || directed.value,
  ).map(([from, to, cost]) => ({
    from,
    to,
    weight: xmlMode.value || !weighted.value ? 1 : cost,
  })),
  directed: xmlMode.value || directed.value,
  start: Math.min(start.value, network.value.nodes.length - 1),
  target: Math.min(target.value, network.value.nodes.length - 1),
  mode: [
    "cycle",
    "topology",
    "components",
    "union",
    "kosaraju",
    "kruskal",
    "prim",
    "trees",
  ].includes(lesson.value.id)
    ? "all"
    : mode.value,
  s: s.value,
  t: t.value,
}));
// Keep segment IDs identical to input.edges (undirected display omits directed loops).
const displayPreset = computed(() => ({
  ...effective.value,
  edges: input.value.edges.map(
    (e) =>
      [
        ...(frame.value?.state.transpose ? [e.to, e.from] : [e.from, e.to]),
        e.weight,
      ] as [number, number, number],
  ),
}));
const displayGraph = computed(() =>
  createGraph(displayPreset.value, true, input.value.directed),
);
const frame = computed(() => result.value?.frames[step.value]);
const before = computed(() => result.value?.frames[step.value - 1]?.state);
const maxStep = computed(() =>
  Math.max(0, (result.value?.frames.length ?? 1) - 1),
);
const state = computed(() => frame.value?.state ?? {});
const colors = computed(
  () =>
    new Map(
      (state.value.colors ?? []).flatMap((c, i) =>
        c ? [[i, 0] as [number, number]] : [],
      ),
    ),
);
const visibleGroups = computed(() => state.value.groups ?? []);
const matching = computed(() =>
  ["naive-match", "kmp"].includes(lesson.value.id),
);
const reconstructed = computed(() => {
  if (!result.value || step.value !== maxStep.value || result.value.limited)
    return undefined;
  const matrices = state.value.matrices ?? [],
    arrays = state.value.arrays ?? [];
  const D = matrices.find((m) => m.name === "D"),
    P = matrices.find((m) => m.name === "P");
  const reverse = !P && input.value.mode === "target",
    root = reverse ? input.value.target : input.value.start,
    destination = reverse ? input.value.start : input.value.target;
  const dis = arrays.find((a) => a.name === "dis")?.values,
    pre = arrays.find((a) => a.name === "pre")?.values;
  if (!P && (!pre || !dis || input.value.mode === "all")) return undefined;
  const distance = P ? D?.values[root]?.[destination] : dis?.[destination];
  if (typeof distance !== "number") return undefined;
  if (!Number.isFinite(distance))
    return {
      text:
        distance === Infinity
          ? "Für dieses Paar existiert kein Pfad."
          : "Für dieses Paar gibt es wegen eines relevanten negativen Zyklus kein endliches Minimum.",
      selected: [] as number[],
    };
  let cursor = destination;
  const nodes = [cursor];
  while (cursor !== root) {
    const parent = Number(P ? P.values[root][cursor] : pre?.[cursor]);
    if (
      parent < 0 ||
      nodes.includes(parent) ||
      nodes.length > input.value.nodes.length
    )
      return {
        text: "Keine gültige Vorgängerkette für dieses Paar aufgezeichnet.",
        selected: [] as number[],
      };
    nodes.push(parent);
    cursor = parent;
  }
  nodes.reverse();
  if (reverse && !P) nodes.reverse();
  const ids: number[] = [];
  for (let i = 1; i < nodes.length; i++) {
    const candidates = input.value.edges
      .map((e, id) => ({ e, id }))
      .filter(
        ({ e }) =>
          (e.from === nodes[i - 1] && e.to === nodes[i]) ||
          (!input.value.directed &&
            e.to === nodes[i - 1] &&
            e.from === nodes[i]),
      );
    candidates.sort((a, b) => a.e.weight - b.e.weight);
    if (candidates.length) ids.push(candidates[0].id);
  }
  const weight = ids.reduce((sum, id) => sum + input.value.edges[id].weight, 0);
  return {
    text: `Rekonstruierter Pfad: ⟨${nodes.map((id) => input.value.nodes[id].label).join(", ")}⟩ · k=${ids.length} · w(p)=${weight} · Distanzwert ${distance}.`,
    selected: ids,
  };
});
const u = ref(0),
  v = ref(1);
const relationship = computed(() => {
  const arrays = state.value.arrays ?? [],
    beg = arrays.find((a) => a.name === "beg")?.values,
    end = arrays.find((a) => a.name === "end")?.values,
    pre = arrays.find((a) => a.name === "pre")?.values;
  if (!beg || !end)
    return "Starte die Traversierung und wähle zwei Knoten, um ihre Beziehung aus Zeitstempeln abzulesen.";
  const a = u.value,
    b = v.value;
  if (a === b) return "Beide Auswahlen bezeichnen denselben Knoten.";
  if (
    Number(beg[a]) < 0 ||
    Number(end[a]) < 0 ||
    Number(beg[b]) < 0 ||
    Number(end[b]) < 0
  )
    return "Die beiden Intervalle sind in diesem Schritt noch nicht vollständig bestimmt.";
  const label = (id: number) => input.value.nodes[id]?.label;
  const ancestor =
    Number(beg[a]) < Number(beg[b]) && Number(end[b]) < Number(end[a]);
  const descendant =
    Number(beg[b]) < Number(beg[a]) && Number(end[a]) < Number(end[b]);
  return `${label(a)} und ${label(b)}: ${ancestor ? `${label(a)} ist echter Vorfahre von ${label(b)}` : descendant ? `${label(a)} ist echter Nachfahre von ${label(b)}` : pre && Number(pre[a]) >= 0 && pre[a] === pre[b] ? "Geschwister mit gleichem Elternknoten" : "keine Vorfahrenbeziehung; die DFS-Intervalle sind getrennt"}.`;
});
function cancel() {
  controller?.abort();
  controller = undefined;
  busy.value = false;
}
function clear() {
  cancel();
  result.value = undefined;
  step.value = 0;
  error.value = "";
}
async function run(draft?: OwnLesson) {
  clear();
  const current = new AbortController();
  controller = current;
  busy.value = true;
  const code = draft?.code ?? activeOwn.value?.code ?? lesson.value.source;
  try {
    const output = await runLesson(
      structuredClone(input.value),
      code,
      Math.max(1, Math.min(5000, Math.trunc(Number(limit.value) || 1))),
      current.signal,
      !!draft || !!activeOwn.value,
    );
    if (controller === current) {
      result.value = output;
      step.value = 0;
      runName.value = draft?.name ?? activeOwn.value?.name ?? lesson.value.name;
      runSource.value = code;
      if (draft)
        notice.value = `Vorschau: ${draft.name}. Zum Wiederverwenden im Editor speichern.`;
    }
  } catch (cause) {
    if (controller === current)
      error.value = `${draft?.name ?? activeOwn.value?.name ?? lesson.value.name}: ${cause instanceof Error ? cause.message : String(cause)}`;
  } finally {
    if (controller === current) {
      controller = undefined;
      busy.value = false;
    }
  }
}
async function openEditor(empty = false) {
  editorBlank.value = empty;
  editorOpen.value = true;
  await nextTick();
  editorHost.value?.scrollIntoView({ behavior: "smooth", block: "start" });
}
function save(variant: OwnLesson) {
  if (!own.value.some((v) => v.id === variant.id) && own.value.length >= 30) {
    notice.value = "Höchstens 30 eigene Varianten; bitte zuerst eine löschen.";
    return;
  }
  own.value = [...own.value.filter((v) => v.id !== variant.id), variant];
  notice.value = store(`lessons-${props.kind}`, own.value)
    ? "Variante gespeichert."
    : "Lokaler Speicher nicht verfügbar. Bitte exportieren.";
  selected.value = variant.id;
  editorBlank.value = false;
}
function remove(id: string) {
  own.value = own.value.filter((v) => v.id !== id);
  store(`lessons-${props.kind}`, own.value);
  selected.value = base.value;
  editorOpen.value = false;
}
function build(copy: boolean) {
  clear();
  xmlMode.value = false;
  builder.value = copy
    ? cloneLayout({
        ...preset.value,
        weighted: weighted.value,
        directed: directed.value,
        id: layouts.value.some((v) => v.id === presetId.value)
          ? presetId.value
          : "",
        name: `${preset.value.name} – Variante`.slice(0, 48),
      })
    : {
        id: "",
        name: "Mein Graph",
        description: "Eigener Lehrgraph",
        points: [],
        edges: [],
        start: -1,
        target: -1,
        weighted: true,
        directed: true,
      };
}
function saveLayout(layout: GraphLayout) {
  if (!layout.id) layout.id = `layout:${crypto.randomUUID()}`;
  layouts.value = [...layouts.value.filter((v) => v.id !== layout.id), layout];
  notice.value = store(LAYOUT_STORAGE_KEY, layouts.value)
    ? "Graph gespeichert."
    : "Graph nur für diese Sitzung verfügbar.";
  presetId.value = layout.id;
  builder.value = undefined;
}
function removeLayout(id: string) {
  layouts.value = layouts.value.filter((v) => v.id !== id);
  store(LAYOUT_STORAGE_KEY, layouts.value);
  presetId.value = presets[0].id;
  builder.value = undefined;
}
function loadXml() {
  try {
    if (
      xmlText.value.length > 12000 ||
      /<!DOCTYPE|<!ENTITY/i.test(xmlText.value)
    )
      throw Error(
        "XML ohne DTD/Entities und mit höchstens 12.000 Zeichen verwenden.",
      );
    const doc = new DOMParser().parseFromString(
      xmlText.value,
      "application/xml",
    );
    if (doc.querySelector("parsererror"))
      throw Error("XML ist nicht wohlgeformt: Tags und Attribute prüfen.");
    const elements = Array.from(doc.getElementsByTagName("*"));
    if (elements.length > 32) throw Error("Höchstens 32 XML-Elemente.");
    const edges: [number, number, number][] = [],
      depth: number[] = [],
      levels = new Map<number, number[]>();
    elements.forEach((element, i) => {
      const p = elements.indexOf(element.parentElement!);
      depth[i] = p < 0 ? 0 : depth[p] + 1;
      if (p >= 0) edges.push([p, i, 1]);
      levels.set(depth[i], [...(levels.get(depth[i]) ?? []), i]);
    });
    const max = Math.max(...depth, 1);
    const points = elements.map((_, i) => {
      const peers = levels.get(depth[i])!;
      return [(peers.indexOf(i) + 1) / (peers.length + 1), depth[i] / max] as [
        number,
        number,
      ];
    });
    xmlDocument = doc;
    xmlElements = elements;
    xmlTags.value = elements.map(
      (e) =>
        `<${e.tagName}${Array.from(e.attributes)
          .map((a) => ` ${a.name}="${a.value}"`)
          .join("")}>`,
    );
    xmlLayout.value = {
      id: "xml",
      name: "XML-Elementbaum",
      description: "Elemente der bearbeiteten XML-Eingabe",
      points,
      edges,
      start: 0,
      target: elements.length - 1,
      directed: true,
      weighted: false,
    };
    xmlMode.value = true;
    start.value = 0;
    target.value = elements.length - 1;
    u.value = 0;
    v.value = Math.min(1, elements.length - 1);
    xmlError.value = "";
    queryXml();
  } catch (cause) {
    xmlError.value = cause instanceof Error ? cause.message : String(cause);
  }
}
function queryXml() {
  try {
    if (!xmlDocument) return;
    const matches = xmlDocument.evaluate(
      xpath.value,
      xmlDocument,
      null,
      XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,
      null,
    );
    xmlSelected.value = Array.from({ length: matches.snapshotLength }, (_, i) =>
      xmlElements.indexOf(matches.snapshotItem(i) as Element),
    ).filter((i) => i >= 0);
    xmlError.value = "";
  } catch {
    xmlError.value =
      "Der XPath-Ausdruck muss XML-Elemente auswählen, etwa /sammlung/buch oder //kapitel.";
    xmlSelected.value = [];
  }
}
function example() {
  if (isGraph) {
    xmlMode.value = false;
    const id = lesson.value.id;
    presetId.value =
      id === "kosaraju"
        ? "lesson-scc"
        : ["bellman", "floyd"].includes(id)
          ? "lesson-negative"
          : id === "trees"
            ? "lesson-rooted"
            : id === "topology"
              ? "dag"
              : ["union", "components"].includes(id)
                ? "disconnected"
                : PRESETS[0].id;
    const value = presets.find((p) => p.id === presetId.value)!;
    start.value = value.start;
    target.value = value.target;
    weighted.value = value.weighted ?? true;
    directed.value = [
      "topology",
      "kosaraju",
      "bellman",
      "floyd",
      "trees",
    ].includes(id);
    return;
  }
  if (matching.value) {
    s.value = "abaca";
    t.value = "ababacababaca";
  } else if (lesson.value.id === "levenshtein-recursive") {
    s.value = "rot";
    t.value = "rat";
  } else {
    s.value = "garten";
    t.value = "karten";
  }
}
function exportResult() {
  if (!result.value) return;
  const url = URL.createObjectURL(
    new Blob(
      [
        JSON.stringify(
          {
            format: "algofights-lesson-replay-v1",
            algorithm: runName.value,
            source: runSource.value,
            input: input.value,
            result: result.value,
          },
          (_key, value) =>
            value === Infinity ? "∞" : value === -Infinity ? "−∞" : value,
          2,
        ),
      ],
      { type: "application/json" },
    ),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = "algofights-lehrablauf.json";
  a.click();
  URL.revokeObjectURL(url);
}
watch(category, (value) => {
  const first = lessons.find((l) => l.category === value);
  if (first && lesson.value.category !== value) selected.value = first.id;
});
watch(selected, (value) => {
  if (value === "new") {
    void openEditor(true);
    return;
  }
  if (!value.startsWith("lesson:")) base.value = value;
  editorBlank.value = false;
});
watch(
  () => lesson.value.id,
  (id) => {
    if (["topology", "kosaraju"].includes(id)) directed.value = true;
    if (["kruskal", "prim"].includes(id)) directed.value = false;
    if (id !== "trees") xmlMode.value = false;
  },
);
watch(preset, (value) => {
  start.value = value.start;
  target.value = value.target;
  weighted.value = value.weighted ?? true;
  directed.value = value.directed ?? false;
  u.value = 0;
  v.value = Math.min(1, value.points.length - 1);
});
watch([input, selected], clear);
onBeforeUnmount(cancel);
</script>
<template>
  <section
    class="graph-sim lesson-lab"
    :aria-label="isGraph ? 'Graph-Lehrlabor' : 'String Sim'"
  >
    <header class="graph-heading">
      <div>
        <h1>{{ isGraph ? "Graph Sim · Lehrlabor" : "String Sim" }}</h1>
        <p>
          {{
            isGraph
              ? "Strukturen und Verfahren Schritt für Schritt"
              : "Zeichen vergleichen, Tabellen aufbauen, Ergebnisse rekonstruieren"
          }}
        </p>
      </div>
      <div class="graph-heading-actions">
        <button class="secondary-button" @click="openEditor()">
          <CodeXml :size="17" /> Code-Editor</button
        ><button v-if="isGraph" class="secondary-button" @click="build(false)">
          <Network :size="17" /> Graph Builder
        </button>
      </div>
    </header>
    <template v-if="builder"
      ><button class="secondary-button" @click="builder = undefined">
        Zurück zum Lehrlabor</button
      ><GraphBuilder
        :initial="builder"
        :can-save="!!builder.id || layouts.length < MAX_LAYOUTS"
        @save="saveLayout"
        @remove="removeLayout"
    /></template>
    <div v-else class="graph-layout">
      <section class="panel lab-visual-panel">
        <div class="graph-readout">
          <div class="graph-readout-title">
            <h2>{{ result ? runName : (activeOwn?.name ?? lesson.name) }}</h2>
            <span>{{
              isGraph
                ? `${input.nodes.length} Knoten · ${input.edges.length} Kanten`
                : `${Array.from(s).length} / ${Array.from(t).length} Zeichen`
            }}</span>
          </div>
          <div>
            <span>Schritt</span
            ><strong
              >{{ step }} <small>/ {{ maxStep }}</small></strong
            >
          </div>
          <div>
            <span>Berechnung</span
            ><strong>{{
              result ? `${result.milliseconds.toFixed(1)} ms` : "—"
            }}</strong>
          </div>
        </div>
        <GraphBoard
          v-if="isGraph"
          :preset="displayPreset"
          :graph="displayGraph"
          :directed="input.directed"
          :weighted="weighted && !xmlMode"
          :start="input.start"
          :target="input.target"
          :visited="colors"
          :current="state.current"
          :step="step"
          :tempo="delay"
          :lesson="{
            ...state,
            groups: visibleGroups,
            selected: reconstructed?.selected ?? state.selected,
          }"
          :marked="xmlMode ? xmlSelected : []"
          @select="start = $event"
        />
        <StringBoard v-else :s="s" :t="t" :state="state" :matching="matching" />
        <div v-if="isGraph" class="graph-legend">
          <span class="search-key">offen / aktueller Schritt</span
          ><span class="route-key">ausgewählte Kanten</span
          ><span>Komponenten haben gleiche Farben</span
          ><span v-if="state.transpose">Pfeile umgedreht · Gᵀ</span>
        </div>
        <div class="lab-step-message" role="status">
          <span>{{
            result
              ? step === 0
                ? "Initialzustand"
                : `Schritt ${step}`
              : "Bereit"
          }}</span>
          <p :key="`${selected}-${step}-${frame?.message}`">
            {{
              frame?.message ??
              "Wähle Eingabe und Verfahren. Nach der Berechnung kannst du jeden Schritt einzeln verfolgen oder abspielen."
            }}
          </p>
        </div>
        <LabPlayback
          :key="result ? result.milliseconds : 0"
          :step="step"
          :total="maxStep"
          :delay="delay"
          @seek="step = $event"
        />
        <LabState v-if="frame" :state="state" :before="before" :input="input" />
        <div class="lab-run-result">
          <p v-if="error" role="alert">{{ error }}</p>
          <template v-if="result"
            ><p v-if="step === maxStep">{{ result.result }}</p>
            <p v-else>
              {{
                result.limited
                  ? "Aufzeichnung wurde begrenzt."
                  : "Berechnung abgeschlossen."
              }}
              {{ maxStep }} Schritte stehen zur Wiedergabe bereit.
            </p>
            <p v-if="reconstructed">{{ reconstructed.text }}</p>
            <button class="secondary-button" @click="exportResult">
              <Download :size="14" /> Ablauf exportieren
            </button></template
          >
        </div>
      </section>
      <aside class="panel graph-settings">
        <h2>Experiment</h2>
        <label
          >Lernbereich<select v-model="category">
            <option v-for="name in categories" :key="name">{{ name }}</option>
          </select></label
        >
        <label
          >Verfahren<select v-model="selected">
            <optgroup label="Eingebaute Verfahren">
              <option
                v-for="item in lessons.filter((l) => l.category === category)"
                :key="item.id"
                :value="item.id"
              >
                {{ item.name }}
              </option>
            </optgroup>
            <optgroup v-if="own.length" label="Eigene Varianten">
              <option v-for="item in own" :key="item.id" :value="item.id">
                {{ item.name }}
              </option>
            </optgroup>
            <option value="new">Eigenen Algorithmus bauen</option>
          </select></label
        >
        <template v-if="isGraph"
          ><label
            >Graph<select v-model="presetId" @change="xmlMode = false">
              <option
                v-for="item in [...presets, ...layouts]"
                :key="item.id"
                :value="item.id"
              >
                {{ item.name }}
              </option>
            </select></label
          >
          <p class="graph-field-help">{{ effective.description }}</p>
          <button
            class="secondary-button graph-edit-button"
            @click="build(true)"
          >
            Vorlage bearbeiten
          </button>
          <button class="secondary-button graph-edit-button" @click="example">
            Passendes Beispiel laden
          </button>
          <div class="graph-toggles">
            <button
              :disabled="xmlMode"
              :aria-pressed="weighted"
              @click="weighted = !weighted"
            >
              Gewichtet</button
            ><button
              :disabled="xmlMode"
              :aria-pressed="directed"
              @click="directed = !directed"
            >
              Gerichtet
            </button>
          </div>
          <p v-if="!directed" class="graph-field-help">
            Ungerichtete Sicht: Gegenkanten werden mit dem kleineren Gewicht
            zusammengefasst, gerichtete Schlingen ausgeblendet. Die gespeicherte
            Vorlage bleibt erhalten.
          </p>
          <div class="graph-endpoints">
            <label
              >Quelle / Wurzel<select v-model="start">
                <option
                  v-for="node in input.nodes"
                  :key="node.id"
                  :value="node.id"
                >
                  {{ node.label }}
                </option>
              </select></label
            ><span>→</span
            ><label
              >Ziel<select v-model="target">
                <option
                  v-for="node in input.nodes"
                  :key="node.id"
                  :value="node.id"
                >
                  {{ node.label }}
                </option>
              </select></label
            >
          </div>
          <label
            v-if="
              ['bfs', 'dfs', 'bellman', 'dijkstra', 'paths'].includes(lesson.id)
            "
            >Umfang<select v-model="mode">
              <option value="source">Ab einer Quelle</option>
              <option value="target">Zum Ziel · transponiert</option>
              <option value="all">Gesamter Graph / alle Quellen</option>
            </select></label
          >
          <p class="graph-field-help">
            Klick auf einen Knoten setzt die Quelle. „Pfade“ verwendet stets
            Quelle und Ziel; „Gesamter Graph“ bildet bei BFS/DFS einen Suchwald.
          </p>
        </template>
        <template v-else
          ><label
            >{{ matching ? "Muster p" : "Zeichenkette s"
            }}<input v-model="s" maxlength="48" spellcheck="false" /></label
          ><label
            >{{ matching ? "Text t" : "Zeichenkette t"
            }}<input v-model="t" maxlength="48" spellcheck="false" /></label
          ><button class="secondary-button graph-edit-button" @click="example">
            Beispiel einsetzen
          </button>
          <p class="graph-field-help">
            Leere Texte sind erlaubt. Positionen zählen Unicode-Codepoints ab 0;
            zusammengesetzte Schriftzeichen können mehrere Positionen umfassen.
          </p>
          <details class="lab-small-details">
            <summary>Schreibweise</summary>
            <p>
              |s| ist die Länge. s[i] bezeichnet ein Zeichen. s[i:j] enthält
              Positionen i bis j−1. s[:i] ist ein Präfix, s[i:] ein Suffix. ε
              steht für die leere Zeichenkette.
            </p>
          </details></template
        >
        <label
          >Schrittlimit<input
            v-model.number="limit"
            type="number"
            min="1"
            max="5000" /></label
        ><label
          >Wiedergabe<select v-model.number="delay">
            <option :value="850">Langsam</option>
            <option :value="450">Normal</option>
            <option :value="120">Schnell</option>
          </select></label
        >
        <button v-if="busy" class="secondary-button graph-run" @click="cancel">
          <Square :size="15" /> Berechnung abbrechen</button
        ><button
          v-else
          class="primary-button graph-run"
          :disabled="selected === 'new'"
          @click="run()"
        >
          <Play :size="16" /> Berechnen</button
        ><button
          class="secondary-button graph-run"
          @click="openEditor(selected === 'new')"
        >
          <CodeXml :size="16" /> Code öffnen & verändern
        </button>
      </aside>
    </div>
    <p v-if="notice" role="status" class="lab-notice">{{ notice }}</p>
    <template v-if="!builder">
      <section class="panel lab-explanation">
        <h2>{{ lesson.name }} · Idee und Notation</h2>
        <p>{{ lesson.introduction }}</p>
        <div class="lab-formulas">
          <p
            v-for="formula in lesson.formulas"
            :key="formula"
            class="notation-math"
          >
            {{ formula }}
          </p>
        </div>
        <dl>
          <dt>Voraussetzungen</dt>
          <dd>{{ lesson.prerequisites }}</dd>
          <dt>Warum die Schritte funktionieren</dt>
          <dd>{{ lesson.explanation }}</dd>
          <dt>Zeit und Speicher</dt>
          <dd>
            {{ lesson.complexity }} Die Angaben beschreiben die Berechnung ohne
            gespeicherte Animation und UI.
          </dd>
        </dl>
        <p v-if="activeOwn?.notation" class="lab-own-notation">
          Eigene Variante: {{ activeOwn.notation }}
        </p>
      </section>
      <section
        v-if="isGraph && lesson.id === 'trees'"
        class="panel lab-explanation"
      >
        <h2>Beziehungen und XML</h2>
        <div class="lab-relation-fields">
          <label
            >Knoten u<select v-model="u">
              <option
                v-for="node in input.nodes"
                :key="node.id"
                :value="node.id"
              >
                {{ node.label }}
              </option>
            </select></label
          ><label
            >Knoten v<select v-model="v">
              <option
                v-for="node in input.nodes"
                :key="node.id"
                :value="node.id"
              >
                {{ node.label }}
              </option>
            </select></label
          >
        </div>
        <p>{{ relationship }}</p>
        <label
          >XML-Elementbaum<textarea
            v-model="xmlText"
            rows="6"
            maxlength="12000"
            spellcheck="false"
          /></label
        ><button class="secondary-button" @click="loadXml">
          XML als Baum laden</button
        ><label
          >XPath · Elemente auswählen<input
            v-model="xpath"
            maxlength="300" /></label
        ><button class="secondary-button" @click="queryXml">
          Auswahl markieren
        </button>
        <p v-if="xmlError" role="alert">{{ xmlError }}</p>
        <p v-if="xmlMode">
          {{ xmlSelected.length }} Elemente gewählt.
          <code>/sammlung/buch</code> wählt direkte Kinder;
          <code>//kapitel</code> sucht Nachfahren. Attribute können mit
          <code>[@thema='Pfade']</code> eingeschränkt werden.
        </p>
        <div v-if="xmlMode" class="lab-xml-tags">
          <p
            v-for="(tag, i) in xmlTags"
            :key="i"
            :class="{ 'lab-changed': xmlSelected.includes(i) }"
          >
            <code>{{ input.nodes[i]?.label }} = {{ tag }}</code>
          </p>
        </div>
      </section>
      <details v-if="isGraph" class="panel lab-facts">
        <summary>Graphdarstellung, Eigenschaften und Pfade prüfen</summary>
        <GraphFacts :input="input" />
      </details>
      <div v-if="editorOpen" ref="editorHost" class="graph-editor-host">
        <LessonEditor
          :lesson="lesson"
          :own="activeOwn"
          :empty="editorBlank"
          :input="input"
          :limit="limit"
          @save="save"
          @remove="remove"
          @run="run"
          @close="editorOpen = false"
        />
      </div>
    </template>
  </section>
</template>
