<script setup lang="ts">
import { computed, defineAsyncComponent, ref, shallowRef, watch } from "vue";
import { Play, Settings2, RotateCcw } from "lucide-vue-next";
import { readExample, exampleTitle, type Example } from "../sharing/examples";
import ShareExample from "./ShareExample.vue";
const LessonLab = defineAsyncComponent(() => import("./LessonLab.vue"));
const AlgoSim = defineAsyncComponent(() => import("./AlgoSim.vue"));
const ArenaExample = defineAsyncComponent(() => import("./ArenaExample.vue"));
const props = defineProps<{ example: Example; compact?: boolean }>();
type Player = { run: () => unknown; getExample: () => Example | null };
const player = ref<Player>(),
  settings = ref(false),
  revision = ref(0);
const clean = computed(() => readExample(props.example));
const initial = shallowRef(readExample(props.example));
const compact = computed(() => !!props.compact && !settings.value);
function getExample() {
  try {
    return player.value?.getExample() ?? (player.value ? null : clean.value);
  } catch {
    return null;
  }
}
const shared = computed(getExample);
watch(
  () => props.example,
  (value) => {
    const next = readExample(value);
    if (JSON.stringify(next) !== JSON.stringify(getExample())) {
      initial.value = next;
      revision.value++;
    }
  },
);
defineExpose({ getExample, run: () => player.value?.run() });
</script>
<template>
  <section
    class="example-player"
    :class="{ 'example-player-compact': compact }"
  >
    <div class="example-player-toolbar">
      <strong>{{ exampleTitle(clean) }}</strong>
      <div>
        <button
          v-if="compact || initial.kind === 'arena'"
          class="secondary-button"
          :disabled="!player"
          @click="player?.run()"
        >
          <Play :size="14" /> Berechnen</button
        ><button
          v-if="compact || props.compact"
          class="secondary-button"
          :aria-pressed="settings"
          @click="settings = !settings"
        >
          <Settings2 :size="14" /> Einstellungen</button
        ><button
          class="icon-button"
          aria-label="Beispiel zurücksetzen"
          @click="
            initial = clean;
            revision++;
            settings = false;
          "
        >
          <RotateCcw :size="15" /></button
        ><ShareExample
          v-if="compact || initial.kind === 'arena'"
          :example="shared"
        />
      </div>
    </div>
    <div class="example-player-content" :key="revision">
      <LessonLab
        v-if="
          initial.kind === 'graph-lesson' ||
          initial.kind === 'graph-route' ||
          initial.kind === 'string'
        "
        :key="initial.kind"
        ref="player"
        :kind="initial.kind === 'string' ? 'string' : 'graph'"
        :initial="initial"
        :compact="compact"
      /><AlgoSim
        v-else-if="initial.kind === 'city'"
        ref="player"
        :initial="initial"
        :compact="compact"
      /><ArenaExample
        v-else
        ref="player"
        :initial="initial"
        :compact="compact"
      />
    </div>
  </section>
</template>
