<script setup lang="ts">
import { computed, ref } from "vue";
import { EXAMPLES, exampleUrl, type Example } from "../sharing/examples";
const props = defineProps<{ selectable?: boolean }>();
const emit = defineEmits<{ select: [example: Example] }>();
const search = ref("");
const groups = computed(() => [
  ...new Set(
    EXAMPLES.filter((e) =>
      `${e.name} ${e.group}`.toLowerCase().includes(search.value.toLowerCase()),
    ).map((e) => e.group),
  ),
]);
</script>
<template>
  <section class="example-catalog">
    <label
      >Beispiel suchen<input
        v-model="search"
        type="search"
        placeholder="Dijkstra, KMP, Berlin …"
    /></label>
    <div class="example-catalog-list">
      <section v-for="group in groups" :key="group">
        <h3>{{ group }}</h3>
        <div
          v-for="item in EXAMPLES.filter(
            (e) =>
              e.group === group &&
              `${e.name} ${e.group}`
                .toLowerCase()
                .includes(search.toLowerCase()),
          )"
          :key="item.id"
          class="example-catalog-row"
        >
          <button v-if="props.selectable" @click="emit('select', item.example)">
            {{ item.name }}</button
          ><a v-else :href="exampleUrl(item.example)">{{ item.name }}</a
          ><a
            :href="exampleUrl(item.example)"
            target="_blank"
            rel="noopener"
            aria-label="Beispiel in neuem Tab öffnen"
            >↗</a
          >
        </div>
      </section>
      <p v-if="!groups.length">Kein passendes Beispiel gefunden.</p>
    </div>
  </section>
</template>
