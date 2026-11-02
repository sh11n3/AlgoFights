<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from "vue";
import { basicSetup, EditorView } from "codemirror";
import { javascript } from "@codemirror/lang-javascript";
import { oneDark } from "@codemirror/theme-one-dark";
import {
  Check,
  CheckCheck,
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

const props = defineProps<{ strategies: CustomStrategy[] }>();
const emit = defineEmits<{
  save: [strategy: CustomStrategy];
  remove: [id: string];
  close: [];
}>();
const host = ref<HTMLElement>(),
  name = ref("Meine Strategie"),
  selected = ref(""),
  notice = ref(""),
  valid = ref(false),
  checking = ref(false);
const input = ref<HTMLInputElement>();
let editor: EditorView | null = null,
  draft = TEMPLATE,
  generation = 0;
let sandbox: Awaited<ReturnType<typeof createSandbox>> | null = null;
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
  const strategy = props.strategies.find((s) => s.id === selected.value);
  name.value = strategy?.name ?? "Meine Strategie";
  replace(strategy?.code ?? TEMPLATE);
}
function stopCheck() {
  generation++;
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
  const id = selected.value || `custom:${crypto.randomUUID()}`;
  emit("save", { id, name: name.value.trim().slice(0, 40), code: draft });
  selected.value = id;
  notice.value =
    "Strategie gespeichert. Du kannst sie jetzt als Teilnehmer auswählen.";
}
function reset() {
  stopCheck();
  selected.value = "";
  name.value = "Meine Strategie";
  replace(TEMPLATE);
}
function exportCode() {
  const file = new Blob(
    [
      JSON.stringify(
        { format: "algofights-strategy-v1", name: name.value, code: draft },
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
    if (file.size > 60000)
      throw new Error("Die Datei darf höchstens 60 KB groß sein.");
    const parsed = JSON.parse(await file.text());
    if (
      parsed.format !== "algofights-strategy-v1" ||
      typeof parsed.code !== "string" ||
      parsed.code.length > 50000 ||
      typeof parsed.name !== "string"
    )
      throw new Error("Keine gültige AlgoFIghts-Strategiedatei.");
    stopCheck();
    selected.value = "";
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
watch(name, clearNotice);
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
        "aria-label": "JavaScript-Code deiner Strategie",
      }),
      EditorView.updateListener.of((update) => {
        if (update.docChanged) {
          draft = update.state.doc.toString();
          clearNotice();
        }
      }),
      EditorView.theme({
        "&": {
          minHeight: "340px",
          fontSize: "13px",
          backgroundColor: "#10151e",
        },
        ".cm-scroller": { fontFamily: "var(--mono)", overflow: "auto" },
      }),
    ],
  });
});
onBeforeUnmount(() => {
  stopCheck();
  editor?.destroy();
});
</script>
<template>
  <section class="code-lab panel" aria-label="Strategie-Editor">
    <div class="section-heading">
      <div>
        <span class="eyebrow">DEIN CODE. DEIN SPIEL.</span>
        <h2>Code-Labor <span class="tag">JAVASCRIPT</span></h2>
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
        <div class="editor-fields">
          <label
            >Strategie<select v-model="selected" @change="select">
              <option value="">Neue Strategie</option>
              <option v-for="s in strategies" :key="s.id" :value="s.id">
                {{ s.name }}
              </option>
            </select></label
          ><label>Name<input v-model="name" maxlength="40" /></label>
        </div>
        <div class="editor-filename">
          <FileCode2 :size="15" /> nextMove.js
          <span>lokal · isoliert ausgeführt</span>
        </div>
        <div ref="host" class="code-editor"></div>
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
            <LoaderCircle v-if="checking" class="spin" :size="16" /><CheckCheck
              v-else
              :size="16"
            />
            Prüfen</button
          ><button
            class="icon-button"
            title="Vorlage zurücksetzen"
            aria-label="Auf Vorlage zurücksetzen"
            @click="reset"
          >
            <RotateCcw :size="17" /></button
          ><button
            v-if="selected"
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
      </div>
      <aside class="api-docs">
        <span class="eyebrow">DIE SCHNITTSTELLE</span>
        <h3>Ein Zug. Vier Richtungen.</h3>
        <p>
          Definiere <code>nextMove(state, memory)</code>. Gib ein Objekt mit
          <code>direction</code> und optional <code>memory</code> zurück.
        </p>
        <dl>
          <dt>state.position · x · y</dt>
          <dd>Eigene Position, Koordinaten ab 0.</dd>
          <dt>state.direction</dt>
          <dd>Aktuelle Richtung: up, right, down, left.</dd>
          <dt>state.score · step</dt>
          <dd>Deine Punkte und der Simulationsschritt.</dd>
          <dt>state.neighbors.right</dt>
          <dd>{ x, y, type, free } für jede Richtung.</dd>
          <dt>state.availableMoves</dt>
          <dd>Array aller gerade erlaubten Richtungen.</dd>
          <dt>state.cell(x, y)</dt>
          <dd>free, wall, self oder opponent. Bis zu 128 Abfragen pro Zug.</dd>
          <dt>state.random()</dt>
          <dd>Seed-basierter Zufall von 0 bis kleiner 1.</dd>
          <dt>state.width · height</dt>
          <dd>Logische Rastergröße der Arena.</dd>
          <dt>memory</dt>
          <dd>
            Eigener JSON-Speicher, anfangs {}. Bis zu 16 KB. Getrennt für jeden
            Teilnehmer.
          </dd>
        </dl>
        <div class="budget-note">
          250 ms pro Zug · 45 s Rundenbudget<br />Fehler stoppen nur den
          betroffenen Algorithmus. Verlorene Zellkonflikte lassen ihn
          weiterspielen.
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
      </aside>
    </div>
  </section>
</template>
