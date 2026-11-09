<script setup lang="ts">
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  shallowRef,
  watch,
} from "vue";
import {
  Upload,
  Download,
  ChevronLeft,
  ChevronRight,
  Presentation,
  Plus,
  X,
  Move,
  Maximize2,
  Save,
} from "lucide-vue-next";
import type { PDFDocumentProxy, PDFDocumentLoadingTask } from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import PdfSlide from "./PdfSlide.vue";
import ExamplePlayer from "./ExamplePlayer.vue";
import ExampleCatalog from "./ExampleCatalog.vue";
import ShareExample from "./ShareExample.vue";
import {
  exampleTitle,
  exampleFromLink,
  readExample,
  type Example,
} from "../sharing/examples";
import { lectureSelection } from "../sharing/actions";
import {
  loadProject,
  readProject,
  newProject,
  movedRectangle,
  PROJECT_KEY,
  MAX_PDF_BYTES,
  MAX_PROJECT_BYTES,
  type PdfIdentity,
  type LectureWidget,
  type Rectangle,
} from "../lecture/project";
import "../lecture/style.css";
const project = ref(loadProject()),
  pdf = shallowRef<PDFDocumentProxy>(),
  identity = ref<PdfIdentity>(),
  page = ref(1),
  pageInput = ref(1),
  ratio = ref(16 / 9),
  loading = ref(false),
  error = ref(""),
  notice = ref("");
const pdfInput = ref<HTMLInputElement>(),
  projectInput = ref<HTMLInputElement>(),
  stage = ref<HTMLElement>(),
  viewer = ref<HTMLElement>(),
  shell = ref<HTMLElement>();
const presenting = ref(false),
  selected = ref(""),
  showCatalog = ref(false),
  linkInput = ref("");
const setupOpen = ref(false);
const chosen = shallowRef<Example | undefined>(lectureSelection.value);
const password = ref(""),
  passwordNeeded = ref(false);
let providePassword: ((value: string) => void) | undefined;
let loadingTask: PDFDocumentLoadingTask | undefined,
  loadVersion = 0,
  observer: ResizeObserver | undefined;
const available = ref({ width: 900, height: 650 });
const players = new Map<string, InstanceType<typeof ExamplePlayer>>();
const matched = computed(
  () => !!identity.value && project.value.pdf?.sha256 === identity.value.sha256,
);
const widgets = computed(() =>
  matched.value ? (project.value.slides[String(page.value)] ?? []) : [],
);
const totalWidgets = computed(() =>
  Object.values(project.value.slides).reduce(
    (sum, list) => sum + list.length,
    0,
  ),
);
const active = computed(() =>
  widgets.value.find((w) => w.id === selected.value),
);
const slideSize = computed(() => {
  const width = presenting.value
    ? Math.min(available.value.width, available.value.height * ratio.value)
    : available.value.width;
  return {
    width: `${Math.max(100, width)}px`,
    aspectRatio: String(ratio.value),
  };
});
const enlarge = ref<string>();
let dragging:
  | {
      id: string;
      rect: Rectangle;
      x: number;
      y: number;
      resize: boolean;
      pointer: number;
    }
  | undefined;
