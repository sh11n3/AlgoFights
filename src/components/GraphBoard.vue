<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import type { GraphPreset, Point } from "../graph/presets";
import type { TeachingGraph } from "../graph/simulation";

const props = withDefaults(
  defineProps<{
    preset: GraphPreset;
    graph: TeachingGraph;
    directed: boolean;
    weighted: boolean;
    start: number;
    target: number;
    visited?: Map<number, number>;
    searchEdges?: Map<number, number>;
    current?: number;
    source?: number;
    tempo?: number;
    step?: number;
    path?: Uint32Array;
    builder?: {
      selectedNode: number | null;
      selectedEdge: number | null;
      edgeMode: boolean;
    };
  }>(),
  {
    visited: () => new Map(),
    searchEdges: () => new Map(),
    tempo: 360,
    step: 0,
  },
);
const emit = defineEmits<{
  select: [node: number];
  place: [point: Point];
  selectEdge: [edge: number];
}>();
const travelFrames = new WeakMap<SVGGElement, number>();
const vTravel = {
  mounted(element: SVGGElement, { value: duration }: { value: number }) {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const path =
      element.parentElement?.querySelector<SVGPathElement>(
        ".graph-motion-line",
      );
    if (!path) return;
    const startTime = performance.now();
    const length = path.getTotalLength();
    const draw = (time: number) => {
      const progress = Math.max(0, Math.min(1, (time - startTime) / duration));
      const point = path.getPointAtLength(length * progress);
      element.setAttribute("transform", `translate(${point.x} ${point.y})`);
      if (progress < 1) travelFrames.set(element, requestAnimationFrame(draw));
      else travelFrames.delete(element);
    };
    draw(startTime);
  },
  unmounted(element: SVGGElement) {
    const frame = travelFrames.get(element);
    if (frame !== undefined) cancelAnimationFrame(frame);
    travelFrames.delete(element);
  },
};
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
const padding = computed(() => radius.value + (width.value < 520 ? 11 : 16));
const points = computed(() => {
  const inset = padding.value;
  const plotWidth = width.value - 2 * inset;
  const plotHeight = height.value - 2 * inset;
  return props.graph.nodes.map((node) => ({
    ...node,
    x: inset + node.x * plotWidth,
    y: inset + node.y * plotHeight,
  }));
});
function placePoint(event: MouseEvent) {
  if (!props.builder || !svg.value) return;
  const bounds = svg.value.getBoundingClientRect();
  const inset = padding.value;
  const coordinate = (value: number, length: number) =>
    Math.max(0, Math.min(1, (value - inset) / (length - 2 * inset)));
  emit("place", [
    coordinate(event.clientX - bounds.left, bounds.width),
    coordinate(event.clientY - bounds.top, bounds.height),
  ]);
}
const segments = computed(() => {
  const labels: Point[] = [];
  return props.preset.edges.map(([from, to, cost]) => {
    const a = points.value[from],
      b = points.value[to];
    const length = Math.hypot(b.x - a.x, b.y - a.y);
    const ux = (b.x - a.x) / length,
      uy = (b.y - a.y) / length;
    const gap = Math.min(radius.value + 1, length * 0.36);
    const head = Math.min(7, (length - 2 * gap) * 0.65);
    const labelOffset = length - 2 * gap < 26 ? -10 : 0;
    const x1 = a.x + ux * gap,
      y1 = a.y + uy * gap;
    const x2 = b.x - ux * gap,
      y2 = b.y - uy * gap;
    const labelAt = (t: number): Point => [
      a.x + (b.x - a.x) * t - uy * labelOffset,
      a.y + (b.y - a.y) * t + ux * labelOffset,
    ];
    const [x, y] =
      [0.5, 0.38, 0.62, 0.29, 0.71]
        .map(labelAt)
        .find(
          ([x, y]) =>
            labels.every(([lx, ly]) => Math.hypot(lx - x, ly - y) >= 16) &&
            points.value.every(
              (node) => Math.hypot(node.x - x, node.y - y) >= radius.value + 4,
            ),
        ) ?? labelAt(0.5);
    labels.push([x, y]);
    return {
      cost,
      line: `M ${x1} ${y1} L ${x2} ${y2}`,
      arrow: `M ${x2 - ux * head - uy * 3.5} ${y2 - uy * head + ux * 3.5} L ${x2} ${y2} L ${x2 - ux * head + uy * 3.5} ${y2 - uy * head - ux * 3.5}`,
      x,
      y,
    };
  });
});
const routeSegments = computed(() => {
  const list = new Map<number, number>();
  props.path?.forEach((arc, index) => {
    const segment = props.graph.arcs[arc].segment;
    if (!list.has(segment)) list.set(segment, index);
  });
  return list;
});
const searchLine = computed(() => {
  if (props.source === undefined || props.current === undefined) return "";
  const a = points.value[props.source],
    b = points.value[props.current];
  return `M ${a.x} ${a.y} L ${b.x} ${b.y}`;
});
const searchDuration = computed(() => Math.min(props.tempo, 420));
const route = computed(() => {
  const path = props.path;
  const arrivals = new Map<number, number>();
  if (!path || path.length > 2000) return { line: "", duration: 0, arrivals };
  const a = points.value[props.start];
  let line = `M ${a.x} ${a.y}`,
    total = 0,
    previous = a;
  arrivals.set(props.start, 0);
  for (const arc of path) {
    const next = points.value[props.graph.arcs[arc].to];
    total += Math.hypot(next.x - previous.x, next.y - previous.y);
    line += ` L ${next.x} ${next.y}`;
    if (!arrivals.has(next.id)) arrivals.set(next.id, total);
    previous = next;
  }
  const duration = total > 0 ? Math.min(1800, 500 + path.length * 85) : 0;
  for (const [node, distance] of arrivals)
    arrivals.set(node, total ? (distance / total) * duration : 0);
  return { line: total ? line : "", duration, arrivals };
});
</script>

