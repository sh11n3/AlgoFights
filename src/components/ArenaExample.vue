<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from "vue";
import { Play, Pause, RotateCcw } from "lucide-vue-next";
import ArenaCanvas from "./ArenaCanvas.vue";
import { useBattle } from "../services/battle";
import { SHAPES } from "../core/types";
import type { FrameStats } from "../render/arena";
import { readExample, type Example } from "../sharing/examples";
const props = defineProps<{
  initial: Extract<Example, { kind: "arena" }>;
  compact?: boolean;
}>();
const { replay, preparing, error, run: calculate, abort } = useBattle();
const progress = ref(0),
  playing = ref(false),
  stats = ref<FrameStats>();
let raf = 0,
  last = 0;
const frame = computed(() =>
  Math.floor(progress.value * (replay.value?.steps ?? 0)),
);
function pause() {
  playing.value = false;
  cancelAnimationFrame(raf);
}
function tick(now: number) {
  if (!playing.value) return;
  progress.value = Math.min(
    1,
    progress.value + (now - last) / (props.initial.settings.duration * 1000),
  );
  last = now;
  if (progress.value < 1) raf = requestAnimationFrame(tick);
  else pause();
}
function play() {
  if (!replay.value) return;
  if (playing.value) {
    pause();
    return;
  }
  if (progress.value >= 1) progress.value = 0;
  playing.value = true;
  last = performance.now();
  raf = requestAnimationFrame(tick);
}
async function run() {
  pause();
  progress.value = 0;
  stats.value = undefined;
  const example = readExample(props.initial);
  if (example.kind === "arena") await calculate(example.settings);
  await nextTick();
}
function seek(event: Event) {
  pause();
  progress.value = Number((event.target as HTMLInputElement).value) / 1000;
}
function visible() {
  if (document.hidden) pause();
}
defineExpose({ run, getExample: () => readExample(props.initial) });
onMounted(() => document.addEventListener("visibilitychange", visible));
onBeforeUnmount(() => {
  pause();
  abort();
  document.removeEventListener("visibilitychange", visible);
});
</script>
<template>
  <section class="arena-example" :class="{ 'simulation-compact': compact }">
    <div class="arena-example-meta">
      {{ SHAPES[initial.settings.shape] }} · {{ initial.settings.resolution }}²
      · Seed {{ initial.settings.seed }}
    </div>
    <div v-if="replay" class="arena-example-canvas">
      <ArenaCanvas :replay="replay" :frame="frame" @stats="stats = $event" />
    </div>
    <div v-else class="example-empty">
      {{
        preparing
          ? "Kampf wird im Hintergrund vorbereitet …"
          : "Berechnen drücken, um diesen Kampf vorzubereiten."
      }}
    </div>
    <div class="graph-playback">
      <button
        class="icon-button"
        :disabled="!replay"
        aria-label="Zum Anfang"
        @click="
          pause();
          progress = 0;
        "
      >
        <RotateCcw :size="17" /></button
      ><button
        class="icon-button"
        :disabled="!replay"
        :aria-label="playing ? 'Pause' : 'Abspielen'"
        @click="play"
      >
        <Pause v-if="playing" :size="17" /><Play v-else :size="17" /></button
      ><input
        type="range"
        min="0"
        max="1000"
        :value="progress * 1000"
        :disabled="!replay"
        :style="{ '--progress': `${progress * 100}%` }"
        aria-label="Arena-Fortschritt"
        @input="seek"
      /><span class="graph-frame">{{ Math.round(progress * 100) }} %</span>
    </div>
    <p v-if="error" role="alert">{{ error }}</p>
    <button v-if="preparing" class="secondary-button" @click="abort">
      Abbrechen
    </button>
    <div class="arena-example-scores">
      <span v-for="(player, i) in initial.settings.participants" :key="i"
        ><i :style="{ background: player.color }"></i>{{ player.name }}
        <strong>{{
          (stats?.scores[i] ?? 0).toLocaleString("de-DE")
        }}</strong></span
      >
    </div>
  </section>
</template>
