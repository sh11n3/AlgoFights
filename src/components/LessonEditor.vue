<script setup lang="ts">
import { computed, ref, watch } from "vue";
import {
  CodeXml,
  Download,
  Upload,
  Save,
  Play,
  RotateCcw,
  X,
  Check,
} from "lucide-vue-next";
import LabCode from "./LabCode.vue";
import type { LabInput, Lesson } from "../lab/types";
import type { OwnLesson } from "../lab/storage";
import { validOwn } from "../lab/storage";
import { LESSONS } from "../lab/catalog";
import { runLesson } from "../services/lesson-runner";
import { onBeforeUnmount } from "vue";
const documentationUrl = `${import.meta.env.BASE_URL}docs/editor-handbuch.html#lehrlabor`;
const props = defineProps<{
  lesson: Lesson;
  own?: OwnLesson;
  empty?: boolean;
  input: LabInput;
  limit: number;
}>();
const emit = defineEmits<{
  save: [value: OwnLesson];
  run: [value: OwnLesson];
  close: [];
  remove: [id: string];
}>();
const name = ref(""),
  code = ref(""),
  java = ref(""),
  pseudo = ref(""),
  notation = ref(""),
  notice = ref(""),
  checking = ref(false),
  file = ref<HTMLInputElement>();
const language = ref<"javascript" | "java" | "pseudocode">("javascript");
let check: AbortController | undefined;
const importedBase = ref<string>();
const shown = computed({
  get: () =>
    language.value === "java"
      ? java.value
      : language.value === "pseudocode"
        ? pseudo.value
        : code.value,
  set: (v: string) => {
    if (language.value === "java") java.value = v;
    else if (language.value === "pseudocode") pseudo.value = v;
    else code.value = v;
  },
});
function stop() {
  check?.abort();
  check = undefined;
  checking.value = false;
}
function load() {
  stop();
  importedBase.value = undefined;
  name.value =
    props.own?.name ??
    (props.empty ? "Mein Algorithmus" : `${props.lesson.name} – Variante`);
  code.value = props.own?.code ?? (props.empty ? "" : props.lesson.source);
  java.value = props.own?.java ?? (props.empty ? "" : props.lesson.java);
  pseudo.value =
    props.own?.pseudocode ?? (props.empty ? "" : props.lesson.pseudocode);
  notation.value = props.own?.notation ?? "";
  notice.value = "";
  language.value = "javascript";
}
watch([() => props.lesson.id, () => props.own, () => props.empty], load, {
  immediate: true,
});
const draft = (): OwnLesson => ({
  id: props.own?.id ?? `lesson:${crypto.randomUUID()}`,
  base: importedBase.value ?? props.lesson.id,
  name: name.value.trim().slice(0, 60) || "Mein Algorithmus",
  code: code.value,
  java: java.value,
  pseudocode: pseudo.value,
  notation: notation.value,
});
async function validate() {
  stop();
  const controller = new AbortController();
  check = controller;
  checking.value = true;
  notice.value = "Prüfung mit der aktuellen Eingabe läuft …";
  try {
    const result = await runLesson(
      structuredClone(props.input),
      code.value,
      Math.min(props.limit, 100),
      controller.signal,
      true,
    );
    if (check === controller)
      notice.value = `Code läuft: ${result.frames.length} Zustände aufgezeichnet.${result.limited ? " Probe am Schrittlimit angehalten." : ""} Dies prüft Ausführung und Datenformat, nicht die mathematische Korrektheit.`;
  } catch (error) {
    if (check === controller)
      notice.value = error instanceof Error ? error.message : String(error);
  } finally {
    if (check === controller) {
      checking.value = false;
      check = undefined;
    }
  }
}
function save() {
  if ([code.value, java.value, pseudo.value].some((v) => v.length > 50000)) {
    notice.value = "Code zu lang: maximal 50.000 Zeichen pro Sprache.";
    return;
  }
  emit("save", draft());
  notice.value =
    "Variante lokal gespeichert. Java und Pseudocode werden als eigene Referenzen mitgespeichert.";
}
function download() {
  const value = draft(),
    url = URL.createObjectURL(
      new Blob(
        [
          JSON.stringify(
            {
              format: "algofights-lesson-v1",
              kind: props.lesson.kind,
              strategy: value,
            },
            null,
            2,
          ),
        ],
        { type: "application/json" },
      ),
    );
  const a = document.createElement("a");
  a.href = url;
  a.download = "algofights-algorithmus.json";
  a.click();
  URL.revokeObjectURL(url);
}
async function upload(event: Event) {
  const target = event.target as HTMLInputElement,
    item = target.files?.[0];
  target.value = "";
  if (!item) return;
  if (item.size > 650000) {
    notice.value = "Importdatei zu groß.";
    return;
  }
  try {
    const data = JSON.parse(await item.text());
    if (
      data.format !== "algofights-lesson-v1" ||
      data.kind !== props.lesson.kind ||
      !validOwn(data.strategy) ||
      !LESSONS.some(
        (l) => l.id === data.strategy.base && l.kind === props.lesson.kind,
      )
    )
      throw Error("Keine passende Lehrlabor-Strategie.");
    const own = data.strategy;
    importedBase.value = own.base;
    name.value = own.name;
    code.value = own.code;
    java.value = own.java;
    pseudo.value = own.pseudocode;
    notation.value = own.notation;
    notice.value = "Import geladen. Zum Übernehmen lokal speichern.";
  } catch (error) {
    notice.value =
      error instanceof Error ? error.message : "Import fehlgeschlagen.";
  }
}
onBeforeUnmount(stop);
</script>
<template>
  <section class="panel lesson-editor" aria-label="Lehrlabor Code-Editor">
    <div class="lab-editor-heading">
      <h2><CodeXml :size="18" /> Eigene Variante</h2>
      <button
        class="icon-button"
        aria-label="Editor schließen"
        @click="emit('close')"
      >
        <X :size="18" />
      </button>
    </div>
    <div class="lab-editor-toolbar">
      <label>Name<input v-model="name" maxlength="60" /></label>
      <div class="lab-tabs" aria-label="Programmiersprache">
        <button
          v-for="(label, id) in {
            javascript: 'JavaScript',
            java: 'Java',
            pseudocode: 'Pseudocode',
          }"
          :key="id"
          :aria-pressed="language === id"
          @click="language = id"
        >
          {{ label }}
        </button>
      </div>
    </div>
    <p class="lab-caption">
      JavaScript wird ausgeführt. Java und Pseudocode sind bearbeitbare
      Referenzen; Änderungen daran übersetzen den JavaScript-Code nicht
      automatisch.
    </p>
    <LabCode v-model="shown" :language="language" />
    <div class="lab-editor-actions">
      <button class="primary-button" @click="emit('run', draft())">
        <Play :size="15" /> Variante ausführen
      </button>
      <button class="secondary-button" @click="save">
        <Save :size="15" /> Speichern
      </button>
      <button class="secondary-button" @click="checking ? stop() : validate()">
        <Check :size="15" />
        {{ checking ? "Prüfung abbrechen" : "Code prüfen" }}
      </button>
    </div>
    <details class="experiment-options editor-files">
      <summary>Dateien und Varianten</summary>
      <div class="lab-editor-actions">
        <button class="secondary-button" @click="load">
          <RotateCcw :size="15" /> Zurücksetzen
        </button>
        <button class="secondary-button" @click="download">
          <Download :size="15" /> Export
        </button>
        <button class="secondary-button" @click="file?.click()">
          <Upload :size="15" /> Import
        </button>
        <button
          v-if="own"
          class="secondary-button"
          @click="emit('remove', own.id)"
        >
          Variante löschen
        </button>
        <input
          ref="file"
          type="file"
          hidden
          accept="application/json,.json"
          @change="upload"
        />
      </div>
    </details>
    <p v-if="notice" role="status" class="lab-notice">{{ notice }}</p>
    <details class="lab-api">
      <summary>Schnittstelle und Beispiel</summary>
      <p>
        <a :href="documentationUrl" target="_blank" rel="noopener"
          >Editor-Handbuch öffnen</a
        >
      </p>
      <p>
        <code>function run(input, api)</code> berechnet synchron den Ablauf und
        gibt einen Ergebnistext zurück.
        <code>api.emit(text, zustand)</code> speichert einen Schritt. Zwischen
        den Aufrufen kannst du normale lokale Variablen, Klassen und Funktionen
        verwenden.
      </p>
      <p v-if="lesson.kind === 'graph'">
        <code>input.nodes</code>: { id, label, x, y }. <code>input.edges</code>:
        { from, to, weight }. IDs sind intern Zahlen ab 0; die Anzeige verwendet
        Buchstaben. <code>input.directed</code>, <code>start</code>,
        <code>target</code> und <code>mode</code> beschreiben die Einstellungen.
        Ungerichtete Kanten stehen nur einmal in edges; beide Nachbarrichtungen
        legt dein Code an. <code>api.label(id)</code> liefert den sichtbaren
        Namen.
      </p>
      <p v-else>
        <code>input.s</code> und <code>input.t</code> enthalten die beiden
        Texte. Bei Mustersuche ist s das Muster. Nutze
        <code>Array.from(text)</code>, um nach Unicode-Codepoints zu arbeiten;
        zusammengesetzte Grapheme können weiterhin mehrere Einträge umfassen.
      </p>
      <p>
        <code>input.options</code> enthält je nach Verfahren die gewählten
        Zusatzwerte: <code>power</code>, <code>colorCount</code>,
        <code>hamiltonCycle</code>, <code>anchor</code> oder <code>third</code>.
        Felder können fehlen, wenn der Standardwert gilt.
      </p>
      <pre>
