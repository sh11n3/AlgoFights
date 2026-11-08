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
    <nav class="lab-mode-nav" aria-label="Graph-Sim-Modus">
      <button :aria-pressed="mode === 'lessons'" @click="mode = 'lessons'">
        Lehrlabor</button
      ><button :aria-pressed="mode === 'routes'" @click="mode = 'routes'">
        Start–Ziel-Wegsuche
      </button>
    </nav>
    <LessonLab v-if="mode === 'lessons'" kind="graph" /><RouteGraphSim v-else />
  </div>
</template>
