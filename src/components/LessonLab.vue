<script setup lang="ts">
import {
  computed,
  defineAsyncComponent,
  nextTick,
  onActivated,
  onBeforeUnmount,
  onDeactivated,
  ref,
  shallowRef,
  watch,
} from "vue";
import {
  ArrowLeftRight,
  CodeXml,
  Network,
  Play,
  Square,
  Download,
} from "lucide-vue-next";
import GraphBoard from "./GraphBoard.vue";
import GraphBuilder from "./GraphBuilder.vue";
import GraphFacts from "./GraphFacts.vue";
import StringBoard from "./StringBoard.vue";
import LabState from "./LabState.vue";
import LabPlayback from "./LabPlayback.vue";
import SearchArrays from "./SearchArrays.vue";
import { GRAPH_LESSONS, STRING_LESSONS } from "../lab/catalog";
import {
  GRAPH_PRESETS,
  fullGraphLessons,
  lessonGraphExample,
} from "../lab/presets";
import { readLessonOptions } from "../lab/lesson-options";
import { PRESETS, type Point } from "../graph/presets";
import {
  cloneLayout,
  readLayouts,
  projectEdges,
  MAX_LAYOUTS,
  LAYOUT_STORAGE_KEY,
  type GraphLayout,
} from "../graph/layouts";
import {
  createGraph,
  GRAPH_ALGORITHMS,
  graphHeuristic,
  graphResult,
  searchTeachingGraph,
} from "../graph/simulation";
import {
  NEW_ROUTE,
  routeChoices,
  routeReplay,
  routeSelection,
  selectedRoute,
  type GraphRouteResult,
} from "../graph/route-lab";
import { readGraphNotation } from "../graph/notation";
import { readOwn, type OwnLesson } from "../lab/storage";
import { readStrategies, store } from "../services/storage";
import { runLesson } from "../services/lesson-runner";
import { runRouteCode } from "../services/route-sandbox";
import type { CustomStrategy } from "../core/types";
import type { LabInput, LabResult, LessonOptions } from "../lab/types";
import "../lab/style.css";
import ShareExample from "./ShareExample.vue";
import { readExample, snapshotGraph, type Example } from "../sharing/examples";
const LessonEditor = defineAsyncComponent(() => import("./LessonEditor.vue"));
const StrategyEditor = defineAsyncComponent(
  () => import("./StrategyEditor.vue"),
);
const GraphNotation = defineAsyncComponent(() => import("./GraphNotation.vue"));
const props = defineProps<{
  kind: "graph" | "string";
  initial?: Example;
  compact?: boolean;
}>();
const isGraph = props.kind === "graph",
  lessons = isGraph ? GRAPH_LESSONS : STRING_LESSONS;
const categories = [...new Set(lessons.map((l) => l.category))];
const selected = ref(isGraph ? "bfs" : "levenshtein"),
  base = ref(selected.value);
const own = ref(readOwn(props.kind)),
  activeOwn = computed(() => own.value.find((v) => v.id === selected.value));
const ownRoutes = ref(isGraph ? readStrategies("graphs", "graph:") : []);
const activeRoute = computed(() =>
  ownRoutes.value.find((v) => v.id === selected.value),
);
const routeId = computed(() =>
  isGraph ? selectedRoute(selected.value) : undefined,
);
const isRoute = computed(
  () =>
    isGraph &&
    (!!routeId.value || !!activeRoute.value || selected.value === NEW_ROUTE),
);
const routeName = computed(
  () =>
    activeRoute.value?.name ??
    routeChoices.find((item) => item.id === selected.value)?.name ??
    "Eigene Wegsuche",
);
const routeEditorSource = computed(() =>
  routeId.value ? `builtin:${routeId.value}` : (activeRoute.value?.id ?? "new"),
);
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
  presets = GRAPH_PRESETS,
  presetId = ref(PRESETS[0].id);
