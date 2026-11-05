<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { basicSetup, EditorView } from "codemirror";
import { javascript } from "@codemirror/lang-javascript";
import { oneDark } from "@codemirror/theme-one-dark";
import {
  Check,
  CheckCheck,
  Copy,
  Download,
  FileCode2,
  LoaderCircle,
  RotateCcw,
  Save,
  Trash2,
  Upload,
  X,
} from "lucide-vue-next";
import { TEMPLATE } from "../services/storage";
import { createSandbox } from "../services/sandbox";
import type { CustomStrategy } from "../core/types";
import { STRATEGY_EXAMPLES } from "../content/strategy-examples";
import {
  ARENA_SOURCES,
  ROUTING_SOURCES,
  ROUTING_TEMPLATE,
} from "../content/builtin-sources";
import { runRouteCode } from "../services/route-sandbox";
import { routeProbe } from "../routing/probe";
import { validateRouteOutput } from "../routing/custom";
import { PRESETS } from "../graph/presets";
import { createGraph, graphHeuristic } from "../graph/simulation";
import CodeReference from "./CodeReference.vue";
const documentationUrl = `${import.meta.env.BASE_URL}docs/editor-handbuch.html`;
const example = ref("");

const props = defineProps<{
  strategies: CustomStrategy[];
  mode?: "arena" | "route" | "graph";
  sourceId?: string;
}>();
const isGraph = props.mode === "graph";
const isRoute = isGraph || props.mode === "route";
const originals = isRoute ? ROUTING_SOURCES : ARENA_SOURCES;
const template = isRoute ? ROUTING_TEMPLATE : TEMPLATE;
const prefix = isGraph ? "graph:" : isRoute ? "route:" : "custom:";
const fileFormat = isGraph
  ? "algofights-graph-v1"
  : isRoute
    ? "algofights-route-v1"
    : "algofights-strategy-v1";
const emit = defineEmits<{
  save: [strategy: CustomStrategy];
  remove: [id: string];
  close: [];
  ready: [];
}>();
const host = ref<HTMLElement>(),
  name = ref("Meine Strategie"),
  selected = ref(""),
  notice = ref(""),
  valid = ref(false),
  checking = ref(false);
const languages = {
  javascript: "JavaScript",
  java: "Java",
  pseudocode: "Pseudocode",
} as const;
const language = ref<keyof typeof languages>("javascript");
const copyNotice = ref("");
const original = computed(() =>
  originals.find((s) => `builtin:${s.id}` === selected.value),
);
const activeExample = ref<(typeof STRATEGY_EXAMPLES)[number]>();
const reference = computed(() => original.value ?? activeExample.value);
const referenceCode = computed(() =>
  language.value === "javascript"
    ? ""
    : (reference.value?.[language.value] ?? ""),
);
const filename = computed(() => {
  if (language.value === "java")
    return isRoute ? "RouteSearch.java" : "ArenaStrategy.java";
  if (language.value === "pseudocode") return reference.value?.name;
  if (!isRoute) return "nextMove.js";
  return original.value ? `${original.value.id}.js` : "eigener-algorithmus.js";
});
const shownLineCount = computed(() =>
  language.value === "javascript"
    ? lineCount.value
    : referenceCode.value.split("\n").length,
);
watch([language, referenceCode], () => {
  copyNotice.value = "";
});
async function copyReference() {
  const code = referenceCode.value;
  try {
    await navigator.clipboard.writeText(code);
    if (code === referenceCode.value) copyNotice.value = "Kopiert.";
  } catch {
    if (code === referenceCode.value)
      copyNotice.value = "Bitte den Code markieren und kopieren.";
  }
}
const input = ref<HTMLInputElement>();
const lineCount = ref(1);
let editor: EditorView | null = null,
  draft = template,
  generation = 0;