<template>
  <svg
    ref="svg"
    class="graph-board"
    :class="{ 'graph-board-builder': builder }"
    role="group"
    aria-label="Interaktiver Graph"
    :viewBox="`0 0 ${width} ${height}`"
    @click="placePoint"
  >
    <text
      v-if="builder && !points.length"
      :x="width / 2"
      :y="height / 2"
      class="graph-builder-empty"
    >
      Ersten Knoten auf der Fläche setzen
    </text>
    <g aria-hidden="true">
      <g
        v-for="(segment, index) in segments"
        :key="index"
        class="graph-edge"
        :class="{
          visited: searchEdges.has(index),
          backward: searchEdges.get(index) === 1,
          'edge-selected': builder?.selectedEdge === index,
        }"
      >
        <path :d="segment.line" />
        <path v-if="directed" :d="segment.arrow" />
        <path
          v-if="builder?.edgeMode"
          :d="segment.line"
          class="graph-edge-hit"
          @click.stop="emit('selectEdge', index)"
        />
      </g>
      <g
        v-if="searchLine && !path"
        :key="step"
        class="graph-search-motion"
        :class="{
          backward: current !== undefined && visited.get(current) === 1,
        }"
        :style="{ '--motion-duration': `${searchDuration}ms` }"
      >
        <path class="graph-motion-halo" :d="searchLine" pathLength="1" />
        <path class="graph-motion-line" :d="searchLine" pathLength="1" />
        <g v-travel="searchDuration" class="graph-traveler">
          <circle class="graph-traveler-halo" r="8" />
          <circle class="graph-traveler-core" r="3" />
        </g>
      </g>
      <g
        v-if="route.line"
        class="graph-route-motion"
        :style="{ '--motion-duration': `${route.duration}ms` }"
      >
        <path class="graph-motion-halo" :d="route.line" pathLength="1" />
        <path class="graph-motion-line" :d="route.line" pathLength="1" />
        <g v-travel="route.duration" class="graph-traveler">
          <circle class="graph-traveler-halo" r="11" />
          <circle class="graph-traveler-core" r="4" />
        </g>
      </g>
      <g
        v-for="[segment, index] in routeSegments"
        :key="segment"
        class="graph-solution"
        :style="{
          '--edge-delay': `${route.arrivals.get(graph.arcs[path![index]].to) ?? 0}ms`,
        }"
      >
        <path v-if="!route.line" :d="segments[segment].line" />
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
        'node-selected': builder?.selectedNode === point.id,
      }"
      :aria-label="`Knoten ${point.label}${point.id === start ? ', Start' : ''}${point.id === target ? ', Ziel' : ''}`"
      :transform="`translate(${point.x} ${point.y})`"
      @click.stop="emit('select', point.id)"
      @keydown.enter.prevent="emit('select', point.id)"
      @keydown.space.prevent="emit('select', point.id)"
    >
      <circle :r="radius + 7" class="graph-node-hit" />
      <circle
        v-if="point.id === current && !path"
        :key="step"
        :r="radius + 4"
        class="graph-node-pulse"
        aria-hidden="true"
      />
      <circle
        v-if="route.arrivals.has(point.id)"
        :r="radius + 3"
        class="graph-route-arrival"
        :class="{ goal: point.id === target }"
        :style="{ '--arrival': `${route.arrivals.get(point.id)}ms` }"
        aria-hidden="true"
      />
      <circle :r="radius" class="graph-node-body" />
      <text>{{ point.label }}</text>
    </g>
  </svg>
</template>