function run(input, api) {
  const werte = [0, 1, 2];
  api.emit("Initialisiert", {
    arrays: [{ name: "werte", values: werte }]
  });
  werte[1] = 7;
  api.emit("Eintrag geändert", {
    arrays: [{ name: "werte", values: werte }]
  });
  return "Fertig";
}</pre>
      <p>
        <code>arrays</code>: name, values und optional kind: "nodes" oder
        "colors". <code>matrices</code>: name, values als Zeilen, optional
        active: [Zeile, Spalte] und sources: [[Zeile, Spalte], …]. Ein Schritt
        kopiert die Werte, spätere Änderungen überschreiben frühere Frames
        nicht.
      </p>
      <p>
        <code>current</code>: Knoten-ID; <code>edge</code>: Kantenindex.
        <code>colors</code>: 0 unentdeckt, 1 offen, 2 abgeschlossen.
        <code>groups</code>: Repräsentant pro Knoten, −1 ohne Gruppe.
        <code>selected</code>/<code>rejected</code>: Kantenindizes.
        <code>queue</code>, <code>stack</code>, <code>order</code>: Knoten-IDs;
        <code>heap</code>: [[Knoten, Priorität], …];
        <code>transpose: true</code> dreht die Pfeile in diesem Zustand um.
      </p>
      <p>
        <code>string</code> markiert Zeichen: i/j als Positionen, offset als
        Musterverschiebung, result als bisheriges Ergebnis, marks als passende
        Positionspaare und edits als Liste von Operationstexten.
      </p>
      <p>
        Grenzen: 50.000 Zeichen je Codeansicht, 5 Sekunden pro Ausführung,
        höchstens 5.000 Schritte und 24 MiB geschätzte Aufzeichnungsdaten. Code
        läuft in einem Worker unter isolierter Herkunft ohne Netzwerk oder
        Browser-Speicher. Abbruch beendet die Umgebung; extreme Speichernutzung
        und Browserfehler sind dadurch nicht vollständig ausgeschlossen. Nur
        eigenen, geprüften Code verwenden.
      </p>
      <label
        >Eigene Erklärung / mathematische Notation<textarea
          v-model="notation"
          rows="3"
          maxlength="4000"
          placeholder="Voraussetzungen, Auswahlregel und Bedeutung deiner Variablen"
        />
      </label>
    </details>
  </section>
</template>
