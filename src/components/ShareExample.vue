<script setup lang="ts">
import { computed, ref, useId, watch } from "vue";
import { Link2, Copy, Presentation, X } from "lucide-vue-next";
import { exampleUrl, type Example } from "../sharing/examples";
import { useInLecture } from "../sharing/actions";
const props = defineProps<{ example?: Example | null; reason?: string }>();
const open = ref(false),
  notice = ref("");
const dialog = ref<HTMLDialogElement>();
const titleId = useId();
const link = computed(() => {
  try {
    return props.example ? exampleUrl(props.example) : "";
  } catch {
    return "";
  }
});
watch(link, (value) => {
  if (!value) dialog.value?.close();
});
function show() {
  if (!link.value || !dialog.value) return;
  notice.value = "";
  dialog.value.showModal();
  open.value = true;
}
function sendToLecture() {
  if (!props.example) return;
  dialog.value?.close();
  useInLecture(props.example);
}
async function copy() {
  try {
    await navigator.clipboard.writeText(link.value);
    notice.value = "Link kopiert.";
  } catch {
    notice.value = "Link bitte aus dem Feld kopieren.";
  }
}
</script>
<template>
  <div class="share-example">
    <button
      class="secondary-button"
      :disabled="!link"
      :title="
        !link ? (reason ?? 'Für eingebaute Verfahren verfügbar.') : undefined
      "
      :aria-expanded="open"
      aria-haspopup="dialog"
      @click="show"
    >
      <Link2 :size="15" /> Beispiel-Link
    </button>
    <dialog
      ref="dialog"
      class="share-example-panel"
      :aria-labelledby="titleId"
      @close="open = false"
    >
      <div class="share-dialog-heading">
        <h2 :id="titleId">Beispiel teilen</h2>
        <button
          class="icon-button"
          aria-label="Beispiel-Link schließen"
          @click="dialog?.close()"
        >
          <X :size="18" />
        </button>
      </div>
      <label
        >Beispiel-Link<input
          :value="link"
          readonly
          aria-label="Beispiel-Link"
          @focus="($event.target as HTMLInputElement).select()"
      /></label>
      <div class="share-example-actions">
        <button class="secondary-button" @click="copy">
          <Copy :size="14" /> Kopieren</button
        ><a class="secondary-button" :href="link" target="_blank" rel="noopener"
          >Öffnen</a
        ><button class="secondary-button" @click="sendToLecture">
          <Presentation :size="14" /> In Vorlesung verwenden
        </button>
      </div>
      <p class="graph-field-help">
        Teilt Eingaben und Einstellungen. PDFs, eigener Code und Zugangsdaten
        bleiben lokal.
      </p>
      <p v-if="notice" role="status" class="graph-field-help">{{ notice }}</p>
    </dialog>
  </div>
</template>
