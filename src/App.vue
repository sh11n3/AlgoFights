<script setup lang="ts">
import {
  computed,
  defineAsyncComponent,
  nextTick,
  onBeforeUnmount,
  onMounted,
  reactive,
  ref,
  watch,
} from "vue";
import {
  ArrowDownToLine,
  ArrowRight,
  Check,
  CircleHelp,
  Copy,
  CodeXml,
  Github,
  LoaderCircle,
  Maximize2,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Shuffle,
  X,
} from "lucide-vue-next";
import ArenaCanvas from "./components/ArenaCanvas.vue";
import ShareExample from "./components/ShareExample.vue";
import { exampleFromHash, readExample, type Example } from "./sharing/examples";
import "./lecture/style.css";
import { createArena } from "./core/arena";
import {
  COLORS,
  DESCRIPTIONS,
  LABELS,
  SHAPES,
  type ArenaShape,
  type CustomStrategy,
  type Settings,
} from "./core/types";
import { useBattle } from "./services/battle";
import { readSettings, readStrategies, store } from "./services/storage";
import type { FrameStats } from "./render/arena";

const settings = reactive(readSettings()),
  strategies = ref(readStrategies());
const {
  replay,
  preparing,
  progress: preparationProgress,
  error,
  run,
  abort,
} = useBattle();
const StrategyEditor = defineAsyncComponent(
  () => import("./components/StrategyEditor.vue"),
);
const AlgoSim = defineAsyncComponent(() => import("./components/AlgoSim.vue"));
const GraphSim = defineAsyncComponent(
  () => import("./components/GraphSim.vue"),
);
const StringSim = defineAsyncComponent(
  () => import("./components/LessonLab.vue"),
);
const LectureMode = defineAsyncComponent(
  () => import("./components/LectureMode.vue"),
);
const ExamplePlayer = defineAsyncComponent(
  () => import("./components/ExamplePlayer.vue"),
);
const ExampleCatalog = defineAsyncComponent(
  () => import("./components/ExampleCatalog.vue"),
);
const sharedExample = ref<Example>(),
  routeError = ref("");
const tab = ref("arena"),
  help = ref(false),
  toast = ref("");
const navigation = [
  { id: "arena", hash: "arena", label: "Arena" },
  { id: "algosim", hash: "algo-sim", label: "Algo Sim" },
  { id: "graphsim", hash: "graph-sim", label: "Graph Sim" },
  { id: "stringsim", hash: "string-sim", label: "String Sim" },
  { id: "lecture", hash: "vorlesung", label: "Vorlesung" },
  { id: "examples", hash: "beispiele", label: "Beispiele" },
];
const mainContent = ref<HTMLElement>(),
  rulesDialog = ref<HTMLDialogElement>();
const arenaSetupOpen = ref(false);
const arenaEditorOpen = ref(false),
  arenaEditorSource = ref("new"),
  arenaEditorKey = ref(0),
  arenaEditorHost = ref<HTMLElement>(),
  arenaEditorButton = ref<HTMLButtonElement>();
let arenaEditorTrigger: HTMLElement | undefined;
const playing = ref(false),
  playback = ref(0),
  stats = ref<FrameStats>({
    scores: [],
    positions: [],
    restarts: [],
    blocked: [],
    occupied: 0,
    traveling: [],
    returnSteps: [],
  });
const arenaPanel = ref<HTMLElement>(),
  arenaCanvas = ref<InstanceType<typeof ArenaCanvas>>();
let animation = 0,
  lastTime = 0,
  playhead = 0,
  lastUiUpdate = 0,
  toastTimer: ReturnType<typeof setTimeout> | undefined;
