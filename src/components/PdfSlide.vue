<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from "vue";
import type { PDFDocumentProxy, RenderTask } from "pdfjs-dist";
const props = defineProps<{ document: PDFDocumentProxy; page: number }>();
const emit = defineEmits<{
  ratio: [value: number];
  error: [message: string];
  ready: [];
}>();
const canvas = ref<HTMLCanvasElement>(),
  host = ref<HTMLElement>();
let observer: ResizeObserver | undefined,
  task: RenderTask | undefined,
  version = 0;
async function render() {
  const ticket = ++version,
    previous = task;
  previous?.cancel();
  await previous?.promise.catch(() => {});
  if (ticket !== version || !canvas.value || !host.value) return;
  try {
    const page = await props.document.getPage(props.page);
    if (ticket !== version) return;
    const original = page.getViewport({ scale: 1 });
    emit("ratio", original.width / original.height);
    const width = host.value.clientWidth;
    if (!width) return;
    const pixelRatio = Math.min(
      devicePixelRatio || 1,
      2,
      Math.sqrt(
        8000000 / ((width * width) / (original.width / original.height)),
      ),
    );
    const viewport = page.getViewport({
      scale: (width / original.width) * pixelRatio,
    });
    canvas.value.width = Math.ceil(viewport.width);
    canvas.value.height = Math.ceil(viewport.height);
    const context = canvas.value.getContext("2d");
    if (!context) throw Error("Canvas konnte nicht geöffnet werden.");
    task = page.render({
      canvas: canvas.value,
      canvasContext: context,
      viewport,
    });
    await task.promise;
    if (ticket === version) emit("ready");
  } catch (error) {
    if (
      ticket === version &&
      (error as Error)?.name !== "RenderingCancelledException"
    )
      emit("error", error instanceof Error ? error.message : String(error));
  }
}
watch([() => props.document, () => props.page], () => {
  void render();
});
onMounted(() => {
  observer = new ResizeObserver(() => void render());
  observer.observe(host.value!);
  void render();
});
onBeforeUnmount(() => {
  version++;
  task?.cancel();
  observer?.disconnect();
});
</script>
<template>
  <div ref="host" class="pdf-slide-render">
    <canvas ref="canvas" role="img" :aria-label="`PDF-Folie ${page}`" />
  </div>
</template>