const linkedGraph = shallowRef<GraphLayout>();
const preset = computed(
  () =>
    (presetId.value === "linked" ? linkedGraph.value : undefined) ??
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
const routeLimit = ref(100);
const clickEndpoint = ref<"start" | "target">("target");
const stepLimit = computed({
  get: () => (isRoute.value ? routeLimit.value : limit.value),
  set: (value) => {
    if (isRoute.value) routeLimit.value = value;
    else limit.value = value;
  },
});
const maxLimit = computed(() => (isRoute.value ? 500 : 5000));
const boundedLimit = () =>
  Math.max(
    1,
    Math.min(maxLimit.value, Math.trunc(Number(stepLimit.value) || 1)),
  );
const s = ref("garten"),
  t = ref("karten");
const options = ref<LessonOptions>({});
const runOptions = computed(() =>
  readLessonOptions(lesson.value.id, options.value),
);
const pattern = computed(() => Array.from(s.value));
watch(pattern, (chars) => {
  if (
    options.value.anchor !== undefined &&
    options.value.anchor >= chars.length
  )
    options.value.anchor = undefined;
});
const result = shallowRef<LabResult>(),
  error = ref(""),
  notice = ref(""),
  busy = ref(false),
  editorOpen = ref(false),
  editorHost = ref<HTMLElement>(),
  visualPanel = ref<HTMLElement>(),
  editorBlank = ref(false);
const routeResult = shallowRef<GraphRouteResult>();
const notationOpen = ref(false);
const runName = ref(""),
  runSource = ref("");
const builder = shallowRef<GraphLayout>();
const builderTool = ref<"maze">();
const treeOnly = ref(false);
let controller: AbortController | undefined;
let layoutStorageFailed = false;
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
  mode: isRoute.value
    ? "source"
    : fullGraphLessons.has(lesson.value.id)
      ? "all"
      : ["bfs", "dfs", "dijkstra", "bellman", "paths", "floyd"].includes(
            lesson.value.id,
          ) || activeOwn.value
        ? mode.value
        : "source",
  s: s.value,
  t: t.value,
  ...(!isRoute.value && runOptions.value ? { options: runOptions.value } : {}),
}));
const treeParents = computed(() => {
  if (
    ![
      "bfs",
      "dfs",
      "cycle",
      "topology",
      "bfs-cycle",
      "bfs-count",
      "maze",
      "dijkstra",
      "bellman",
      "longest-dag",
    ].includes(lesson.value.id)
  )
    return;
  const parents = state.value.arrays?.find(
    (array) => array.name === "pre" && array.kind === "nodes",
  )?.values;
  if (
    !parents ||
    parents.length !== input.value.nodes.length ||
    !parents.every(
      (parent) =>
        typeof parent === "number" &&
        Number.isInteger(parent) &&
        parent >= -1 &&
        parent < parents.length,
    ) ||
    state.value.arrays?.some(
      (array) => array.name === "dis" && array.values.includes(-Infinity),
    )
  )
    return;
  for (let i = 0; i < parents.length; i++) {
    const seen = new Set<number>();
    let node = i;
    while (node >= 0 && typeof parents[node] === "number") {
      if (seen.has(node)) return;
      seen.add(node);
      node = Number(parents[node]);
    }
  }
  return parents as number[];
});
const showTree = computed(() => treeOnly.value && !!treeParents.value);
const treePoints = computed<Point[]>(() => {
  const parents = treeParents.value;
  if (!parents) return effective.value.points;
  const children = parents.map(() => [] as number[]),
    roots: number[] = [];
  parents.forEach((parent, node) => {
    if (parent < 0) roots.push(node);
    else children[parent].push(node);
  });
  const points = parents.map((): Point => [0, 0]);
  let leaf = 0,
    maxDepth = 0;
  function place(node: number, depth: number) {
    maxDepth = Math.max(depth, maxDepth);
    const descendants = children[node];
    if (!descendants.length) points[node] = [leaf++, depth];
    else {
      for (const child of descendants) place(child, depth + 1);
      points[node] = [
        (points[descendants[0]][0] + points[descendants.at(-1)!][0]) / 2,
        depth,
      ];
    }
  }
  for (const root of roots) place(root, 0);
  return points.map(([x, y]) => [
    leaf > 1 ? x / (leaf - 1) : 0.5,
    maxDepth ? y / maxDepth : 0.5,
  ]);
});
// Keep segment IDs identical to input.edges (undirected display omits directed loops).
const displayPreset = computed(() => ({
  ...effective.value,
  points: showTree.value ? treePoints.value : effective.value.points,
  edges: input.value.edges
    .map(
      (e) =>
        [
          ...(frame.value?.state.transpose ? [e.to, e.from] : [e.from, e.to]),
          e.weight,
        ] as [number, number, number],
    )
    .filter(
      ([u, v]) =>
        !showTree.value ||
        treeParents.value?.[v] === u ||
        (!input.value.directed && treeParents.value?.[u] === v),
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
const routeAtEnd = computed(
  () => !!routeResult.value && step.value === maxStep.value,
);
const routeTrace = computed(() => {
  const visited = new Map<number, number>();
  const edges = new Map<number, number>();
  const route = routeResult.value;
  if (!route) return { visited, edges };
  const { arcs } = displayGraph.value;
  for (let i = 0; i < step.value; i++) {
    const side = route.traceSides[i];
    visited.set(route.traceNodes[i], side);
    const arc = arcs[route.traceEdges[i]];
    if (arc) edges.set(arc.segment, side);
  }
  const arc = arcs[route.traceEdges[step.value - 1]];
  const source = route.traceSides[step.value - 1] === 1 ? arc?.to : arc?.from;
  return { visited, edges, source };
});
const colors = computed(
  () =>
    new Map(
      (state.value.colors ?? []).flatMap((c, i) =>
        c ? [[i, 0] as [number, number]] : [],
      ),
    ),
);
const visibleGroups = computed(() => state.value.groups ?? []);
const hasSource = computed(
  () =>
    isGraph &&
    (isRoute.value ||
      !!activeOwn.value ||
      [
        "bfs",
        "dfs",
        "paths",
        "dijkstra",
        "bellman",
        "floyd",
        "trees",
        "prim",
        "bfs-count",
        "bfs-cycle",
        "maze",
        "longest-dag",
        "all-shortest",
      ].includes(lesson.value.id)),
);
const hasTarget = computed(
  () =>
    isGraph &&
    (isRoute.value ||
      !!activeOwn.value ||
      [
        "paths",
        "dijkstra",
        "bellman",
        "floyd",
        "maze",
        "all-shortest",
      ].includes(lesson.value.id) ||
      (mode.value === "target" && ["bfs", "dfs"].includes(lesson.value.id))),
);
const matching = computed(() =>
  ["naive-match", "anchor-match", "kmp"].includes(lesson.value.id),
);
const reconstructed = computed(() => {
  if (
    isRoute.value ||
    !result.value ||
    step.value !== maxStep.value ||
    result.value.limited
  )
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
  routeResult.value = undefined;
  treeOnly.value = false;
  step.value = 0;
  error.value = "";
}
async function run(draft?: OwnLesson) {
  if (selected.value === NEW_ROUTE || (selected.value === "new" && !draft))
    return;
  clear();
  const current = new AbortController();
  controller = current;
  busy.value = true;
  const route = isRoute.value;
  const code = route
    ? (activeRoute.value?.code ?? "")
    : (draft?.code ?? activeOwn.value?.code ?? lesson.value.source);
  const name = route
    ? routeName.value
    : (draft?.name ?? activeOwn.value?.name ?? lesson.value.name);
  try {
    let output: LabResult;
    if (route) {
      const graph = displayGraph.value;
      const { start, target, directed } = input.value;
      if (graph.arcs.some((arc) => arc.length < 0))
        throw new Error(
          "Diese Suche braucht nichtnegative Kosten. Wähle für negative Kanten Bellman–Ford oder Floyd–Warshall im Algorithmusmenü.",
        );
      const heuristic = graphHeuristic(graph, target);
      const stepLimit = boundedLimit();
      const search = activeRoute.value
        ? await runRouteCode(graph, start, target, code, current.signal, {
            heuristic,
            stepLimit,
            weighted: weighted.value,
            directed,
          })
        : searchTeachingGraph(
            graph,
            start,
            target,
            routeId.value!,
            stepLimit,
            heuristic,
            true,
          );
      if (controller !== current) return;
      routeResult.value = graphResult(graph, start, target, search);
      output = routeReplay(graph, start, routeResult.value);
    } else {
      output = await runLesson(
        structuredClone(input.value),
        code,
        boundedLimit(),
        current.signal,
        !!draft || !!activeOwn.value,
      );
    }
    if (controller === current) {
      result.value = output;
      step.value = 0;
      runName.value = name;
      runSource.value = code;
      if (draft)
        notice.value = `Vorschau: ${draft.name}. Zum Wiederverwenden im Editor speichern.`;
    }
  } catch (cause) {
    if (controller === current)
      error.value = `${name}: ${cause instanceof Error ? cause.message : String(cause)}`;
  } finally {
    if (controller === current) {
      controller = undefined;
      busy.value = false;
      if (
        !props.compact &&
        (draft || matchMedia("(max-width: 900px)").matches)
      ) {
        await nextTick();
        visualPanel.value?.scrollIntoView({ block: "start" });
      }
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
function saveRoute(strategy: CustomStrategy) {
  if (
    !ownRoutes.value.some((v) => v.id === strategy.id) &&
    ownRoutes.value.length >= 30
  ) {
    notice.value =
      "Höchstens 30 eigene Wegsuchvarianten; bitte zuerst eine löschen.";
    return;
  }
  ownRoutes.value = [
    ...ownRoutes.value.filter((v) => v.id !== strategy.id),
    strategy,
  ];
  notice.value = store("graphs", ownRoutes.value)
    ? "Variante gespeichert."
    : "Lokaler Speicher nicht verfügbar. Bitte exportieren.";
  selected.value = strategy.id;
  clear();
}
function removeRoute(id: string) {
  if (selected.value === id) selected.value = routeSelection("dijkstra");
  ownRoutes.value = ownRoutes.value.filter((v) => v.id !== id);
  if (!store("graphs", ownRoutes.value))
    notice.value = "Die Änderung konnte nicht lokal gespeichert werden.";
}
function selectGraphNode(id: number) {
  if (
    isRoute.value
      ? clickEndpoint.value === "target"
      : mode.value === "target" && hasTarget.value
  )
    target.value = id;
  else start.value = id;
}
function swapEndpoints() {
  [start.value, target.value] = [target.value, start.value];
}
function build(copy: boolean, tool?: "maze") {
  cancel();
  builderTool.value = tool;
  const current = effective.value;
  const ownLayout =
    !xmlMode.value && layouts.value.some((v) => v.id === current.id);
  builder.value = copy
    ? cloneLayout({
        ...current,
        weighted: weighted.value && !xmlMode.value,
        directed: input.value.directed,
        start: input.value.start,
        target: input.value.target,
        id: ownLayout ? current.id : "",
        name: ownLayout ? current.name : `${current.name} – Kopie`.slice(0, 48),
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
  layoutStorageFailed = !store(LAYOUT_STORAGE_KEY, layouts.value);
  notice.value = layoutStorageFailed
    ? "Graph nur für diese Sitzung verfügbar."
    : "Graph gespeichert.";
  presetId.value = layout.id;
  xmlMode.value = false;
  builder.value = undefined;
}
function removeLayout(id: string) {
  layouts.value = layouts.value.filter((v) => v.id !== id);
  layoutStorageFailed = !store(LAYOUT_STORAGE_KEY, layouts.value);
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
    const value = isRoute.value
      ? PRESETS[0]
      : lessonGraphExample(lesson.value.id);
    presetId.value = value.id;
    start.value = value.start;
    target.value = value.target;
    weighted.value = value.weighted ?? true;
    directed.value = value.directed ?? false;
    return;
  }
  if (lesson.value.id === "anchor-match") {
    s.value = "blau";
    t.value = "bald ist der Himmel blau";
    options.value.anchor = undefined;
  } else if (lesson.value.id === "edit-metric") {
    s.value = "saal";
    t.value = "salz";
    options.value.third = "saat";
  } else if (matching.value) {
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
            ...(routeResult.value
              ? {
                  route: {
                    algorithm: routeId.value,
                    path: Array.from(routeResult.value.path),
                    traceNodes: Array.from(routeResult.value.traceNodes),
                    traceEdges: Array.from(routeResult.value.traceEdges),
                    traceSides: Array.from(routeResult.value.traceSides),
                    arrayFrames: routeResult.value.arrayFrames,
                  },
                }
              : {}),
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
watch(selected, (value) => {
  if (value === "new" || value === NEW_ROUTE) {
    void openEditor(true);
    return;
  }
  if (!isRoute.value && !value.startsWith("lesson:")) base.value = value;
  if (isRoute.value) xmlMode.value = false;
  editorBlank.value = false;
});
watch(
  () => lesson.value.id,
  (id) => {
    if (isRoute.value) return;
    if (["topology", "kosaraju", "kahn", "longest-dag"].includes(id))
      directed.value = true;
    if (
      [
        "kruskal",
        "prim",
        "bfs-cycle",
        "coloring",
        "spanning-trees",
        "maze",
      ].includes(id)
    )
      directed.value = false;
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
watch([input, selected, stepLimit], clear);
let initialVersion = 0;
watch(
  () => props.initial,
  async (value) => {
    if (!value) return;
    const example = readExample(value),
      version = ++initialVersion;
    if (
      example.kind !== "graph-lesson" &&
      example.kind !== "graph-route" &&
      example.kind !== "string"
    )
      return;
    selected.value =
      example.kind === "graph-route"
        ? routeSelection(example.algorithm)
        : example.algorithm;
    options.value =
      example.kind === "graph-route" ? {} : { ...example.options };
    if (example.kind !== "string") {
      linkedGraph.value = { ...example.graph, id: "linked" };
      presetId.value = "linked";
      xmlMode.value = false;
    } else {
      s.value = example.s;
      t.value = example.t;
    }
    await nextTick();
    if (version !== initialVersion) return;
    stepLimit.value = example.limit;
    delay.value = example.delay;
    if (example.kind !== "string") {
      weighted.value = example.graph.weighted;
      directed.value = example.graph.directed;
      start.value = example.graph.start;
      target.value = example.graph.target;
      mode.value = example.kind === "graph-lesson" ? example.mode : "source";
    }
  },
  { immediate: true },
);
function getExample(): Example | null {
  if (activeOwn.value || selected.value === "new") return null;
  if (isRoute.value) {
    if (!routeId.value) return null;
    return readExample({
      v: 1,
      kind: "graph-route",
      algorithm: routeId.value,
      graph: snapshotGraph(
        effective.value,
        weighted.value,
        directed.value,
        start.value,
        target.value,
      ),
      limit: boundedLimit(),
      delay: delay.value,
    });
  }
  return readExample(
    isGraph
      ? {
          v: 1,
          kind: "graph-lesson",
          algorithm: selected.value,
          graph: snapshotGraph(
            effective.value,
            xmlMode.value ? false : weighted.value,
            xmlMode.value || directed.value,
            start.value,
            target.value,
          ),
          mode: input.value.mode,
          options: runOptions.value,
          limit: Number(limit.value),
          delay: delay.value,
        }
      : {
          v: 1,
          kind: "string",
          algorithm: selected.value,
          s: s.value,
          t: t.value,
          options: runOptions.value,
          limit: Number(limit.value),
          delay: delay.value,
        },
  );
}
const shared = computed(() => {
  try {
    return getExample();
  } catch {
    return null;
  }
});
defineExpose({ run: () => run(), getExample });
onActivated(() => {
  if (layoutStorageFailed) return;
  const stored = readLayouts();
  if (JSON.stringify(stored) !== JSON.stringify(layouts.value))
    layouts.value = stored;
});
onDeactivated(cancel);
onBeforeUnmount(cancel);
</script>
<template>
  <section
    class="graph-sim lesson-lab"
    :class="{ 'simulation-compact': compact }"
    :aria-label="isGraph ? 'Graph Sim' : 'String Sim'"
  >
    <header class="graph-heading">
      <div>
        <h1>
          {{ builder ? "Graph Builder" : isGraph ? "Graph Sim" : "String Sim" }}
        </h1>
        <p>
          {{
            isGraph
              ? "Graphen traversieren, Wege finden und Strukturen untersuchen."
              : "Zeichenketten vergleichen und Suchschritte verfolgen."
          }}
        </p>
      </div>
      <div v-if="!builder" class="graph-heading-actions">
        <ShareExample
          :example="shared"
          reason="Eigener Programmcode wird nicht über Links geteilt."
        />
        <button
          class="secondary-button"
          @click="openEditor(selected === 'new' || selected === NEW_ROUTE)"
        >
          <CodeXml :size="17" /> Code-Editor</button
        ><button v-if="isGraph" class="secondary-button" @click="build(false)">
          <Network :size="17" /> Graph Builder
        </button>
      </div>
      <button v-else class="secondary-button" @click="builder = undefined">
        Zurück zur Simulation
      </button>
    </header>
    <template v-if="builder"
      ><GraphBuilder
        :initial="builder"
        :can-save="!!builder.id || layouts.length < MAX_LAYOUTS"
        :share-algorithm="
          isRoute ? routeSelection(routeId ?? 'dijkstra') : lesson.id
        "
        :initial-tool="builderTool"
        @save="saveLayout"
        @remove="removeLayout"
    /></template>
    <div v-else class="graph-layout experiment-layout">
      <aside
        class="panel graph-settings experiment-settings"
        aria-label="Experiment einstellen"
      >
        <h2>Experiment einstellen</h2>
        <label
          >Algorithmus<select v-model="selected">
            <optgroup
              v-for="category in categories"
              :key="category"
              :label="category"
            >
              <option
                v-for="item in lessons.filter((l) => l.category === category)"
                :key="item.id"
                :value="item.id"
              >
                {{ item.name }}
              </option>
            </optgroup>
            <optgroup v-if="isGraph" label="Start–Ziel-Wegsuche">
              <option
                v-for="item in routeChoices"
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
            <optgroup v-if="ownRoutes.length" label="Eigene Wegsuche">
              <option v-for="item in ownRoutes" :key="item.id" :value="item.id">
                {{ item.name }}
              </option>
            </optgroup>
            <option value="new">Eigenen Algorithmus bauen</option>
            <option v-if="isGraph" :value="NEW_ROUTE">
              Eigene Wegsuche bauen
            </option>
          </select></label
        >
        <template v-if="isGraph">
          <label
            >Graph<select v-model="presetId" @change="xmlMode = false">
              <option v-if="xmlMode" :value="presetId">XML-Elementbaum</option>
              <optgroup label="Vorlagen">
                <option v-for="item in presets" :key="item.id" :value="item.id">
                  {{ item.name }}
                </option>
              </optgroup>
              <optgroup
                v-if="layouts.length || linkedGraph"
                label="Eigene und geteilte Graphen"
              >
                <option
                  v-for="item in [
                    ...layouts,
                    ...(linkedGraph ? [linkedGraph] : []),
                  ]"
                  :key="item.id"
                  :value="item.id"
                >
                  {{ item.name }}
                </option>
              </optgroup>
            </select></label
          >
          <div class="graph-endpoints" v-if="hasSource || hasTarget">
            <label v-if="hasSource"
              >{{
                isRoute ? "Start" : lesson.id === "trees" ? "Wurzel" : "Quelle"
              }}<select v-model="start">
                <option
                  v-for="node in input.nodes"
                  :key="node.id"
                  :value="node.id"
                >
                  {{ node.label }}
                </option>
              </select></label
            >
            <label v-if="hasTarget"
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
          <div
            v-if="isRoute"
            class="graph-toggles endpoint-actions"
            role="group"
            aria-label="Knotenauswahl im Graphen"
          >
            <button
              :aria-pressed="clickEndpoint === 'start'"
              @click="clickEndpoint = 'start'"
            >
              Start setzen
            </button>
            <button
              :aria-pressed="clickEndpoint === 'target'"
              @click="clickEndpoint = 'target'"
            >
              Ziel setzen
            </button>
            <button
              class="icon-button"
              aria-label="Start und Ziel tauschen"
              title="Start und Ziel tauschen"
              @click="swapEndpoints"
            >
              <ArrowLeftRight :size="16" />
            </button>
          </div>
        </template>
        <div v-else class="experiment-inputs">
          <label
            >{{ matching ? "Muster p" : "Zeichenkette s"
            }}<input v-model="s" maxlength="48" spellcheck="false"
          /></label>
          <label
            >{{ matching ? "Text t" : "Zeichenkette t"
            }}<input v-model="t" maxlength="48" spellcheck="false"
          /></label>
        </div>
        <label v-if="lesson.id === 'matrix-powers'"
          >Potenzen bis k<select v-model="options.power">
            <option :value="undefined">
              Standard: {{ Math.max(1, input.nodes.length - 1) }}
            </option>
            <option v-for="k in 32" :key="k" :value="k">{{ k }}</option>
          </select></label
        >
        <label v-if="lesson.id === 'coloring'"
          >Verfügbare Farben<select
            :value="options.colorCount ?? 3"
            @change="
              options.colorCount = Number(
                ($event.target as HTMLSelectElement).value,
              )
            "
          >
            <option v-for="k in 8" :key="k" :value="k">{{ k }}</option>
          </select></label
        >
        <label v-if="lesson.id === 'hamilton'"
          >Gesucht<select
            :value="options.hamiltonCycle ? 'cycle' : 'path'"
            @change="
              options.hamiltonCycle =
                ($event.target as HTMLSelectElement).value === 'cycle'
            "
          >
            <option value="path">Hamiltonpfad</option>
            <option value="cycle">Hamiltonkreis</option>
          </select></label
        >
        <label v-if="lesson.id === 'anchor-match'"
          >Anker im Muster<select v-model="options.anchor">
            <option :value="undefined">Automatisch: seltenstes Zeichen</option>
            <option v-for="(char, i) in pattern" :key="i" :value="i">
              {{ i }} · {{ char === " " ? "␣" : char }}
            </option>
          </select></label
        >
        <label v-if="lesson.id === 'edit-metric'"
          >Dritte Zeichenkette r<input
            :value="options.third ?? 'saat'"
            @input="options.third = ($event.target as HTMLInputElement).value"
            maxlength="48"
            spellcheck="false"
        /></label>
        <div class="experiment-actions">
          <button v-if="busy" class="secondary-button" @click="cancel">
            <Square :size="15" /> Abbrechen
          </button>
          <button
            v-else
            class="primary-button"
            :disabled="selected === 'new' || selected === NEW_ROUTE"
            @click="run()"
          >
            <Play :size="16" /> Berechnen
          </button>
          <button class="secondary-button" @click="example">
            Beispiel laden
          </button>
          <button
            v-if="lesson.id === 'maze'"
            class="secondary-button"
            @click="build(false, 'maze')"
          >
            Labyrinth bauen
          </button>
        </div>
        <details class="experiment-options">
          <summary>Weitere Einstellungen</summary>
          <template v-if="isGraph">
            <p class="graph-field-help">{{ effective.description }}</p>
            <div
              class="graph-toggles"
              role="group"
              aria-label="Kanteneigenschaften"
            >
              <button
                :disabled="xmlMode"
                :aria-pressed="weighted"
                @click="weighted = !weighted"
              >
                Gewichtet
              </button>
              <button
                :disabled="xmlMode"
                :aria-pressed="directed"
                @click="directed = !directed"
              >
                Gerichtet
              </button>
            </div>
            <label
              v-if="
                !isRoute &&
                ['bfs', 'dfs', 'bellman', 'dijkstra'].includes(lesson.id)
              "
              >Suchumfang<select v-model="mode">
                <option value="source">Ab einer Quelle</option>
                <option value="target">Zum Ziel (Gᵀ)</option>
                <option value="all">Gesamter Graph</option>
              </select></label
            >
            <p v-if="!directed" class="graph-field-help">
              Gegenkanten teilen sich das kleinere Gewicht. Schlingen werden
              ausgeblendet.
            </p>
            <button
              class="secondary-button graph-edit-button"
              @click="build(true)"
            >
              <Network :size="14" /> Graph bearbeiten
            </button>
          </template>
          <p v-else class="graph-field-help">
            Leere Texte sind erlaubt. Positionen zählen Unicode-Codepoints ab 0.
          </p>
          <div class="experiment-inputs">
            <label
              >Schrittlimit<input
                v-model.number="stepLimit"
                type="number"
                min="1"
                :max="maxLimit"
                @blur="stepLimit = boundedLimit()"
            /></label>
            <label
              >Tempo<select v-model.number="delay">
                <option v-if="![850, 450, 120].includes(delay)" :value="delay">
                  {{ delay }} ms / Schritt
                </option>
                <option :value="850">Langsam</option>
                <option :value="450">Normal</option>
                <option :value="120">Schnell</option>
              </select></label
            >
          </div>
        </details>
      </aside>
      <section
        ref="visualPanel"
        class="panel lab-visual-panel experiment-visual"
        aria-label="Simulation und Ablauf"
      >
        <div class="graph-readout">
          <div class="graph-readout-title">
            <h2>
              {{
                result
                  ? runName
                  : isRoute
                    ? routeName
                    : (activeOwn?.name ?? lesson.name)
              }}
            </h2>
            <span>{{
              isGraph
                ? `${input.nodes.length} Knoten · ${input.edges.length} Kanten · ${input.directed ? "gerichtet" : "ungerichtet"}${weighted && !xmlMode ? " · gewichtet" : ""}`
                : `${Array.from(s).length} / ${Array.from(t).length} Zeichen`
            }}</span>
          </div>
          <div v-if="result">
            <span>Berechnung</span
            ><strong>{{ result.milliseconds.toFixed(1) }} ms</strong>
          </div>
        </div>
        <GraphBoard
          v-if="isGraph"
          :preset="displayPreset"
          :graph="displayGraph"
          :directed="input.directed"
          :weighted="weighted && !xmlMode"
          :start="hasSource ? input.start : -1"
          :target="hasTarget ? input.target : -1"
          :selectable="hasSource || hasTarget"
          :visited="isRoute ? routeTrace.visited : colors"
          :search-edges="isRoute ? routeTrace.edges : undefined"
          :source="routeTrace.source"
          :path="
            routeAtEnd && routeResult?.found ? routeResult.path : undefined
          "
          :current="state.current"
          :step="step"
          :tempo="delay"
          :lesson="
            isRoute
              ? undefined
              : {
                  ...state,
                  groups: visibleGroups,
                  edge: showTree ? undefined : state.edge,
                  rejected: showTree ? undefined : state.rejected,
                  selected: showTree
                    ? displayPreset.edges.map((_, id) => id)
                    : (reconstructed?.selected ?? state.selected),
                }
          "
          :marked="xmlMode ? xmlSelected : []"
          @select="selectGraphNode"
        />
        <StringBoard v-else :s="s" :t="t" :state="state" :matching="matching" />
        <div v-if="isGraph" class="graph-legend">
          <template v-if="isRoute">
            <span class="graph-start-key">Start</span>
            <span class="graph-target-key">Ziel</span>
            <span class="search-key">Suche</span>
            <span
              v-if="routeId === 'bidirectional' || activeRoute"
              class="backward-key"
              >Rückwärtssuche</span
            >
            <span class="route-key">Gefundener Weg</span>
          </template>
          <template v-else>
            <span class="search-key">offen / aktueller Schritt</span>
            <span class="route-key">ausgewählte Kanten</span>
            <span>Komponenten haben gleiche Farben</span>
            <span v-if="state.transpose">Pfeile umgedreht · Gᵀ</span>
          </template>
        </div>
        <div v-if="isGraph && treeParents" class="lab-tree-tools">
          <button
            class="secondary-button"
            :aria-pressed="showTree"
            @click="treeOnly = !treeOnly"
          >
            {{ showTree ? "Ganzer Graph" : "Nur Suchbaum / Suchwald" }}
          </button>
          <span v-if="showTree"
            >Kanten aus pre · Gesamtgewicht
            {{
              displayPreset.edges.reduce((sum, edge) => sum + edge[2], 0)
            }}</span
          >
        </div>
        <LabPlayback
          :key="result ? result.milliseconds : 0"
          :step="step"
          :total="maxStep"
          :delay="delay"
          @seek="step = $event"
        />
        <div
          class="lab-step-message"
          :role="busy || !result ? 'status' : undefined"
        >
          <p v-if="error" role="alert">{{ error }}</p>
          <p v-else-if="busy">Ablauf wird berechnet …</p>
          <p v-else-if="!result">Mit „Berechnen“ den Ablauf vorbereiten.</p>
          <template v-else>
            <span>{{ step === 0 ? "Initialzustand" : `Schritt ${step}` }}</span>
            <p :key="`${selected}-${step}-${frame?.message}`">
              {{ frame?.message }}
            </p>
            <p v-if="step === 0 && maxStep" class="lab-next-hint">
              Abspielen oder mit den Pfeilen Schritt für Schritt weitergehen.
            </p>
          </template>
        </div>
        <SearchArrays
          v-if="routeResult"
          :nodes="input.nodes"
          :frames="routeResult.arrayFrames"
          :order="routeResult.traceNodes"
          :step="step"
          :side="routeResult.traceSides[step - 1]"
          :breadth-first="routeId === 'bfs'"
        />
        <template v-else-if="frame">
          <h3 class="live-state-heading">Live-Zustand</h3>
          <LabState :state="state" :before="before" :input="input" />
        </template>
        <div v-if="result" class="lab-run-result">
          <p v-if="result.limited">
            Schrittlimit erreicht. Für einen längeren Ablauf das Limit erhöhen
            und neu berechnen.
          </p>
          <p v-if="step === maxStep">{{ result.result }}</p>
          <p v-if="reconstructed">{{ reconstructed.text }}</p>
          <button class="secondary-button" @click="exportResult">
            <Download :size="14" /> Ablauf exportieren
          </button>
        </div>
      </section>
    </div>
    <p v-if="notice" role="status" class="lab-notice">{{ notice }}</p>
    <template v-if="!builder">
      <details
        v-if="isRoute"
        class="panel lab-facts"
        @toggle="notationOpen = ($event.target as HTMLDetailsElement).open"
      >
        <summary>Algorithmus erklärt: {{ routeName }}</summary>
        <p v-if="routeId" class="route-introduction">
          {{ GRAPH_ALGORITHMS[routeId].description }}
        </p>
        <GraphNotation
          v-if="notationOpen"
          :graph="displayGraph"
          :weighted="weighted"
          :start="input.start"
          :target="input.target"
          :algorithm="routeId"
          :algorithm-name="routeName"
          :custom-notation="readGraphNotation(activeRoute?.notation)"
          :result="routeAtEnd ? routeResult : undefined"
          :step="step"
          :current="state.current"
        />
      </details>
      <details v-else class="panel lab-explanation experiment-reference">
        <summary>Algorithmus erklärt: {{ lesson.name }}</summary>
        <p>{{ lesson.introduction }}</p>
        <p v-if="!isGraph">
          |s| ist die Länge. s[i] bezeichnet ein Zeichen, s[i:j] den Abschnitt
          von i bis j−1. s[:i] ist ein Präfix, s[i:] ein Suffix und ε die leere
          Zeichenkette.
        </p>
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
      </details>
      <details
        v-if="isGraph && lesson.id === 'trees'"
        class="panel lab-explanation experiment-reference"
      >
        <summary>Baumbeziehungen und XML</summary>
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
      </details>
      <details v-if="isGraph" class="panel lab-facts">
        <summary>Graph-Notation, Eigenschaften und Pfade</summary>
        <GraphFacts :input="input" />
      </details>
      <div v-if="editorOpen" ref="editorHost" class="graph-editor-host">
        <StrategyEditor
          v-if="isRoute"
          mode="graph"
          :source-id="routeEditorSource"
          :strategies="ownRoutes"
          @save="saveRoute"
          @remove="removeRoute"
          @close="editorOpen = false"
        />
        <LessonEditor
          v-else
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