const number = new Intl.NumberFormat("de-DE");
// Small previews are generated from the actual masks, including walls and gates.
const shapePreviews = Object.fromEntries(
  Object.keys(SHAPES).map((shape) => {
    const size = 64,
      arena = createArena(shape as ArenaShape, size);
    let path = "";
    for (let y = 0; y < size; y++)
      for (let x = 0; x < size;) {
        if (!arena.mask[y * size + x]) {
          x++;
          continue;
        }
        const begin = x;
        while (x < size && arena.mask[y * size + x]) x++;
        path += `M${begin} ${y}h${x - begin}v1h-${x - begin}Z`;
      }
    return [shape, path];
  }),
);
const currentSettings = computed(() => replay.value?.settings ?? settings);
const arenaExample = computed(() => {
  try {
    return readExample({
      v: 1,
      kind: "arena",
      settings: currentSettings.value,
    });
  } catch {
    return null;
  }
});
const frame = computed(() =>
  Math.floor(playback.value * (replay.value?.steps ?? 0)),
);
const finished = computed(() => !!replay.value && playback.value >= 1);
const playable = computed(() => replay.value?.arena.playable ?? 0);
const occupied = computed(() => stats.value.occupied);
const occupancy = computed(() =>
  playable.value ? (occupied.value / playable.value) * 100 : 0,
);
const ranked = computed(() =>
  (replay.value?.players ?? [])
    .map((p) => ({ ...p, currentScore: stats.value.scores[p.id] ?? 1 }))
    .sort((a, b) => b.currentScore - a.currentScore || a.id - b.id),
);
const winnerNames = computed(() => {
  const max = ranked.value[0]?.currentScore;
  return ranked.value
    .filter((p) => p.currentScore === max)
    .map((p) => p.name)
    .join(" & ");
});
const changed = computed(() => {
  if (!replay.value) return false;
  const strip = (s: Settings) =>
    JSON.stringify({
      ...s,
      participants: s.participants.map(({ code: _code, ...p }) => p),
    });
  return strip(settings) !== strip(replay.value.settings);
});
const statusLabel = computed(() =>
  preparing.value
    ? "Wird vorbereitet"
    : finished.value
      ? "Kampf beendet"
      : playing.value
        ? "Kampf läuft"
        : playback.value > 0
          ? "Pausiert"
          : "Bereit zum Start",
);
const savedWarning = ref("");
watch(
  settings,
  (value) => {
    if (!store("settings", value))
      savedWarning.value =
        "Einstellungen können in diesem Browser nicht dauerhaft gespeichert werden.";
  },
  { deep: true },
);
watch(
  strategies,
  (value) => {
    if (!store("strategies", value))
      savedWarning.value =
        "Strategien können in diesem Browser nicht dauerhaft gespeichert werden. Bitte exportieren.";
  },
  { deep: true },
);
watch(help, (open) => {
  document.body.style.overflow = open ? "hidden" : "";
  if (open && !rulesDialog.value?.open) rulesDialog.value?.showModal();
  else if (!open) rulesDialog.value?.close();
});
watch(tab, (value) => {
  if (value !== "arena") {
    pause();
    arenaEditorOpen.value = false;
    arenaEditorTrigger = undefined;
  }
  if (value === "arena" && !replay.value && !preparing.value) void start();
});
function readHashRoute() {
  routeError.value = "";
  const hash = location.hash;
  if (hash === "#code-labor") {
    tab.value = "arena";
    history.replaceState(history.state, "", "#arena");
    openArenaEditor();
    return;
  }
  const section = navigation.find((item) => `#${item.hash}` === hash);
  if (section) {
    tab.value = section.id;
    return;
  }
  if (hash.startsWith("#beispiel")) {
    tab.value = "example";
    try {
      sharedExample.value = exampleFromHash(hash);
      if (!sharedExample.value)
        throw Error("Dieser Beispiel-Link ist ungültig.");
    } catch (cause) {
      sharedExample.value = undefined;
      routeError.value = cause instanceof Error ? cause.message : String(cause);
    }
    return;
  }
  tab.value = "arena";
}
function onHashChange() {
  readHashRoute();
  window.scrollTo(0, 0);
}
function notify(message: string) {
  toast.value = message;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (toast.value = ""), 3500);
}
function pause() {
  if (playing.value) playback.value = playhead;
  playing.value = false;
  cancelAnimationFrame(animation);
}
function advance(time: number) {
  if (!playing.value || !replay.value) return;
  playhead = Math.min(
    1,
    playhead +
      Math.max(0, time - lastTime) / (replay.value.settings.duration * 1000),
  );
  lastTime = time;
  // Canvas follows every display frame; the rest of Vue updates at most 20 Hz.
  arenaCanvas.value?.display(Math.floor(playhead * replay.value.steps), false);
  if (time - lastUiUpdate >= 50 || playhead >= 1) {
    playback.value = playhead;
    lastUiUpdate = time;
  }
  if (playhead >= 1) {
    playing.value = false;
    return;
  }
  animation = requestAnimationFrame(advance);
}
function play() {
  if (!replay.value || preparing.value) return;
  if (finished.value) playback.value = 0;
  playhead = playback.value;
  playing.value = true;
  lastTime = performance.now();
  lastUiUpdate = lastTime;
  animation = requestAnimationFrame(advance);
}
function togglePlay() {
  if (playing.value) pause();
  else play();
}
function restartReplay() {
  pause();
  playback.value = 0;
  if (tab.value === "arena") play();
}
function seek(event: Event) {
  pause();
  playback.value = Number((event.target as HTMLInputElement).value) / 1000;
}
function strategyChange(id: number) {
  const participant = settings.participants[id]!;
  participant.name =
    LABELS[participant.strategy] ??
    strategies.value.find((s) => s.id === participant.strategy)?.name ??
    "Eigene Strategie";
}
function addParticipant() {
  if (settings.participants.length >= 4) return;
  const id = settings.participants.length;
  const strategy = ["right", "left", "lookahead", "random"][id]!;
  settings.participants.push({
    name: LABELS[strategy]!,
    strategy,
    color: COLORS[id]!,
  });
}
function removeParticipant(id: number) {
  if (settings.participants.length <= 2) return;
  settings.participants.splice(id, 1);
  settings.participants.forEach((p, index) => (p.color = COLORS[index]!));
}
function saveStrategy(strategy: CustomStrategy) {
  const index = strategies.value.findIndex((s) => s.id === strategy.id);
  if (index >= 0) strategies.value[index] = strategy;
  else if (strategies.value.length < 30) strategies.value.push(strategy);
  else {
    notify(
      "Maximal 30 lokale Strategien. Exportiere und entferne zuerst eine Strategie.",
    );
    return;
  }
  settings.participants
    .filter((p) => p.strategy === strategy.id)
    .forEach((p) => (p.name = strategy.name));
  notify("Strategie lokal gespeichert");
}
function removeStrategy(id: string) {
  strategies.value = strategies.value.filter((s) => s.id !== id);
  settings.participants
    .filter((p) => p.strategy === id)
    .forEach((p) => {
      p.strategy = "random";
      p.name = LABELS.random!;
    });
}
async function start() {
  pause();
  const snapshot: Settings = JSON.parse(JSON.stringify(settings));
  snapshot.seed = snapshot.seed.trim() || "ALGO-2026";
  settings.seed = snapshot.seed;
  for (const p of snapshot.participants) {
    const custom = strategies.value.find((s) => s.id === p.strategy);
    if (custom) {
      p.code = custom.code;
      p.name = custom.name;
    } else if (!(p.strategy in LABELS)) {
      notify("Eine ausgewählte Strategie fehlt. Bitte wähle sie erneut aus.");
      return;
    }
  }
  const result = await run(snapshot);
  if (!result) return;
  playback.value = 0;
  await nextTick();
  if (tab.value === "arena") play();
}
function startFromControls() {
  void start();
  if (matchMedia("(max-width: 900px)").matches) {
    arenaSetupOpen.value = false;
    arenaPanel.value?.scrollIntoView({ block: "start" });
  }
}
function cancelPreparation() {
  abort();
  notify("Vorbereitung abgebrochen. Du kannst sofort neu starten.");
}
function shuffleSeed() {
  settings.seed =
    "AF-" +
    crypto.getRandomValues(new Uint32Array(1))[0]!.toString(36).toUpperCase();
}
async function copySeed() {
  try {
    await navigator.clipboard.writeText(currentSettings.value.seed);
    notify("Seed kopiert");
  } catch {
    notify("Seed: " + currentSettings.value.seed);
  }
}
async function expand() {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await arenaPanel.value?.requestFullscreen();
  } catch {
    notify("Vollbild wird in diesem Browser nicht unterstützt.");
  }
}
function revealArenaEditor() {
  const host = arenaEditorHost.value;
  if (!host) return;
  host.focus({ preventScroll: true });
  host.scrollIntoView({
    behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
      ? "instant"
      : "smooth",
    block: "start",
  });
}
function openArenaEditor(source?: string, event?: Event) {
  arenaEditorTrigger = event?.currentTarget as HTMLElement | undefined;
  pause();
  if (source) {
    arenaEditorSource.value = source;
    arenaEditorKey.value++;
  } else if (arenaEditorOpen.value) {
    revealArenaEditor();
  }
  arenaEditorOpen.value = true;
}
async function closeArenaEditor() {
  arenaEditorOpen.value = false;
  const trigger = arenaEditorTrigger;
  arenaEditorTrigger = undefined;
  await nextTick();
  (trigger?.getClientRects().length
    ? trigger
    : arenaEditorButton.value
  )?.focus();
}
function exportResult() {
  if (!replay.value) return;
  const r = replay.value;
  const data = {
    version: 1,
    arena: r.settings.shape,
    resolution: r.settings.resolution,
    seed: r.settings.seed,
    steps: r.steps,
    playable: r.arena.playable,
    occupied: r.occupied,
    unoccupied: r.arena.playable - r.occupied,
    ranking: [...r.players]
      .sort((a, b) => b.score - a.score)
      .map((p) => ({
        name: p.name,
        strategy: p.strategy,
        score: p.score,
        status: p.status,
        error: p.error,
        restarts: p.restarts,
        returnTrips: p.restarts,
        returnSteps: p.returnSteps,
        fallback: p.fallback,
      })),
  };
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = `algofights-${r.settings.seed.replace(/[^a-z0-9_-]/gi, "-")}.json`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function onKey(event: KeyboardEvent) {
  if (
    tab.value === "arena" &&
    event.code === "Space" &&
    event.target === document.body &&
    !help.value
  ) {
    event.preventDefault();
    togglePlay();
  }
  if (event.code === "Escape") help.value = false;
}
function onVisibility() {
  if (document.hidden) pause();
}
onMounted(() => {
  addEventListener("keydown", onKey);
  document.addEventListener("visibilitychange", onVisibility);
  addEventListener("hashchange", onHashChange);
  readHashRoute();
  if (tab.value === "arena") void start();
});
onBeforeUnmount(() => {
  document.body.style.overflow = "";
  pause();
  clearTimeout(toastTimer);
  removeEventListener("keydown", onKey);
  removeEventListener("hashchange", onHashChange);
  document.removeEventListener("visibilitychange", onVisibility);
});
</script>

<template>
  <div class="app-shell">
    <a
      class="skip-link"
      href="#hauptinhalt"
      @click.prevent="mainContent?.focus()"
      >Zum Inhalt</a
    >
    <header class="topbar">
      <a class="brand" href="#arena" aria-label="AlgoFights Startseite"
        ><span>AlgoFights</span></a
      >
      <nav class="main-nav" aria-label="Hauptnavigation">
        <a
          v-for="item in navigation"
          :key="item.id"
          :href="`#${item.hash}`"
          :aria-current="
            tab === item.id
              ? 'page'
              : tab === 'example' && item.id === 'examples'
                ? 'location'
                : undefined
          "
          >{{ item.label }}</a
        >
      </nav>
      <div class="header-right">
        <button
          class="icon-button help-button"
          aria-label="Spielregeln anzeigen"
          @click="help = true"
        >
          <CircleHelp :size="19" /></button
        ><a
          class="icon-button"
          href="https://github.com/sh11n3/AlgoFights"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Quellcode auf GitHub"
          ><Github :size="19"
        /></a>
      </div>
    </header>

    <main id="hauptinhalt" ref="mainContent" tabindex="-1">
      <div
        v-if="savedWarning && tab === 'arena'"
        class="notice-banner"
        role="status"
      >
        {{ savedWarning }}
      </div>
      <div v-if="error && tab === 'arena'" class="error-banner" role="alert">
        {{ error }} <button @click="start">Erneut versuchen</button>
      </div>

      <div v-show="tab === 'arena'" class="battle-layout">
        <section
          ref="arenaPanel"
          class="arena-panel panel"
          aria-label="Kampf-Arena"
        >
          <div class="arena-toolbar">
            <div class="arena-title">
              <span
                class="live-dot"
                :class="{ live: playing, busy: preparing }"
              ></span>
              <h2>Die Arena</h2>
              <span class="arena-state">{{ statusLabel }}</span>
            </div>
            <div class="arena-toolbar-right">
              <button
                ref="arenaEditorButton"
                class="secondary-button arena-editor-button"
                :aria-expanded="arenaEditorOpen"
                aria-controls="arena-code-editor"
                @click="openArenaEditor(undefined, $event)"
              >
                <CodeXml :size="15" /> Code-Editor
              </button>
              <ShareExample :example="arenaExample" />
              <span
                >{{ SHAPES[currentSettings.shape] }} <span class="dim">/</span>
                {{ number.format(currentSettings.resolution) }}²</span
              ><button
                class="icon-button"
                aria-label="Arena im Vollbild anzeigen"
                @click="expand"
              >
                <Maximize2 :size="16" />
              </button>
            </div>
          </div>
          <div class="arena-stage">
            <ArenaCanvas
              ref="arenaCanvas"
              :replay="replay"
              :frame="frame"
              @stats="stats = $event"
            />
            <div v-if="preparing" class="preparation-overlay" role="status">
              <div class="prepare-box">
                <LoaderCircle class="spin" :size="25" />
                <h3>Arena wird vorbereitet</h3>
                <p>Die Strategien berechnen ihren Kampf.</p>
                <div class="prepare-track">
                  <span
                    :style="{
                      width: `${Math.max(3, preparationProgress * 100)}%`,
                    }"
                  ></span>
                </div>
                <span class="prepare-detail"
                  >{{ Math.round(preparationProgress * 100) }} % belegt ·
                  Wiedergabe anschließend {{ settings.duration }} s</span
                ><button
                  class="secondary-button small"
                  @click="cancelPreparation"
                >
                  Abbrechen
                </button>
              </div>
            </div>
            <div v-if="!replay && !preparing" class="empty-arena">
              <p>Keine Simulation geladen.</p>
              <button class="primary-button" @click="start">
                <Play :size="16" /> Kampf starten
              </button>
            </div>
            <span class="stage-seed"
              >Seed <b>{{ currentSettings.seed }}</b
              ><button aria-label="Seed kopieren" @click="copySeed">
                <Copy :size="11" /></button
            ></span>
          </div>
          <div class="playback-controls">
            <button
              class="play-control"
              :disabled="!replay || preparing"
              :aria-label="playing ? 'Pausieren' : 'Wiedergeben'"
              @click="togglePlay"
            >
              <Pause v-if="playing" :size="17" fill="currentColor" /><Play
                v-else
                :size="17"
                fill="currentColor"
              /></button
            ><button
              class="icon-button restart-button"
              :disabled="!replay || preparing"
              aria-label="Diesen Kampf erneut abspielen"
              @click="restartReplay"
            >
              <RotateCcw :size="16" /></button
            ><span class="playback-time"
              >{{ (playback * currentSettings.duration).toFixed(1) }}
              <span>/ {{ currentSettings.duration }} s</span></span
            >
            <div class="timeline">
              <input
                type="range"
                min="0"
                max="1000"
                :value="playback * 1000"
                :disabled="!replay || preparing"
                :style="{ '--progress': `${playback * 100}%` }"
                aria-label="Replay-Fortschritt"
                @input="seek"
              />
            </div>
            <span class="frame-counter"
              >{{ number.format(frame) }} <span>Schritte</span></span
            >
          </div>
          <div class="arena-footer">
            <span>{{ number.format(playable) }} bespielbare Zellen</span
            ><span
              >Deterministisch <span class="dot-divider">·</span> Seed-basiert
              <span class="desktop-only dot-divider">·</span>
              <span class="desktop-only">Rücklauf ohne Punkte</span></span
            >
          </div>
        </section>

        <div class="arena-mobile-actions">
          <button
            class="secondary-button"
            :aria-expanded="arenaSetupOpen"
            aria-controls="arena-einstellungen"
            @click="arenaSetupOpen = !arenaSetupOpen"
          >
            Kampf einstellen
          </button>
          <button
            class="primary-button"
            :disabled="preparing"
            @click="startFromControls"
          >
            <Play :size="15" />
            {{ preparing ? "Wird berechnet …" : "Neuer Kampf" }}
          </button>
        </div>
        <aside
          id="arena-einstellungen"
          class="setup-column"
          :class="{ 'setup-open': arenaSetupOpen }"
          aria-label="Kampf einstellen"
        >
          <section class="settings-panel panel">
            <div class="section-heading compact">
              <h2>Kampf konfigurieren</h2>
            </div>
            <label class="field-label">Arenaform</label>
            <div class="shape-options">
              <button
                v-for="(label, shape) in SHAPES"
                :key="shape"
                :class="{ active: settings.shape === shape }"
                @click="settings.shape = shape as ArenaShape"
              >
                <svg class="shape-icon" viewBox="0 0 64 64" aria-hidden="true">
                  <path :d="shapePreviews[shape]" fill="currentColor" /></svg
                ><span>{{ label }}</span>
              </button>
            </div>
            <div class="settings-row">
              <label
                >Rasterauflösung<select v-model.number="settings.resolution">
                  <option :value="256">256 × 256</option>
                  <option :value="512">512 × 512</option>
                  <option :value="1024">1.024 × 1.024</option>
                </select></label
              ><label
                >Seed
                <div class="seed-input">
                  <input
                    v-model="settings.seed"
                    maxlength="80"
                    aria-label="Seed für die nächste Runde"
                    spellcheck="false"
                  /><button
                    aria-label="Zufälligen Seed erzeugen"
                    title="Neuer Zufallsseed"
                    @click="shuffleSeed"
                  >
                    <Shuffle :size="14" />
                  </button></div
              ></label>
            </div>
            <div class="duration-label">
              <label for="duration">Wiedergabedauer</label
              ><span>{{ settings.duration }} <span>Sekunden</span></span>
            </div>
            <input
              id="duration"
              v-model.number="settings.duration"
              class="duration-slider"
              type="range"
              min="10"
              max="15"
              step="1"
              :style="{ '--progress': `${(settings.duration - 10) * 20}%` }"
            />
            <div class="range-labels"><span>10 s</span><span>15 s</span></div>
            <div class="settings-hint">
              {{
                changed
                  ? "Einstellungen geändert. Gilt ab dem nächsten Kampf."
                  : "Einstellungen gelten ab dem nächsten Kampf."
              }}
            </div>
          </section>

          <section class="participants-panel panel">
            <div class="section-heading compact">
              <h2>Teilnehmer</h2>
              <span class="count-badge"
                >{{ settings.participants.length }} / 4</span
              >
            </div>
            <div class="participant-list">
              <div
                v-for="(p, id) in settings.participants"
                :key="id"
                class="participant-setup"
                :style="{ '--player-color': p.color }"
              >
                <span class="participant-number">{{ id + 1 }}</span
                ><span class="color-dot"></span
                ><select
                  v-model="p.strategy"
                  :title="
                    DESCRIPTIONS[p.strategy] ?? 'Eigene JavaScript-Strategie'
                  "
                  :aria-label="`Strategie für Teilnehmer ${id + 1}`"
                  @change="strategyChange(id)"
                >
                  <optgroup label="Eingebaute Strategien">
                    <option
                      v-for="(label, value) in LABELS"
                      :key="value"
                      :value="value"
                    >
                      {{ label }}
                    </option>
                  </optgroup>
                  <optgroup v-if="strategies.length" label="Eigene Strategien">
                    <option v-for="s in strategies" :key="s.id" :value="s.id">
                      {{ s.name }}
                    </option>
                  </optgroup></select
                ><button
                  class="remove-participant"
                  :aria-label="`Code von Teilnehmer ${id + 1} öffnen`"
                  title="Strategie im Code-Editor öffnen"
                  @click="
                    openArenaEditor(
                      p.strategy.startsWith('custom:')
                        ? p.strategy
                        : `builtin:${p.strategy}`,
                      $event,
                    )
                  "
                >
                  <CodeXml :size="14" /></button
                ><button
                  class="remove-participant"
                  :disabled="settings.participants.length <= 2"
                  :aria-label="`Teilnehmer ${id + 1} entfernen`"
                  @click="removeParticipant(id)"
                >
                  <X :size="13" />
                </button>
              </div>
            </div>
            <button
              v-if="settings.participants.length < 4"
              class="add-participant"
              @click="addParticipant"
            >
              <Plus :size="14" /> Teilnehmer hinzufügen</button
            ><button
              class="create-strategy"
              @click="openArenaEditor('new', $event)"
            >
              Eigene Strategie entwickeln
              <ArrowRight :size="14" />
            </button>
            <button
              class="start-button"
              :disabled="preparing"
              @click="startFromControls"
            >
              <LoaderCircle v-if="preparing" class="spin" :size="18" /><Play
                v-else
                :size="18"
              />
              {{
                preparing
                  ? "Wird berechnet …"
                  : replay
                    ? "Neuen Kampf starten"
                    : "Kampf starten"
              }}
            </button>
          </section>
        </aside>
      </div>

      <section v-show="tab === 'arena'" class="results-section">
        <div class="results-title">
          <h2>
            {{ finished ? "Das Ergebnis" : "Live-Rangliste" }}
          </h2>
          <div v-if="finished" class="finished-note">
            {{
              ranked.filter((p) => p.currentScore === ranked[0]?.currentScore)
                .length > 1
                ? "Gleichstand"
                : "Gewinner"
            }}: {{ winnerNames }}
          </div>
          <button
            v-if="finished"
            class="text-button result-export"
            @click="exportResult"
          >
            <ArrowDownToLine :size="14" /> Ergebnis
          </button>
        </div>
        <div
          class="score-grid"
          :style="{
            '--participant-count': currentSettings.participants.length,
          }"
        >
          <article
            v-for="(p, index) in ranked.length
              ? ranked
              : settings.participants.map((p, id) => ({
                  ...p,
                  id,
                  currentScore: 0,
                  stoppedAt: -1,
                  status: 'active',
                  error: undefined,
                  errorAt: -1,
                }))"
            :key="p.id"
            class="score-card"
            :style="{ '--player-color': p.color }"
          >
            <div class="score-card-top">
              <span class="score-player"
                ><span class="color-dot"></span>{{ p.name }}</span
              ><span class="rank">{{ index + 1 }}</span>
            </div>
            <div class="score-value">
              {{ number.format(p.currentScore) }}<span>Zellen</span>
            </div>
            <div class="score-track">
              <span
                :style="{
                  width: `${playable ? (p.currentScore / playable) * 100 : 0}%`,
                }"
              ></span>
            </div>
            <div class="score-card-bottom">
              <span
                >{{
                  playable
                    ? ((p.currentScore / playable) * 100)
                        .toFixed(1)
                        .replace(".", ",")
                    : "0,0"
                }}
                % der Arena</span
              ><span
                class="player-status"
                :class="{ error: p.errorAt >= 0 && frame >= p.errorAt }"
                >{{
                  p.errorAt >= 0 && frame >= p.errorAt
                    ? finished
                      ? "Beendet · Ersatz"
                      : stats.traveling[p.id]
                        ? "Ersatz · Rücklauf"
                        : stats.blocked[p.id]
                          ? "Ersatz · blockiert"
                          : "Ersatz aktiv"
                    : finished
                      ? "Beendet"
                      : stats.traveling[p.id]
                        ? "Rücklauf"
                        : stats.blocked[p.id]
                          ? "Blockiert"
                          : "Aktiv"
                }}</span
              >
            </div>
            <p
              v-if="p.error && frame >= p.errorAt"
              class="strategy-error"
              role="alert"
            >
              {{ p.error }} Fortsetzung mit der Ersatzstrategie „Geradeaus“.
            </p>
            <p v-if="(stats.restarts[p.id] ?? 0) > 0" class="restart-count">
              {{ number.format(stats.restarts[p.id]!) }} Rückläufe ·
              {{ number.format(stats.returnSteps[p.id] ?? 0) }} Schritte ohne
              Punkte
            </p>
          </article>
        </div>
        <div class="occupancy-panel panel">
          <div class="occupancy-summary">
            <div>
              <strong>Arenabelegung</strong
              ><span
                >{{ number.format(occupied) }} von
                {{ number.format(playable) }} Zellen</span
              >
            </div>
          </div>
          <div class="occupancy-bar">
            <span
              v-for="p in replay?.players ?? []"
              :key="p.id"
              :style="{
                width: `${playable ? ((stats.scores[p.id] ?? 0) / playable) * 100 : 0}%`,
                background: p.color,
              }"
            ></span>
          </div>
          <span class="occupancy-percent"
            >{{ occupancy.toFixed(1).replace(".", ",") }}<span>%</span></span
          >
          <div class="unoccupied">
            <span class="empty-swatch"></span
            ><strong>{{
              number.format(Math.max(0, playable - occupied))
            }}</strong>
            unbesetzt
          </div>
        </div>
      </section>

      <div
        v-if="tab === 'arena'"
        v-show="arenaEditorOpen"
        id="arena-code-editor"
        ref="arenaEditorHost"
        class="lab-wrapper"
        tabindex="-1"
      >
        <StrategyEditor
          v-if="arenaEditorOpen"
          :key="arenaEditorKey"
          mode="arena"
          :source-id="arenaEditorSource"
          :strategies="strategies"
          @save="saveStrategy"
          @remove="removeStrategy"
          @close="closeArenaEditor"
          @ready="revealArenaEditor"
        />
      </div>
      <AlgoSim v-if="tab === 'algosim'" />
      <GraphSim v-if="tab === 'graphsim'" />
      <StringSim v-if="tab === 'stringsim'" kind="string" />
      <LectureMode v-if="tab === 'lecture'" />
      <ExamplePlayer
        v-if="tab === 'example' && sharedExample"
        :example="sharedExample"
      />
      <div
        v-if="tab === 'example' && routeError"
        class="error-banner"
        role="alert"
      >
        {{ routeError }} <a href="#beispiele">Zur Beispielauswahl</a>
      </div>
      <section v-if="tab === 'examples'" class="examples-page panel">
        <h1>Beispiele</h1>
        <p>
          Feste Links zu vorbereiteten Simulationen. Für eigene Eingaben den
          „Beispiel-Link“ direkt im Simulator oder Graph Builder erstellen.
        </p>
        <ExampleCatalog />
      </section>
    </main>
    <footer class="site-footer">
      <span
        >AlgoFights <span>© {{ new Date().getFullYear() }}</span></span
      >
      <button class="text-button footer-rules" @click="help = true">
        Spielregeln
      </button>
      <a
        href="https://github.com/sh11n3/AlgoFights"
        target="_blank"
        rel="noopener noreferrer"
        >Open Source <ArrowRight :size="12"
      /></a>
    </footer>
    <Transition name="toast"
      ><div v-if="toast" class="toast-message" role="status">
        <Check :size="16" />{{ toast }}
      </div></Transition
    >
    <dialog
      ref="rulesDialog"
      class="rules-modal panel"
      aria-labelledby="arena-regeln"
      @close="help = false"
    >
      <div class="section-heading">
        <h2 id="arena-regeln">Arena-Spielregeln</h2>
        <button
          class="icon-button"
          aria-label="Spielregeln schließen"
          autofocus
          @click="help = false"
        >
          <X :size="20" />
        </button>
      </div>
      <p>
        Jeder Algorithmus steuert genau einen Punkt. Sein Ziel: so viele freie
        Zellen wie möglich betreten.
      </p>
      <ol>
        <li>
          Startzellen zählen mit. Jede erstmals betretene Zelle gibt einen Punkt
          und bleibt dauerhaft belegt.
        </li>
        <li>
          Bewege dich nach oben, rechts, unten oder links. Grenzen, Hindernisse
          und sämtliche Spuren sind gesperrt – auch die eigene.
        </li>
        <li>
          Alle Strategien sehen denselben Zustand vor dem Schritt. Bei einem
          Konflikt um dieselbe Zelle entscheidet der Seed-Zufall. Verlierer
          warten diesen Schritt.
        </li>
        <li>
          Ohne freien Nachbarn beginnt dieser Algorithmus sofort einen Rücklauf,
          während die anderen weiterziehen. Der Kern führt ihn Schritt für
          Schritt über belegte Zellen zum nächsten freien Bereich zurück. Diese
          Rückläufe verändern weder Farben noch Punkte. Es gibt kein
          Teleportieren. Nur während des automatischen Rücklaufs dürfen
          bestehende Spuren überquert werden.
        </li>
        <li>
          Der Kampf endet erst, wenn alle bespielbaren Zellen belegt sind. Bei
          einem Strategiefehler übernimmt sichtbar die Ersatzstrategie
          „Geradeaus“. Die meisten Punkte gewinnen; Gleichstände sind möglich.
        </li>
      </ol>
      <p>
        Die Simulation läuft vor der Wiedergabe. Pause, Spulen und
        Wiedergabedauer ändern das Ergebnis nicht. Einstellungen gelten erst für
        den nächsten Kampf.
      </p>
      <div class="rules-shortcut">
        <kbd>Leertaste</kbd> Wiedergabe pausieren / fortsetzen
      </div>
      <button class="primary-button" @click="help = false">
        Verstanden <ArrowRight :size="16" />
      </button>
    </dialog>
  </div>
</template>
