<script setup lang="ts">
import { computed, ref } from "vue";
import { EXAMPLES, exampleUrl, type Example } from "../sharing/examples";
const props = defineProps<{ selectable?: boolean }>();
const emit = defineEmits<{ select: [example: Example] }>();
const search = ref("");
const query = computed(() => search.value.trim().toLocaleLowerCase("de"));
const results = computed(() =>
  EXAMPLES.filter((item) =>
    `${item.name} ${item.group} ${item.id}`
      .toLocaleLowerCase("de")
      .includes(query.value),
  ),
);
const groups = computed(() => {
  const byGroup = new Map<string, (typeof EXAMPLES)[number][]>();
  for (const item of results.value) {
    const group = byGroup.get(item.group);
    if (group) group.push(item);
    else byGroup.set(item.group, [item]);
  }
  return [...byGroup];
});
</script>
<template>
  <section class="example-catalog">
    <label
      >Beispiel suchen<input
        v-model="search"
        type="search"
        placeholder="Dijkstra, KMP, Berlin …"
    /></label>
    <p v-if="query" class="example-catalog-count" role="status">
      {{ results.length }} passende
      {{ results.length === 1 ? "Simulation" : "Simulationen" }}
    </p>
    <div class="example-catalog-list">
      <section v-for="[group, items] in groups" :key="group">
        <h3>{{ group }}</h3>
        <div v-for="item in items" :key="item.id" class="example-catalog-row">
          <button v-if="props.selectable" @click="emit('select', item.example)">
            {{ item.name }}</button
          ><a v-else :href="exampleUrl(item.example)">{{ item.name }}</a
          ><a
            :href="exampleUrl(item.example)"
            target="_blank"
            rel="noopener"
            :aria-label="`${item.name} in neuem Tab öffnen`"
            >↗</a
          >
        </div>
      </section>
      <p v-if="!groups.length">Kein passendes Beispiel gefunden.</p>
    </div>
  </section>
</template>
