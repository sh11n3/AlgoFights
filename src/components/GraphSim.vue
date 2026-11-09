<script setup lang="ts">
import { defineAsyncComponent, ref } from "vue";
import "../graph/style.css";
import "../lab/style.css";
const RouteGraphSim = defineAsyncComponent(() => import("./RouteGraphSim.vue"));
const LessonLab = defineAsyncComponent(() => import("./LessonLab.vue"));
const mode = ref("lessons");
</script>
<template>
  <div>
    <nav class="lab-mode-nav" aria-label="Graph Sim: Ansicht auswählen">
      <button :aria-pressed="mode === 'lessons'" @click="mode = 'lessons'">
        Graph-Verfahren</button
      ><button :aria-pressed="mode === 'routes'" @click="mode = 'routes'">
        Start–Ziel-Wegsuche
      </button>
    </nav>
    <KeepAlive>
      <LessonLab v-if="mode === 'lessons'" kind="graph" />
      <RouteGraphSim v-else />
    </KeepAlive>
  </div>
</template>
