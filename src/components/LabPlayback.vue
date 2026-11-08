<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from "vue";
import { Pause, Play, SkipBack, SkipForward, RotateCcw } from "lucide-vue-next";
const props = defineProps<{ step: number; total: number; delay: number }>();
const emit = defineEmits<{ seek: [step: number] }>();
const playing = ref(false);
let timer: ReturnType<typeof setTimeout> | undefined;
function pause() {
  playing.value = false;
  clearTimeout(timer);
}
function tick() {
  if (!playing.value) return;
  if (props.step >= props.total) {
    pause();
    return;
  }
  emit("seek", props.step + 1);
  timer = setTimeout(tick, props.delay);
}
function play() {
  if (playing.value) {
    pause();
    return;
  }
  if (props.step >= props.total) emit("seek", 0);
  playing.value = true;
  timer = setTimeout(tick, props.delay);
}
function seek(step: number) {
  pause();
  emit("seek", Math.max(0, Math.min(props.total, step)));
}
function visible() {
  if (document.hidden) pause();
}
onMounted(() => document.addEventListener("visibilitychange", visible));
watch(() => props.total, pause);
onBeforeUnmount(() => {
  pause();
  document.removeEventListener("visibilitychange", visible);
});
</script>
<template>
  <div class="graph-playback lab-playback">
    <button
      class="icon-button"
      aria-label="Zum Anfang"
      :disabled="!total"
      @click="seek(0)"
    >
      <RotateCcw :size="17" />
    </button>
    <button
      class="icon-button"
      aria-label="Voriger Schritt"
      :disabled="step === 0"
      @click="seek(step - 1)"
    >
      <SkipBack :size="17" />
    </button>
    <button
      class="icon-button"
      :aria-label="playing ? 'Pause' : 'Abspielen'"
      :disabled="!total"
      @click="play"
    >
      <Pause v-if="playing" :size="18" /><Play v-else :size="18" />
    </button>
    <button
      class="icon-button"
      aria-label="Nächster Schritt"
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
      aria-label="Simulationsschritt"
      @input="seek(Number(($event.target as HTMLInputElement).value))"
    />
    <span class="graph-frame">{{ step }} / {{ total }}</span>
  </div>
</template>
