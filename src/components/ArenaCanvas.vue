<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from "vue";
import { ArenaRenderer, type FrameStats } from "../render/arena";
import type { Replay } from "../core/types";
const props = defineProps<{ replay: Replay | null; frame: number }>();
const emit = defineEmits<{ stats: [value: FrameStats] }>();
const canvas = ref<HTMLCanvasElement>();
let renderer: ArenaRenderer | null = null,
  observer: ResizeObserver | null = null;
let renderedFrame = -1;
let latestStats: FrameStats | null = null;
function display(frame: number, report = true) {
  if (!renderer) return;
  frame = Math.floor(frame);
  if (frame !== renderedFrame) {
    latestStats = renderer.seek(frame);
    renderedFrame = frame;
  }
  if (report && latestStats) emit("stats", latestStats);
}
defineExpose({ display });
function setup() {
  if (canvas.value && props.replay) {
    renderer = new ArenaRenderer(canvas.value, props.replay);
    renderedFrame = -1;
    display(props.frame);
  }
}
watch(() => props.replay, setup);
watch(
  () => props.frame,
  (value) => {
    display(value);
  },
);
onMounted(() => {
  setup();
  observer = new ResizeObserver(() => renderer?.draw());
  observer.observe(canvas.value!);
});
onBeforeUnmount(() => observer?.disconnect());
</script>
<template>
  <canvas
    ref="canvas"
    class="arena-canvas"
    role="img"
    aria-label="Arena mit den eroberten Zellen und Positionen aller Algorithmen. Punktestände stehen in der Teilnehmerliste."
  />
</template>
