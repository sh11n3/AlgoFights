<script setup lang="ts">
import { computed, ref } from "vue";
import { Link2, Copy, Presentation } from "lucide-vue-next";
import { exampleUrl, type Example } from "../sharing/examples";
import { useInLecture } from "../sharing/actions";
const props = defineProps<{ example?: Example | null; reason?: string }>();
const open = ref(false),
  notice = ref("");
const link = computed(() => {
  try {
    return props.example ? exampleUrl(props.example) : "";
  } catch {
    return "";
  }
});
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
      @click="open = !open"
    >
      <Link2 :size="15" /> Beispiel-Link
    </button>
    <div v-if="open && link" class="share-example-panel">
      <label
        >Festes Beispiel<input
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
        ><button class="secondary-button" @click="useInLecture(example!)">
          <Presentation :size="14" /> In Vorlesung verwenden
        </button>
      </div>
      <p class="graph-field-help">
        Der Link enthält Eingaben und Einstellungen. PDFs und eigener
        Programmcode werden nicht geteilt. Der Website-Passwortschutz bleibt
        aktiv.
      </p>
      <p v-if="notice" role="status" class="graph-field-help">{{ notice }}</p>
    </div>
  </div>
</template>
