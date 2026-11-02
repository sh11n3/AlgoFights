<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from "vue";
import { ArenaRenderer, type FrameStats } from "../render/arena";
import type { Replay } from "../core/types";
const props = defineProps<{ replay: Replay | null; frame: number }>();
const emit = defineEmits<{ stats: [value: FrameStats] }>();
const canvas = ref<HTMLCanvasElement>();
let renderer: ArenaRenderer | null = null,
  observer: ResizeObserver | null = null;
function setup() {
  if (canvas.value && props.replay) {
    renderer = new ArenaRenderer(canvas.value, props.replay);
    emit("stats", renderer.seek(props.frame));
  }
}
watch(() => props.replay, setup);
watch(
  () => props.frame,
  (value) => {
    if (renderer) emit("stats", renderer.seek(value));
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