let sandbox: Awaited<ReturnType<typeof createSandbox>> | null = null;
let routeCheck: AbortController | null = null;
function clearNotice() {
  notice.value = "";
  valid.value = false;
}
function replace(code: string) {
  draft = code;
  editor?.dispatch({
    changes: { from: 0, to: editor.state.doc.length, insert: code },
  });
  clearNotice();
}
function select() {
  stopCheck();
  if (isRoute && !selected.value) language.value = "javascript";
  example.value = "";
  activeExample.value = undefined;
  if (original.value) {
    name.value = `${original.value.name} – eigene Version`.slice(0, 40);
    replace(original.value.code);
    notice.value =
      "Originalcode geladen. Speichern erstellt eine eigene Kopie; das eingebaute Original bleibt erhalten.";
    return;
  }
  const strategy = props.strategies.find((s) => s.id === selected.value);
  name.value =
    strategy?.name ?? (isRoute ? "Mein Algorithmus" : "Meine Strategie");
  if (!strategy && !isRoute) activeExample.value = STRATEGY_EXAMPLES[0];
  replace(strategy?.code ?? template);
}
function stopCheck() {
  generation++;
  routeCheck?.abort();
  routeCheck = null;
  sandbox?.dispose();
  sandbox = null;
  checking.value = false;
}
async function validate(): Promise<boolean> {
  stopCheck();
  const current = generation;
  checking.value = true;
  clearNotice();
  if (draft.length > 50000) {
    notice.value = "Der Strategiecode darf höchstens 50.000 Zeichen lang sein.";
    checking.value = false;
    return false;
  }
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    if (isRoute) {
      routeCheck = new AbortController();
      if (isGraph) {
        const preset = PRESETS[0];
        const graph = createGraph(preset, true, true);
        const output = await runRouteCode(
          graph,
          preset.start,
          preset.target,
          draft,
          routeCheck.signal,
          {
            heuristic: graphHeuristic(graph, preset.target),
            stepLimit: 100,
            weighted: true,
            directed: true,
          },
        );
        validateRouteOutput(graph, preset.start, preset.target, output);
        if (output.limited)
          throw new Error(
            "Der Probelauf hat das Limit von 100 Suchschritten erreicht.",
          );
      } else {
        const graph = routeProbe();
        const output = await runRouteCode(
          graph,
          0,
          3,
          draft,
          routeCheck.signal,
        );
        validateRouteOutput(graph, 0, 3, output);
      }
      if (current !== generation) return false;
      valid.value = true;
      notice.value =
        "Syntax, Rückgabe und gerichtete Route am Probegraphen sind gültig. Dies beweist keine allgemeine Korrektheit oder Optimalität.";
      return true;
    }
    const created = await createSandbox({
      shape: "square",
      resolution: 32,
      seed: "editor-check",
      duration: 12,
      participants: [
        {
          name: name.value,
          color: "#51d8ed",
          strategy: "custom:check",
          code: draft,
        },
        { name: "Probe", color: "#f479b5", strategy: "right" },
      ],
    });
    if (current !== generation) {
      created.dispose();
      return false;
    }
    sandbox = created;
    await new Promise<void>((resolve, reject) => {
      const port = created.ports[0]!;
      let step = 0;
      timer = setTimeout(
        () =>
          reject(
            new Error(
              "Zeitlimit überschritten. Mögliche Endlosschleife; Ausführung wurde beendet.",
            ),
          ),
        1000,
      );
      port.onmessage = ({ data }) => {
        if (data.error) {
          reject(new Error(data.error));
          return;
        }
        if (step === 3) {
          resolve();
          return;
        }
        // Representative snapshots check all directions without exposing the real game.
        port.postMessage({
          delta: new Uint32Array(),
          position: 16 * 32 + 16,
          direction: "right",
          score: step + 1,
          step: ++step,
        });
      };
      port.start();
    });
    if (current !== generation) return false;
    valid.value = true;
    notice.value =
      "Syntax und drei Probezüge sind gültig. Die Zugregeln werden im Kampf erneut geprüft.";
    return true;
  } catch (e) {
    if (current === generation) {
      valid.value = false;
      notice.value = `${name.value}: ${e instanceof Error ? e.message : String(e)}`;
    }
    return false;
  } finally {
    clearTimeout(timer);
    if (current === generation) {
      sandbox?.dispose();
      sandbox = null;
      routeCheck = null;
      checking.value = false;
    }
  }
}
async function save() {
  if (!name.value.trim()) {
    notice.value = "Gib deiner Strategie einen Namen.";
    return;
  }
  if (!(await validate())) return;
  const id = selected.value.startsWith(prefix)
    ? selected.value
    : `${prefix}${crypto.randomUUID()}`;
  emit("save", { id, name: name.value.trim().slice(0, 40), code: draft });
  selected.value = id;
  activeExample.value = undefined;
  example.value = "";
  notice.value = isRoute
    ? `Algorithmus gespeichert. Er ist jetzt in ${isGraph ? "Graph Sim" : "Algo Sim"} auswählbar.`
    : "Strategie gespeichert. Du kannst sie jetzt als Teilnehmer auswählen.";
}
function saveCopy() {
  selected.value = "";
  save();
}
function reset() {
  selected.value = "";
  select();
}
function loadExample() {
  const item = STRATEGY_EXAMPLES.find((item) => item.name === example.value);
  if (!item) return;
  stopCheck();
  selected.value = "";
  activeExample.value = item;
  name.value = item.name;
  replace(item.code);
}
function exportCode() {
  const file = new Blob(
    [
      JSON.stringify(
        {
          format: fileFormat,
          name: name.value,
          code: draft,
        },
        null,
        2,
      ),
    ],
    { type: "application/json" },
  );
  const url = URL.createObjectURL(file),
    link = document.createElement("a");
  link.href = url;
  link.download = `${name.value.replace(/[^a-z0-9äöüß_-]/gi, "-") || "strategie"}.json`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
async function importCode(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (!file) return;
  try {
    if (file.size > 300000)
      throw new Error("Die Datei darf höchstens 300 KB groß sein.");
    const parsed = JSON.parse(await file.text());
    if (
      parsed.format !== fileFormat ||
      typeof parsed.code !== "string" ||
      parsed.code.length > 50000 ||
      typeof parsed.name !== "string"
    )
      throw new Error("Keine gültige AlgoFIghts-Strategiedatei.");
    stopCheck();
    selected.value = "";
    activeExample.value = undefined;
    example.value = "";
    name.value = parsed.name.slice(0, 40);
    replace(parsed.code);
    notice.value =
      "Importiert. Prüfe und speichere die Strategie, um sie zu verwenden.";
  } catch (e) {
    valid.value = false;
    notice.value = e instanceof Error ? e.message : String(e);
  }
  (event.target as HTMLInputElement).value = "";
}
watch(name, () => {
  if (checking.value) stopCheck();
  clearNotice();
});
onMounted(() => {
  editor = new EditorView({
    doc: draft,
    parent: host.value,
    extensions: [
      basicSetup,
      javascript(),
      oneDark,
      EditorView.lineWrapping,
      EditorView.contentAttributes.of({
        "aria-label": isRoute
          ? `JavaScript-Code deines ${isGraph ? "Graphalgorithmus" : "Routenalgorithmus"}`
          : "JavaScript-Code deiner Strategie",
      }),
      EditorView.updateListener.of((update) => {
        if (update.docChanged) {
          if (checking.value) stopCheck();
          draft = update.state.doc.toString();
          lineCount.value = update.state.doc.lines;
          clearNotice();
        }
      }),
      EditorView.theme({
        "&": {
          height: "min(65vh, 700px)",
          minHeight: "360px",
          fontSize: "13px",
          backgroundColor: "#10151e",
        },
        ".cm-scroller": { fontFamily: "var(--mono)", overflow: "auto" },
      }),
    ],
  });
  lineCount.value = editor.state.doc.lines;
  if (props.sourceId) {
    selected.value = props.sourceId === "new" ? "" : props.sourceId;
    select();
  } else if (!isRoute) activeExample.value = STRATEGY_EXAMPLES[0];
  emit("ready");
});
watch(
  () => props.sourceId,
  (value) => {
    if (value) {
      selected.value = value === "new" ? "" : value;
      select();
    }
  },
);
onBeforeUnmount(() => {
  stopCheck();
  editor?.destroy();
});
</script>
<template>
  <section class="code-lab panel" aria-label="Strategie-Editor">
    <div class="section-heading">
      <div>
        <h2>
          {{
            isGraph
              ? "Graph Sim · Code-Editor"
              : isRoute
                ? "Algo Sim · Code-Editor"
                : "Strategie-Editor"
          }}
        </h2>
      </div>
      <button
        class="icon-button"
        aria-label="Code-Labor schließen"
        @click="emit('close')"
      >
        <X :size="20" />
      </button>
    </div>
    <div class="editor-layout">
      <div class="editor-main">
        <div v-if="!isRoute" class="example-picker">
          <label for="example">Beispiel laden</label
          ><select id="example" v-model="example" @change="loadExample">
            <option value="" disabled>Beispiel auswählen …</option>
            <option
              v-for="item in STRATEGY_EXAMPLES"
              :key="item.name"
              :value="item.name"
            >
              {{ item.name }}
            </option>
          </select>
        </div>
        <div class="editor-fields">
          <label
            >{{ isRoute ? "Algorithmus" : "Strategie"
            }}<select v-model="selected" @change="select">
              <option value="">
                {{ isRoute ? "Eigenen Algorithmus bauen" : "Neue Strategie" }}
              </option>
              <optgroup label="Eingebaute Algorithmen · als Kopie bearbeiten">
                <option
                  v-for="s in originals"
                  :key="s.id"
                  :value="`builtin:${s.id}`"
                >
                  {{ s.name }}
                </option>
              </optgroup>
              <optgroup label="Eigene Algorithmen">
                <option v-for="s in strategies" :key="s.id" :value="s.id">
                  {{ s.name }}
                </option>
              </optgroup>
            </select></label
          ><label>Name<input v-model="name" maxlength="40" /></label>
        </div>
        <div class="editor-languages" role="group" aria-label="Codesprache">
          <button
            v-for="(label, id) in languages"
            :key="id"
            :aria-pressed="language === id"
            @click="language = id"
          >
            {{ label }}
          </button>
        </div>
        <div
          v-if="language === 'javascript' || referenceCode"
          class="editor-filename"
        >
          <FileCode2 :size="15" />
          {{ filename }}
          <span
            >{{ languages[language] }} · {{ shownLineCount }}
            {{ shownLineCount === 1 ? "Zeile" : "Zeilen" }}</span
          >
        </div>
        <div
          v-show="language === 'javascript'"
          ref="host"
          class="code-editor"
        ></div>
        <template v-if="language !== 'javascript'">
          <template v-if="referenceCode">
            <CodeReference
              :key="language"
              :code="referenceCode"
              :language="language"
            />
            <div class="file-actions editor-reference-actions">
              <button @click="copyReference">
                <Copy :size="14" /> Kopieren
              </button>
              <span role="status">{{
                copyNotice ||
                (language === "java"
                  ? "Java 17 · Referenz zum Original"
                  : "Pseudocode · Referenz zum Original")
              }}</span>
            </div>
          </template>
          <div v-else class="editor-reference-empty">
            <p>
              Wähle einen eingebauten Algorithmus oder ein Beispiel, um die
              Referenz zu lesen. Eigener Code steht unter JavaScript.
            </p>
            <button class="secondary-button" @click="language = 'javascript'">
              Zum JavaScript-Editor
            </button>
          </div>
        </template>
        <template v-if="language === 'javascript'">
          <div
            v-if="notice"
            class="editor-notice"
            :class="{ success: valid }"
            role="status"
          >
            <Check v-if="valid" :size="16" />{{ notice }}
          </div>
          <div class="editor-actions">
            <button class="primary-button" :disabled="checking" @click="save">
              <Save :size="16" /> Speichern</button
            ><button
              class="secondary-button"
              :disabled="checking"
              @click="validate"
            >
              <LoaderCircle
                v-if="checking"
                class="spin"
                :size="16"
              /><CheckCheck v-else :size="16" /> Prüfen</button
            ><button
              class="icon-button"
              title="Vorlage zurücksetzen"
              aria-label="Auf Vorlage zurücksetzen"
              @click="reset"
            >
              <RotateCcw :size="17" /></button
            ><button
              v-if="selected.startsWith(prefix)"
              class="icon-button danger"
              aria-label="Strategie löschen"
              @click="
                emit('remove', selected);
                reset();
              "
            >
              <Trash2 :size="17" />
            </button>
          </div>
          <div class="file-actions">
            <button
              v-if="selected.startsWith(prefix)"
              :disabled="checking"
              @click="saveCopy"
            >
              Als neue Kopie speichern
            </button>
            <button
              v-if="checking"
              @click="
                stopCheck();
                notice = 'Prüfung abgebrochen.';
              "
            >
              Prüfung abbrechen
            </button>
          </div>
          <div class="file-actions">
            <button @click="input?.click()">
              <Upload :size="14" /> Importieren</button
            ><button @click="exportCode">
              <Download :size="14" /> Exportieren</button
            ><input
              ref="input"
              hidden
              type="file"
              accept=".json,application/json"
              @change="importCode"
            /><span>Nur eigenen, vertrauten Code verwenden.</span>
          </div>
        </template>
      </div>
      <aside v-if="isRoute" class="api-docs">
        <h3>Wegsuche-Schnittstelle</h3>
        <p>
          Definiere <code>findRoute(graph)</code>. Der Aufruf berechnet die
          gesamte Suche synchron. Eigene Funktionen, Klassen und Datenstrukturen
          sind erlaubt.
        </p>
        <dl>
          <dt>graph.start · target · nodeCount</dt>
          <dd>Knoten-IDs ab 0 und Anzahl der Knoten.</dd>
          <dt>graph.nodes[id]</dt>
          <dd v-if="isGraph">
            { id, label, x, y }. id ist der Array-Index, label der sichtbare
            Name. Die Modellkoordinaten liegen zwischen 0 und 1.
          </dd>
          <dd v-else>
            { id, lat, lon }. id ist hier die originale OSM-ID; Array-Indizes
            sind die Such-IDs.
          </dd>
          <dt>graph.arcs[edge]</dt>
          <dd v-if="isGraph">
            { from, to, length }. length sind die Kosten (ungewichtet immer 1).
            Ungerichtete Kanten haben je einen Eintrag pro Richtung.
          </dd>
          <dd v-else>
            { from, to, length }. Gerichtete Kante, Länge in Metern.
          </dd>
          <template v-if="isGraph">
            <dt>graph.weighted · directed · stepLimit</dt>
            <dd>
              Aktive Gewichts- und Richtungsschalter sowie das Limit für
              protokollierte Suchschritte.
            </dd>
          </template>
          <dt>graph.outgoing[node] · incoming[node]</dt>
          <dd>
            Arrays mit ausgehenden bzw. eingehenden Kanten-IDs. Rückwärtssuche
            nutzt incoming.
          </dd>
          <dt>graph.neighbors(node)</dt>
          <dd>Ausgehende Kanten als { id, from, to, length }.</dd>
          <dt>graph.createQueue()</dt>
          <dd>
            Neue Min-Prioritätswarteschlange: push(node, priority) fügt ein,
            pop() entnimmt { node, priority } mit kleinster Priorität, peek()
            liest diesen Eintrag. Leer: null. Mehrfache Einträge sind erlaubt;
            der Algorithmus überspringt bereits abgeschlossene Knoten.
          </dd>
          <dt>graph.heuristic(node)</dt>
          <dd>
            {{
              isGraph
                ? "Skalierter geradliniger Abstand zum Ziel als untere Kostenschranke."
                : "Luftlinie zum Ziel in Metern."
            }}
          </dd>
          <dt>graph.trace(node, edge = -1, side = 0)</dt>
          <dd>
            Suchschritt aufzeichnen. edge führt zum Knoten; bei side=1 führt sie
            vom Knoten zur rückwärtigen Vorgängerposition. -1 zeichnet keine
            Kante.
            <template v-if="isGraph"
              >Rufe trace bei jeder Expansion auf. Jeder Aufruf zählt als ein
              Suchschritt; ein weiterer Aufruf über dem Limit stoppt die
              Suche.</template
            >
          </dd>
          <dt>Rückgabe</dt>
          <dd>
            <code>{ path: [Kanten-IDs] }</code> in Reihenfolge vom Start zum
            Ziel. <code>{ path: null }</code> für keinen gefundenen Weg; leeres
            Array nur bei Start = Ziel.
          </dd>
        </dl>
        <p v-if="!isGraph">
          Im Editor steht nur das gewählte Verfahren. Die Warteschlange und
          Luftlinie liefert die API; eigene Datenstrukturen sind ebenfalls
          erlaubt.
        </p>
        <div class="budget-note">
          50.000 Zeichen Code · 5 Sekunden Laufzeit.
          {{
            isGraph
              ? "Das Schrittlimit zählt Aufrufe von graph.trace. Die Laufzeitgrenze gilt auch für Code ohne trace-Aufrufe."
              : "Höchstens 250.000 Such- und Routeneinträge."
          }}
          Die Graph-Kopie ist schreibgeschützt. Der getrennte Kern prüft
          Kantenfolge, Richtung und Kosten.
        </div>
        <details>
          <summary>Prüfung und Isolation</summary>
          <p>
            Prüfen nutzt einen kleinen gerichteten Probegraphen. Ein
            erfolgreicher Probelauf beweist keine allgemeine Korrektheit.
            Eigener Code läuft in einem Worker unter isolierter Herkunft ohne
            Netzwerk- oder Speicherzugriff. Abbruch und Zeitlimit beenden diesen
            Worker. Extreme Speichernutzung oder Browserfehler bleiben Grenzen
            der Isolation. Nur vertrauten lokalen Code verwenden.
          </p>
        </details>
        <div class="editor-resources">
          <a
            :href="
              documentationUrl + (isGraph ? '#graph-sim' : '#eigene-wegsuche')
            "
            target="_blank"
            rel="noopener noreferrer"
            >Handbuch: Funktionen und Beispiele</a
          >
        </div>
      </aside>
      <aside v-else class="api-docs">
        <h3>Schnittstelle</h3>
        <p>
          Definiere <code>nextMove(state, memory)</code>. Gib ein Objekt mit
          <code>direction</code> und optional <code>memory</code> zurück.
        </p>
        <dl>
          <dt>state.position · x · y</dt>
          <dd>Eigene Position, Koordinaten ab 0.</dd>
          <dt>state.id</dt>
          <dd>
            Teilnehmernummer ab 0. Für positionsabhängige Prioritäten der
            Originale.
          </dd>
          <dt>state.direction</dt>
          <dd>Aktuelle Richtung: up, right, down, left.</dd>
          <dt>state.score · step</dt>
          <dd>Deine Punkte und der Simulationsschritt.</dd>
          <dt>state.neighbors.right</dt>
          <dd>{ x, y, type, free } für jede Richtung.</dd>
          <dt>state.availableMoves</dt>
          <dd>Array aller gerade erlaubten Richtungen.</dd>
          <dt>state.cell(x, y)</dt>
          <dd>free, wall, self oder opponent. Bis zu 512 Abfragen pro Zug.</dd>
          <dt>state.random()</dt>
          <dd>Seed-basierter Zufall von 0 bis kleiner 1.</dd>
          <dt>state.width · height</dt>
          <dd>Logische Rastergröße der Arena.</dd>
          <dt>memory</dt>
          <dd>
            Eigener JSON-Speicher, anfangs {}. Bis zu 64 KB. Getrennt für jeden
            Teilnehmer.
          </dd>
          <dt>state.returnTrips · afterReturn</dt>
          <dd>
            Anzahl der automatischen Rückläufe; afterReturn ist beim ersten
            Strategieaufruf danach wahr. memory bleibt erhalten.
            restarts/restarted sind kompatible ältere Namen.
          </dd>
          <dt>state.returnSteps</dt>
          <dd>Bereits ausgeführte Rücklaufschritte ohne zusätzliche Punkte.</dd>
        </dl>
        <div class="budget-note">
          Eigene Hilfsfunktionen, Klassen und Datenstrukturen sind erlaubt.
          50.000 Zeichen Code · 250 ms pro Zug · 45 s Rundenbudget. Bei Fehlern
          übernimmt „Geradeaus“, bis die Arena vollständig belegt ist.
        </div>
        <details>
          <summary>Sandbox & Grenzen</summary>
          <p>
            Eigener Code läuft in einem separaten Worker innerhalb eines Iframes
            mit isolierter Herkunft und ohne Netzwerk- oder Speicherzugriff. Der
            Spielkern läuft getrennt und validiert jeden Zug. Endlosschleifen
            werden durch Beenden des Workers abgebrochen. Das ist keine Garantie
            gegen Browserfehler oder absichtlich extreme Speichernutzung. Nutze
            ausschließlich vertrauten lokalen Code und für reproduzierbare
            Strategien nur state.random(), kein Math.random() oder Date.
          </p>
        </details>
        <div class="editor-resources">
          <a :href="documentationUrl" target="_blank" rel="noopener noreferrer"
            >Handbuch: Funktionen und Beispiele</a
          >
        </div>
      </aside>
    </div>
  </section>
</template>