watch(page, (value) => {
  pageInput.value = value;
  selected.value = "";
  enlarge.value = undefined;
});
watch(
  lectureSelection,
  (value) => {
    if (value) {
      chosen.value = readExample(value);
      notice.value =
        "Beispiel übernommen. PDF laden und auf der gewünschten Folie einsetzen.";
    }
  },
  { immediate: true },
);
let persistTimer: ReturnType<typeof setTimeout> | undefined;
watch(
  project,
  () => {
    clearTimeout(persistTimer);
    persistTimer = setTimeout(() => {
      try {
        localStorage.setItem(
          PROJECT_KEY,
          JSON.stringify(readProject(project.value)),
        );
      } catch {
        notice.value =
          "Automatisches Speichern nicht möglich. Projekt bitte exportieren.";
      }
    }, 250);
  },
  { deep: true },
);
function chooseExample(example: Example) {
  chosen.value = readExample(example);
  showCatalog.value = false;
  notice.value = `Ausgewählt: ${exampleTitle(example)}. Mit „Einsetzen“ auf der aktuellen Folie platzieren.`;
}
function fromLink() {
  try {
    chooseExample(exampleFromLink(linkInput.value.trim()));
    linkInput.value = "";
  } catch (cause) {
    notice.value = cause instanceof Error ? cause.message : String(cause);
  }
}
function addWidget() {
  if (!chosen.value || !matched.value) return;
  if (widgets.value.length >= 6 || totalWidgets.value >= 200) {
    notice.value =
      "Maximal sechs Simulationen pro Folie und 200 pro Vorlesung.";
    return;
  }
  const widget: LectureWidget = {
    id: crypto.randomUUID(),
    title: exampleTitle(chosen.value).slice(0, 100),
    example: readExample(chosen.value),
    rect: { x: 0.08, y: 0.1, width: 0.84, height: 0.8 },
  };
  project.value.slides[String(page.value)] = [...widgets.value, widget];
  selected.value = widget.id;
  setupOpen.value = false;
  notice.value =
    "Simulation eingefügt. Über die Kopfzeile verschieben, an der Ecke die Größe ändern.";
}
function removeWidget(id: string) {
  project.value.slides[String(page.value)] = widgets.value.filter(
    (w) => w.id !== id,
  );
  selected.value = "";
}
function beginDrag(widget: LectureWidget, event: PointerEvent, resize = false) {
  if (presenting.value || enlarge.value === widget.id) return;
  selected.value = widget.id;
  dragging = {
    id: widget.id,
    rect: { ...widget.rect },
    x: event.clientX,
    y: event.clientY,
    resize,
    pointer: event.pointerId,
  };
  (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
}
function drag(event: PointerEvent) {
  if (!dragging || event.pointerId !== dragging.pointer || !stage.value) return;
  const bounds = stage.value.getBoundingClientRect(),
    widget = widgets.value.find((w) => w.id === dragging!.id);
  if (widget)
    widget.rect = movedRectangle(
      dragging.rect,
      (event.clientX - dragging.x) / bounds.width,
      (event.clientY - dragging.y) / bounds.height,
      dragging.resize,
    );
}
function endDrag() {
  dragging = undefined;
}
function updateRect(field: keyof Rectangle, event: Event) {
  if (!active.value) return;
  const rect = { ...active.value.rect },
    value = Number((event.target as HTMLInputElement).value) / 100;
  if (!Number.isFinite(value)) return;
  if (field === "x" || field === "y")
    rect[field] = Math.max(
      0,
      Math.min(1 - rect[field === "x" ? "width" : "height"], value),
    );
  else
    rect[field] = Math.max(
      0.15,
      Math.min(1 - rect[field === "width" ? "x" : "y"], value),
    );
  active.value.rect = rect;
}
function saveState(widget: LectureWidget) {
  const example = players.get(widget.id)?.getExample();
  if (!example) {
    notice.value =
      "Eigener Programmcode kann nicht in einem Vorlesungsbeispiel gespeichert werden. Ein eingebautes Verfahren wählen.";
    return;
  }
  widget.example = readExample(example);
  notice.value =
    "Aktuelle Eingaben und Einstellungen für diese Folie übernommen.";
}
function navigate(value: number) {
  if (!pdf.value) return;
  page.value = Math.max(
    1,
    Math.min(pdf.value.numPages, Math.trunc(value) || 1),
  );
}
async function disposePdf() {
  const task = loadingTask;
  loadingTask = undefined;
  pdf.value = undefined;
  identity.value = undefined;
  await task?.destroy();
}
async function openPdf(event: Event) {
  const input = event.target as HTMLInputElement,
    file = input.files?.[0];
  input.value = "";
  if (!file) return;
  error.value = "";
  password.value = "";
  passwordNeeded.value = false;
  providePassword = undefined;
  if (file.size > MAX_PDF_BYTES) {
    error.value = "PDF zu groß: maximal 100 MiB.";
    return;
  }
  const version = ++loadVersion;
  loading.value = true;
  try {
    await disposePdf();
    if (version !== loadVersion) return;
    const buffer = await file.arrayBuffer();
    const header = new TextDecoder("latin1").decode(buffer.slice(0, 1024));
    if (!header.includes("%PDF-"))
      throw Error("Die gewählte Datei ist keine PDF.");
    const digest = await crypto.subtle.digest("SHA-256", buffer);
    const sha256 = Array.from(new Uint8Array(digest), (v) =>
      v.toString(16).padStart(2, "0"),
    ).join("");
    const lib = await import("pdfjs-dist");
    if (version !== loadVersion) return;
    lib.GlobalWorkerOptions.workerSrc = workerUrl;
    const base = new URL(
      `${import.meta.env.BASE_URL}pdf-assets/`,
      location.href,
    ).href;
    const task = lib.getDocument({
      data: new Uint8Array(buffer),
      enableXfa: false,
      cMapUrl: base + "cmaps/",
      cMapPacked: true,
      standardFontDataUrl: base + "standard_fonts/",
      wasmUrl: base + "wasm/",
      iccUrl: base + "iccs/",
    });
    loadingTask = task;
    task.onPassword = (update: (value: string) => void) => {
      if (version !== loadVersion) return;
      providePassword = update;
      passwordNeeded.value = true;
      loading.value = false;
      error.value =
        "Diese PDF benötigt ein Passwort. Es wird nicht gespeichert.";
    };
    const doc = await task.promise;
    if (version !== loadVersion) {
      await task.destroy();
      return;
    }
    if (doc.numPages > 2000) {
      await disposePdf();
      throw Error("Höchstens 2.000 PDF-Seiten pro Vorlesung.");
    }
    pdf.value = doc;
    identity.value = {
      name: file.name.slice(0, 200),
      size: file.size,
      pages: doc.numPages,
      sha256,
    };
    page.value = 1;
    password.value = "";
    passwordNeeded.value = false;
    providePassword = undefined;
    error.value = "";
    if (!project.value.pdf) {
      project.value.pdf = { ...identity.value };
      if (project.value.title === "Meine Vorlesung")
        project.value.title = file.name.replace(/\.pdf$/i, "").slice(0, 80);
    } else if (project.value.pdf.sha256 !== sha256)
      notice.value =
        "Die PDF passt nicht zum gespeicherten Projekt. Die bisherigen Zuordnungen bleiben erhalten. Lade die passende PDF oder beginne bewusst eine neue Vorlesung.";
    await nextTick();
    measure();
  } catch (cause) {
    if (version === loadVersion) {
      error.value = cause instanceof Error ? cause.message : String(cause);
      await disposePdf().catch(() => {});
    }
  } finally {
    if (version === loadVersion) loading.value = false;
  }
}
function unlock() {
  if (!providePassword) return;
  loading.value = true;
  passwordNeeded.value = false;
  providePassword(password.value);
  password.value = "";
}
function resetProject() {
  if (!identity.value) return;
  if (
    totalWidgets.value &&
    !confirm(
      "Die aktuellen Folienzuordnungen zurücksetzen? Exportiere sie vorher, wenn du sie behalten möchtest.",
    )
  )
    return;
  project.value = {
    ...newProject(),
    title: identity.value.name.replace(/\.pdf$/i, "").slice(0, 80),
    pdf: { ...identity.value },
  };
  page.value = 1;
  notice.value = "Neue Vorlesung angelegt.";
}
function exportProject() {
  const output = readProject(project.value),
    url = URL.createObjectURL(
      new Blob([JSON.stringify(output, null, 2)], { type: "application/json" }),
    );
  const a = document.createElement("a");
  a.href = url;
  a.download = "algofights-vorlesung.json";
  a.click();
  URL.revokeObjectURL(url);
  notice.value =
    "Projekt exportiert. Es enthält Folienzuordnungen und Beispiele, keine PDF-Datei.";
}
async function importProject(event: Event) {
  const input = event.target as HTMLInputElement,
    file = input.files?.[0];
  input.value = "";
  if (!file) return;
  if (file.size > MAX_PROJECT_BYTES) {
    error.value = "Projektdatei zu groß: maximal 2 MiB.";
    return;
  }
  try {
    const value = readProject(JSON.parse(await file.text()));
    if (
      totalWidgets.value &&
      !confirm("Aktuelle Zuordnungen durch das importierte Projekt ersetzen?")
    )
      return;
    project.value = value;
    page.value = 1;
    notice.value = matched.value
      ? "Projekt geladen. Die aktuelle PDF passt dazu."
      : `Projekt geladen. Bitte die dazugehörige PDF „${value.pdf?.name ?? "noch nicht festgelegt"}“ lokal auswählen.`;
    error.value = "";
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : String(cause);
  }
}
async function togglePresentation() {
  presenting.value = !presenting.value;
  if (presenting.value) {
    showCatalog.value = false;
    try {
      await shell.value?.requestFullscreen();
    } catch {
      /* Full viewport layout remains usable when fullscreen is denied. */
    }
  } else if (document.fullscreenElement === shell.value)
    await document.exitFullscreen();
  await nextTick();
  measure();
}
function fullscreenChanged() {
  if (!document.fullscreenElement && presenting.value) {
    presenting.value = false;
    void nextTick(measure);
  }
}
function measure() {
  if (viewer.value) {
    const bounds = viewer.value.getBoundingClientRect();
    available.value = {
      width: Math.max(100, bounds.width - 24),
      height: Math.max(100, bounds.height - 24),
    };
  }
}
function key(event: KeyboardEvent) {
  if (event.key === "Escape" && enlarge.value) {
    enlarge.value = undefined;
    return;
  }
  if (!presenting.value) return;
  if (event.key === "Escape") {
    presenting.value = false;
    return;
  }
  const target = event.target as HTMLElement;
  if (target.closest("input,textarea,select,button,.lecture-widget")) return;
  if (["ArrowRight", "PageDown", " "].includes(event.key)) {
    event.preventDefault();
    navigate(page.value + 1);
  }
  if (["ArrowLeft", "PageUp"].includes(event.key)) {
    event.preventDefault();
    navigate(page.value - 1);
  }
}
onMounted(() => {
  observer = new ResizeObserver(measure);
  observer.observe(viewer.value!);
  measure();
  addEventListener("keydown", key);
  document.addEventListener("fullscreenchange", fullscreenChanged);
});
onBeforeUnmount(() => {
  loadVersion++;
  void disposePdf().catch(() => {});
  observer?.disconnect();
  clearTimeout(persistTimer);
  try {
    localStorage.setItem(
      PROJECT_KEY,
      JSON.stringify(readProject(project.value)),
    );
  } catch {}
  removeEventListener("keydown", key);
  document.removeEventListener("fullscreenchange", fullscreenChanged);
});
</script>
<template>
  <section
    ref="shell"
    class="lecture-mode"
    :class="{ 'lecture-presenting': presenting }"
  >
    <header class="lecture-heading">
      <div>
        <h1>{{ project.title }}</h1>
        <p v-if="!presenting">
          Lokale PDF-Folien mit interaktiven AlgoFights-Beispielen
        </p>
      </div>
      <div class="lecture-toolbar">
        <button
          v-if="!presenting"
          :class="pdf ? 'secondary-button' : 'primary-button'"
          @click="pdfInput?.click()"
        >
          <Upload :size="15" /> PDF öffnen</button
        ><template v-if="!presenting"
          ><button class="secondary-button" @click="projectInput?.click()">
            Projekt importieren</button
          ><button class="secondary-button" @click="exportProject">
            <Download :size="15" /> Projekt exportieren
          </button></template
        ><button
          v-if="pdf && matched"
          class="primary-button"
          @click="togglePresentation"
        >
          <Presentation :size="16" />
          {{ presenting ? "Bearbeiten" : "Präsentieren" }}
        </button>
      </div>
      <input
        ref="pdfInput"
        type="file"
        hidden
        accept="application/pdf,.pdf"
        @change="openPdf"
      /><input
        ref="projectInput"
        type="file"
        hidden
        accept="application/json,.json"
        @change="importProject"
      />
    </header>
    <div v-if="error" role="alert" class="error-banner">{{ error }}</div>
    <form
      v-if="passwordNeeded"
      class="lecture-password"
      @submit.prevent="unlock"
    >
      <label
        >PDF-Passwort<input
          v-model="password"
          type="password"
          autocomplete="off" /></label
      ><button class="secondary-button">PDF entsperren</button>
    </form>
    <p v-if="notice && !presenting" class="lecture-notice" role="status">
      {{ notice }}
    </p>
    <div class="lecture-layout" :class="{ 'lecture-no-pdf': !pdf }">
      <button
        v-if="pdf && !presenting"
        class="secondary-button lecture-mobile-setup"
        :aria-expanded="setupOpen"
        aria-controls="vorlesung-einstellungen"
        @click="setupOpen = !setupOpen"
      >
        {{ setupOpen ? "Folien-Einstellungen schließen" : "Folie bearbeiten" }}
      </button>
      <aside
        v-if="pdf && !presenting"
        id="vorlesung-einstellungen"
        class="panel lecture-sidebar"
        :class="{ 'setup-open': setupOpen }"
        aria-label="Folie bearbeiten"
      >
        <label
          >Vorlesungstitel<input v-model="project.title" maxlength="80"
        /></label>
        <p class="graph-field-help">
          Die PDF bleibt lokal und wird nicht hochgeladen. Gespeichert werden
          nur Titel, Folienzuordnungen und Simulationseinstellungen. Beim
          nächsten Öffnen dieselbe PDF erneut auswählen.
        </p>
        <p v-if="project.pdf" class="lecture-file-info">
          Zugeordnet: {{ project.pdf.name }} · {{ project.pdf.pages }} Seiten
        </p>
        <button
          v-if="pdf && !matched"
          class="secondary-button"
          @click="resetProject"
        >
          Neue Vorlesung mit dieser PDF beginnen
        </button>
        <template v-if="matched">
          <h2>Simulation auf Folie {{ page }}</h2>
          <button
            class="secondary-button lecture-pick"
            :aria-expanded="showCatalog"
            @click="showCatalog = !showCatalog"
          >
            {{
              showCatalog
                ? "Beispielauswahl schließen"
                : "Vorhandenes Beispiel auswählen"
            }}
          </button>
          <ExampleCatalog
            v-if="showCatalog"
            selectable
            @select="chooseExample"
          />
          <details class="lecture-link-entry">
            <summary>Beispiel-Link einfügen</summary>
            <label
              >Beispiel-Link<input
                v-model="linkInput"
                placeholder="https://algofights.de/#beispiel=…"
                @keydown.enter.prevent="fromLink" /></label
            ><button
              class="secondary-button"
              :disabled="!linkInput.trim()"
              @click="fromLink"
            >
              Beispiel aus Link laden
            </button>
          </details>
          <p v-if="chosen" class="lecture-chosen">
            Gewählt: <strong>{{ exampleTitle(chosen) }}</strong>
          </p>
          <button
            class="primary-button lecture-add"
            :disabled="!chosen || !matched || loading"
            @click="addWidget"
          >
            <Plus :size="15" /> Auf Folie {{ page }} einsetzen
          </button>
          <template v-if="active"
            ><div class="lecture-widget-properties">
              <h2>Simulationsbereich</h2>
              <label
                >Beschriftung<input v-model="active.title" maxlength="100"
              /></label>
              <div class="lecture-rectangle">
                <label
                  v-for="field in ['x', 'y', 'width', 'height'] as const"
                  :key="field"
                  >{{
                    { x: "Links", y: "Oben", width: "Breite", height: "Höhe" }[
                      field
                    ]
                  }}
                  (%)<input
                    type="number"
                    min="0"
                    max="100"
                    step="1"
                    :value="Math.round(active.rect[field] * 100)"
                    @change="updateRect(field, $event)"
                /></label>
              </div>
              <ShareExample :example="active.example" /></div
          ></template>
          <details class="lecture-help">
            <summary>Bedienung</summary>
            <p>
              Auf der Folie den Bereich über seine Kopfzeile verschieben oder an
              der rechten unteren Ecke vergrößern. „Einstellungen“ öffnet die
              normale Bedienung des Simulators. „Übernehmen“ speichert dessen
              aktuelle Eingaben für diese Folie.
            </p>
            <p>
              Im Präsentationsmodus: Pfeiltasten oder Bild auf/ab wechseln
              Folien. Innerhalb einer Simulation bleiben deren Tasten aktiv.
              Escape verlässt die Präsentation.
            </p>
            <p>
              Die originale PDF bleibt unverändert. Zum Weitergeben PDF und
              exportierte Projektdatei zusammen bereitstellen. Keine
              Zugangsdaten in Links eintragen.
            </p>
          </details>
        </template>
      </aside>
      <div class="lecture-workspace">
        <div v-if="pdf" class="lecture-page-controls">
          <button
            class="icon-button"
            :disabled="!pdf || page <= 1"
            aria-label="Vorige Folie"
            @click="navigate(page - 1)"
          >
            <ChevronLeft :size="19" /></button
          ><label
            >Folie
            <input
              v-model.number="pageInput"
              type="number"
              min="1"
              :max="pdf?.numPages ?? 1"
              :disabled="!pdf"
              @change="navigate(pageInput)" /></label
          ><span>/ {{ pdf?.numPages ?? "—" }}</span
          ><button
            class="icon-button"
            :disabled="!pdf || page >= pdf.numPages"
            aria-label="Nächste Folie"
            @click="navigate(page + 1)"
          >
            <ChevronRight :size="19" /></button
          ><span v-if="pdf && !matched" class="lecture-mismatch"
            >PDF stimmt nicht mit dem Projekt überein</span
          >
        </div>
        <div ref="viewer" class="lecture-viewer">
          <div
            v-if="pdf"
            ref="stage"
            class="lecture-slide"
            :style="slideSize"
            @pointermove="drag"
            @pointerup="endDrag"
            @pointercancel="endDrag"
          >
            <PdfSlide
              :document="pdf"
              :page="page"
              @ratio="ratio = $event"
              @error="error = $event"
            />
            <section
              v-for="widget in widgets"
              :key="widget.id"
              class="lecture-widget"
              :class="{
                'lecture-widget-selected':
                  selected === widget.id && !presenting,
                'lecture-widget-expanded': enlarge === widget.id,
              }"
              :style="{
                left: `${widget.rect.x * 100}%`,
                top: `${widget.rect.y * 100}%`,
                width: `${widget.rect.width * 100}%`,
                height: `${widget.rect.height * 100}%`,
              }"
              @pointerdown="selected = widget.id"
            >
              <header
                class="lecture-widget-handle"
                :class="{ 'lecture-widget-draggable': !presenting }"
                @pointerdown.self.prevent="beginDrag(widget, $event)"
              >
                <span @pointerdown.prevent="beginDrag(widget, $event)"
                  ><Move v-if="!presenting" :size="13" />
                  {{ widget.title }}</span
                >
                <div>
                  <button
                    v-if="!presenting"
                    class="icon-button"
                    aria-label="Einstellungen für diese Folie übernehmen"
                    title="Aktuelle Eingaben übernehmen"
                    @click="saveState(widget)"
                  >
                    <Save :size="13" /></button
                  ><button
                    class="icon-button"
                    :aria-label="
                      enlarge === widget.id
                        ? 'Zur Folie zurück'
                        : 'Simulation vergrößern'
                    "
                    @click="
                      enlarge = enlarge === widget.id ? undefined : widget.id
                    "
                  >
                    <Maximize2 :size="13" /></button
                  ><button
                    v-if="!presenting && enlarge !== widget.id"
                    class="icon-button"
                    aria-label="Simulation von der Folie entfernen"
                    @click="removeWidget(widget.id)"
                  >
                    <X :size="14" />
                  </button>
                </div>
              </header>
              <ExamplePlayer
                :key="widget.id"
                :ref="
                  (element) => {
                    if (element)
                      players.set(
                        widget.id,
                        element as InstanceType<typeof ExamplePlayer>,
                      );
                    else players.delete(widget.id);
                  }
                "
                :example="widget.example"
                :compact="enlarge !== widget.id"
              />
              <button
                v-if="!presenting && enlarge !== widget.id"
                class="lecture-resize"
                aria-label="Simulationsbereich vergrößern oder verkleinern"
                @pointerdown.stop.prevent="beginDrag(widget, $event, true)"
              >
                ↘
              </button>
            </section>
          </div>
          <div v-else class="lecture-empty">
            <Presentation :size="35" />
            <h2>
              {{
                loading ? "PDF wird lokal geladen …" : "Vorlesung vorbereiten"
              }}
            </h2>
            <p>
              PDF öffnen, ein Beispiel auswählen und auf einer Folie platzieren.
            </p>
            <p v-if="project.pdf">
              Gespeichertes Projekt gefunden: {{ project.pdf.name }}
            </p>
          </div>
        </div>
      </div>
    </div>
    <div
      v-if="enlarge"
      class="lecture-expanded-backdrop"
      @click="enlarge = undefined"
    ></div>
  </section>
</template>
