<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from "vue";
import { Download, LoaderCircle, RotateCcw } from "lucide-vue-next";
import type { CustomStrategy } from "../core/types";
import { runRouteCode } from "../services/route-sandbox";
import {
  ROUTE_ALGORITHMS,
  type RoadGraph,
  type RouteComparisonRow,
} from "../routing/types";

interface ComparisonMetrics {
  found: boolean;
  distance: number | null;
  expanded: number;
  milliseconds: number;
}
type ComparisonReply =
  | {
      type: "comparison";
      rows: Array<ComparisonMetrics & { algorithm: string }>;
    }
  | { type: "comparison-row"; row: ComparisonMetrics };

const props = defineProps<{
  graph: RoadGraph | null;
  start: number;
  target: number;
  strategies: CustomStrategy[];
}>();
const emit = defineEmits<{ update: [rows: RouteComparisonRow[]] }>();
const rows = ref<RouteComparisonRow[]>([]),
  running = ref(false),
  notice = ref("");
let controller: AbortController | null = null,
  worker: Worker | null = null;
let generation = 0,
  timer: ReturnType<typeof setTimeout> | undefined;
const integer = new Intl.NumberFormat("de-DE");
const decimal = (value: number, digits = 2) =>
  value.toLocaleString("de-DE", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
const baseline = computed(() => {
  const row = rows.value.find((r) => r.algorithm === "dijkstra");
  return row?.state === "done" && row.found ? row.distance : null;
});
const completed = computed(
  () => rows.value.filter((r) => ["done", "error"].includes(r.state)).length,
);
function gap(row: RouteComparisonRow): number | null {
  return row.state === "done" &&
    row.found &&
    row.distance !== null &&
    baseline.value !== null
    ? Math.max(0, row.distance - baseline.value)
    : null;
}
function isShortest(row: RouteComparisonRow) {
  const difference = gap(row);
  return difference !== null && difference < 0.001;
}
function extra(row: RouteComparisonRow) {
  const meters = gap(row);
  if (meters === null) return "—";
  if (meters < 0.001) return "0 m";
  return `+${decimal(meters, 1)} m${baseline.value! > 0 ? ` (+${decimal((meters / baseline.value!) * 100, 1)} %)` : ""}`;
}
function guarantee(row: RouteComparisonRow) {
  if (["dijkstra", "astar", "bidirectional"].includes(row.algorithm))
    return "Kürzeste Strecke garantiert";
  return row.algorithm === "bfs"
    ? "Wenigste Kanten garantiert"
    : "Keine Kürzestweg-Garantie";
}
function publish() {
  emit(
    "update",
    rows.value.map((row) => ({ ...row })),
  );
}
function initialize() {
  rows.value = [
    ...Object.entries(ROUTE_ALGORITHMS).map(([id, info]) => ({
      id,
      name: info.name,
      custom: false,
    })),
    ...props.strategies.map((s) => ({ id: s.id, name: s.name, custom: true })),
  ].map((item) => ({
    algorithm: item.id,
    name: item.name,
    custom: item.custom,
    state: "waiting",
    found: null,
    distance: null,
    expanded: null,
    milliseconds: null,
  }));
  publish();
}
function stop() {
  generation++;
  clearTimeout(timer);
  controller?.abort();
  controller = null;
  worker?.terminate();
  worker = null;
  running.value = false;
}
function cancel() {
  stop();
  for (const row of rows.value)
    if (row.state === "waiting" || row.state === "running")
      row.state = "cancelled";
  notice.value =
    "Vergleich abgebrochen. Bereits berechnete Ergebnisse bleiben sichtbar.";
  publish();
}
// This worker is separate from the animated route. Each request receives one reply.
function ask(
  instance: Worker,
  message: unknown,
  signal: AbortSignal,
): Promise<ComparisonReply> {
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      clearTimeout(timeout);
      instance.removeEventListener("message", receive);
      instance.removeEventListener("error", fail);
      signal.removeEventListener("abort", abort);
    };
    const receive = ({ data }: MessageEvent) => {
      cleanup();
      data.type === "error" ? reject(new Error(data.error)) : resolve(data);
    };
    const fail = (event: ErrorEvent) => {
      cleanup();
      reject(
        new Error(event.message || "Der Vergleichs-Worker ist ausgefallen."),
      );
    };
    const abort = () => {
      cleanup();
      reject(new DOMException("Abgebrochen", "AbortError"));
    };
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error("Zeitlimit bei der Auswertung überschritten."));
    }, 10000);
    instance.addEventListener("message", receive);
    instance.addEventListener("error", fail);
    signal.addEventListener("abort", abort, { once: true });
    if (signal.aborted) abort();
    else {
      try {
        instance.postMessage(message);
      } catch (error) {
        cleanup();
        reject(error);
      }
    }
  });
}
async function compare() {
  stop();
  initialize();
  notice.value = "";
  const graph = props.graph;
  if (!graph || !graph.nodes[props.start] || !graph.nodes[props.target]) return;
  const current = generation,
    start = props.start,
    target = props.target;
  const strategies = props.strategies.map((s) => ({ ...s }));
  const execution = new AbortController();
  controller = execution;
  const instance = new Worker(
    new URL("../workers/routing.ts", import.meta.url),
    { type: "module" },
  );
  worker = instance;
  running.value = true;
  try {
    for (const row of rows.value) if (!row.custom) row.state = "running";
    const response = await ask(
      instance,
      {
        type: "compare",
        start,
        target,
        graph: {
          nodes: graph.nodes.map(({ id, lat, lon }) => ({ id, lat, lon })),
          arcs: graph.arcs.map(({ from, to, length }) => ({
            from,
            to,
            length,
          })),
          incoming: graph.incoming,
          outgoing: graph.outgoing,
        },
      },
      execution.signal,
    );
    if (current !== generation) return;
    if (response.type !== "comparison")
      throw new Error("Ungültige Antwort beim Vergleich.");
    for (const result of response.rows) {
      const row = rows.value.find((r) => r.algorithm === result.algorithm)!;
      Object.assign(row, result, {
        state: "done",
        distance: result.found ? result.distance : null,
      });
    }
    publish();
    for (const strategy of strategies) {
      if (current !== generation) return;
      const row = rows.value.find((r) => r.algorithm === strategy.id)!;
      row.state = "running";
      try {
        const output = await runRouteCode(
          graph,
          start,
          target,
          strategy.code,
          execution.signal,
        );
        const response = await ask(
          instance,
          { type: "compare-custom", start, target, output },
          execution.signal,
        );
        if (current !== generation) return;
        if (response.type !== "comparison-row")
          throw new Error("Ungültige Antwort bei der Routenauswertung.");
        Object.assign(row, response.row, { state: "done" });
      } catch (error) {
        if (current !== generation) return;
        row.state = "error";
        row.error = error instanceof Error ? error.message : String(error);
      }
      publish();
    }
  } catch (error) {
    if (current !== generation) return;
    notice.value = error instanceof Error ? error.message : String(error);
    for (const row of rows.value)
      if (row.state === "running" || row.state === "waiting") {
        row.state = "error";
        row.error = notice.value;
      }
    publish();
  } finally {
    instance.terminate();
    if (current === generation) {
      running.value = false;
      worker = null;
      controller = null;
    }
  }
}
function schedule() {
  stop();
  initialize();
  notice.value = "";
  if (props.graph) timer = setTimeout(compare, 180);
}
function exportComparison() {
  const data = {
    city: props.graph?.name,
    osmTimestamp: props.graph?.osmTimestamp,
    start: props.graph?.nodes[props.start],
    target: props.graph?.nodes[props.target],
    shortestDistanceMeters: baseline.value,
    results: rows.value.map((row) => ({
      ...row,
      extraMeters: gap(row),
      shortest: gap(row) === null ? null : isShortest(row),
    })),
  };
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = `algosim-vergleich-${props.graph?.id ?? "karte"}.json`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
watch(
  [
    () => props.graph,
    () => props.start,
    () => props.target,
    () => props.strategies.map((s) => [s.id, s.name, s.code]),
  ],
  schedule,
  { immediate: true },
);
onBeforeUnmount(stop);
</script>

<template>
  <section
    class="comparison-panel panel"
    aria-labelledby="comparison-title"
    :aria-busy="running"
  >
    <div class="comparison-heading">
      <div>
        <h2 id="comparison-title">Alle Algorithmen im Vergleich</h2>
        <p v-if="graph">
          {{ graph.name }} · identischer Start und identisches Ziel für alle
          {{ rows.length }} Algorithmen
        </p>
        <p v-else>Werte erscheinen, sobald die Karte geladen ist.</p>
      </div>
      <div class="comparison-actions">
        <button v-if="running" class="secondary-button" @click="cancel">
          Vergleich abbrechen
        </button>
        <button
          v-else
          class="secondary-button"
          :disabled="!graph"
          @click="compare"
        >
          <RotateCcw :size="14" /> Neu vergleichen
        </button>
        <button
          class="icon-button"
          :disabled="!completed"
          aria-label="Vergleich als JSON exportieren"
          @click="exportComparison"
        >
          <Download :size="16" />
        </button>
      </div>
    </div>
    <p v-if="baseline !== null" class="comparison-reference">
      Kürzeste Strecke: <strong>{{ decimal(baseline, 1) }} m</strong> ·
      Referenz: Dijkstra
    </p>
    <p v-if="running" class="comparison-progress" role="status">
      <LoaderCircle :size="14" class="spin" /> {{ completed }} von
      {{ rows.length }} ausgewertet
    </p>
    <p v-if="notice" role="status">{{ notice }}</p>
    <div
      class="table-scroll"
      tabindex="0"
      aria-label="Algorithmusvergleich, auf kleinen Bildschirmen seitlich scrollbar"
    >
      <table class="comparison-table">
        <thead>
          <tr>
            <th scope="col">Algorithmus</th>
            <th scope="col">Rechenzeit</th>
            <th scope="col">Strecke</th>
            <th scope="col">Mehrweg</th>
            <th scope="col">Kürzeste Strecke?</th>
            <th scope="col">Expandierte Knoten</th>
            <th scope="col">Status</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in rows" :key="row.algorithm">
            <th scope="row">
              <span
                >{{ row.name
                }}<small v-if="row.custom"> · Eigener Code</small></span
              ><small>{{ guarantee(row) }}</small>
            </th>
            <td>
              {{
                row.milliseconds === null
                  ? "—"
                  : `${decimal(row.milliseconds)} ms`
              }}
            </td>
            <td
              :title="
                row.distance === null ? undefined : `${row.distance} Meter`
              "
            >
              {{
                row.distance === null ? "—" : `${decimal(row.distance, 1)} m`
              }}
            </td>
            <td>{{ extra(row) }}</td>
            <td>
              {{ gap(row) === null ? "—" : isShortest(row) ? "Ja" : "Nein" }}
            </td>
            <td>
              {{ row.expanded === null ? "—" : integer.format(row.expanded) }}
            </td>
            <td class="comparison-state">
              <span v-if="row.state === 'done'">{{
                row.found ? "Weg gefunden" : "Kein Weg gefunden"
              }}</span>
              <span v-else-if="row.state === 'error'"
                >Fehler<small>{{ row.error }}</small></span
              >
              <span v-else-if="row.state === 'cancelled'">Abgebrochen</span>
              <span v-else-if="row.state === 'running'">Wird berechnet …</span>
              <span v-else>{{
                graph ? "Wartet …" : "Karte wird geladen …"
              }}</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <p>
      Der Vergleich aktualisiert sich bei neuen Punkten oder geändertem Code
      automatisch. Eigene Algorithmen laufen nacheinander mit jeweils fünf
      Sekunden Zeitlimit. „Ja“ bezieht sich auf diesen Weg; die allgemeine
      Garantie steht unter dem Namen. Einzellaufzeiten sind Richtwerte und
      hängen von Browser, Rechner und Ausführungsumgebung ab.
    </p>
  </section>
</template>
