<script setup lang="ts">
import { computed, ref } from "vue";
import {
  EXAMPLES,
  SIMULATOR_NAMES,
  exampleUrl,
  type Example,
  type NamedExample,
} from "../sharing/examples";
const props = defineProps<{ selectable?: boolean }>();
const emit = defineEmits<{ select: [example: Example] }>();
const search = ref("");
const query = computed(() => search.value.trim().toLocaleLowerCase("de"));
const results = computed(() =>
  EXAMPLES.filter((item) =>
    `${item.name} ${SIMULATOR_NAMES[item.example.kind]} ${item.topic ?? ""} ${item.id}`
      .toLocaleLowerCase("de")
      .includes(query.value),
  ),
);
const simulators = computed(() => {
  const groups = new Map<string, Map<string, NamedExample[]>>();
  for (const item of results.value) {
    const simulator = SIMULATOR_NAMES[item.example.kind];
    const topics = groups.get(simulator) ?? new Map<string, NamedExample[]>();
    groups.set(simulator, topics);
    const topic = item.topic ?? "";
    const examples = topics.get(topic);
    if (examples) examples.push(item);
    else topics.set(topic, [item]);
  }
  return [...groups];
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
      <section v-for="[simulator, topics] in simulators" :key="simulator">
        <component :is="props.selectable ? 'h3' : 'h2'" class="catalog-simulator">
          {{ simulator }}
        </component>
        <div class="catalog-topics">
          <div v-for="[topic, items] in topics" :key="topic" class="catalog-topic">
            <component
              :is="props.selectable ? 'h4' : 'h3'"
              v-if="topic"
              class="catalog-topic-heading"
            >
              {{ topic }}
            </component>
            <ul>
              <li v-for="item in items" :key="item.id" class="example-catalog-row">
                <button
                  v-if="props.selectable"
                  @click="emit('select', item.example)"
                >
                  {{ item.name }}
                </button>
                <a v-else :href="exampleUrl(item.example)">{{ item.name }}</a>
              </li>
            </ul>
          </div>
        </div>
      </section>
      <p v-if="!simulators.length">Kein passendes Beispiel gefunden.</p>
    </div>
  </section>
</template>
