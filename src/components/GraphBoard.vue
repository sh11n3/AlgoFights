<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import type { GraphPreset } from "../graph/presets";
import type { TeachingGraph } from "../graph/simulation";

const props = defineProps<{
  preset: GraphPreset;
  graph: TeachingGraph;
  directed: boolean;
  weighted: boolean;
  start: number;
  target: number;
  visited: Map<number, number>;
  searchEdges: Map<number, number>;
  current: number | undefined;
  currentEdge: number | undefined;
  step: number;
  path: Uint32Array | undefined;
}>();
const emit = defineEmits<{ select: [node: number] }>();
const svg = ref<SVGSVGElement>();
const width = ref(720),
  height = ref(440);
let observer: ResizeObserver | undefined;
onMounted(() => {
  if (!svg.value) return;
  observer = new ResizeObserver(([entry]) => {
    width.value = entry.contentRect.width || 720;
    height.value = entry.contentRect.height || 440;
  });
  observer.observe(svg.value);
});
onBeforeUnmount(() => observer?.disconnect());

const radius = computed(() => (width.value < 520 ? 12 : 16));
const points = computed(() => {
  const padding = radius.value + (width.value < 520 ? 11 : 16);
  const plotWidth = width.value - 2 * padding;
  const plotHeight = height.value - 2 * padding;
  return props.graph.nodes.map((node) => ({
    ...node,
    x: padding + node.x * plotWidth,
    y: padding + node.y * plotHeight,
  }));
});
const segments = computed(() =>
  props.preset.edges.map(([from, to, cost]) => {
    const a = points.value[from],
      b = points.value[to];
    const length = Math.hypot(b.x - a.x, b.y - a.y);
    const ux = (b.x - a.x) / length,
      uy = (b.y - a.y) / length;
    const gap = radius.value + 1;
    const head = Math.min(7, (length - 2 * gap) * 0.65);
    const labelOffset = length - 2 * gap < 26 ? -10 : 0;
    const x1 = a.x + ux * gap,
      y1 = a.y + uy * gap;
    const x2 = b.x - ux * gap,
      y2 = b.y - uy * gap;
    return {
      cost,
      line: `M ${x1} ${y1} L ${x2} ${y2}`,
      arrow: `M ${x2 - ux * head - uy * 3.5} ${y2 - uy * head + ux * 3.5} L ${x2} ${y2} L ${x2 - ux * head + uy * 3.5} ${y2 - uy * head - ux * 3.5}`,
      x: (a.x + b.x) / 2 - uy * labelOffset,
      y: (a.y + b.y) / 2 + ux * labelOffset,
    };
  }),
);
const routeSegments = computed(() => {
  const list = new Map<number, number>();
  props.path?.forEach((arc, index) => {
    const segment = props.graph.arcs[arc].segment;
    if (!list.has(segment)) list.set(segment, index);
  });
  return list;
});
</script>

<template>
  <svg
    ref="svg"
    class="graph-board"
    role="group"
    aria-label="Interaktiver Graph"
    :viewBox="`0 0 ${width} ${height}`"
  >
    <g aria-hidden="true">
      <g
        v-for="(segment, index) in segments"
        :key="index"
        class="graph-edge"
        :class="{
          visited: searchEdges.has(index),
          backward: searchEdges.get(index) === 1,
        }"
      >
        <path :d="segment.line" />
        <path v-if="directed" :d="segment.arrow" />
      </g>
      <path
        v-if="currentEdge !== undefined && !path"
        :key="step"
        class="graph-edge-flash"
        :class="{ backward: searchEdges.get(currentEdge) === 1 }"
        :d="segments[currentEdge].line"
        pathLength="1"
      />
      <g
        v-for="[segment, index] in routeSegments"
        :key="segment"
        class="graph-solution"
        :style="{ '--edge-delay': `${Math.min(index, 28) * 38}ms` }"
      >
        <path
          :d="segments[segment].line"
          pathLength="1"
          class="graph-solution-line"
        />
        <path
          v-if="directed"
          :d="segments[segment].arrow"
          class="graph-solution-arrow"
        />
      </g>
      <text
        v-for="(segment, index) in weighted ? segments : []"
        :key="index"
        class="graph-weight"
        :class="{ 'on-route': routeSegments.has(index) }"
        :x="segment.x"
        :y="segment.y"
      >
        {{ segment.cost }}
      </text>
    </g>
    <g
      v-for="point in points"
      :key="point.id"
      class="graph-node"
      role="button"
      tabindex="0"
      :class="{
        start: point.id === start,
        target: point.id === target,
        visited: visited.has(point.id),
        backward: visited.get(point.id) === 1,
      }"
      :aria-label="`Knoten ${point.label}${point.id === start ? ', Start' : ''}${point.id === target ? ', Ziel' : ''}`"
      :transform="`translate(${point.x} ${point.y})`"
      @click="emit('select', point.id)"
      @keydown.enter.prevent="emit('select', point.id)"
      @keydown.space.prevent="emit('select', point.id)"
    >
      <circle :r="radius + 7" class="graph-node-hit" />
      <circle
        v-if="point.id === current"
        :key="step"
        :r="radius + 4"
        class="graph-node-pulse"
        aria-hidden="true"
      />
      <circle :r="radius" class="graph-node-body" />
      <text>{{ point.label }}</text>
    </g>
  </svg>
</template>
