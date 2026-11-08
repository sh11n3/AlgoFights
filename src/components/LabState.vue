<script setup lang="ts">
import { computed } from "vue";
import type { LabInput, LabState, LabValue } from "../lab/types";
const props = defineProps<{
  state: LabState;
  before?: LabState;
  input: LabInput;
}>();
function follow(element: HTMLElement) {
  const active = element.querySelector<HTMLElement>(".lab-current-cell");
  if (!active || !element.clientWidth) return;
  const bounds = element.getBoundingClientRect(),
    cell = active.getBoundingClientRect();
  const left =
    element.querySelector("tbody th")?.getBoundingClientRect().width ?? 0;
  const top =
    element.querySelector("thead")?.getBoundingClientRect().height ?? 0;
  if (cell.right > bounds.right)
    element.scrollLeft += cell.right - bounds.right;
  if (cell.left < bounds.left + left)
    element.scrollLeft -= bounds.left + left - cell.left;
  if (cell.bottom > bounds.bottom)
    element.scrollTop += cell.bottom - bounds.bottom;
  if (cell.top < bounds.top + top)
    element.scrollTop -= bounds.top + top - cell.top;
}
const vFollow = { mounted: follow, updated: follow };
const label = (v: LabValue) =>
  typeof v === "number" && v >= 0
    ? (props.input.nodes[v]?.label ?? String(v))
    : format(v);
const format = (v: LabValue): string =>
  v === Infinity
    ? "∞"
    : v === -Infinity
      ? "−∞"
      : v === -1
        ? "−1"
        : v === null
          ? "—"
          : String(v);
const header = (i: number, length: number, axis?: string) =>
  axis !== "position" &&
  props.input.kind === "graph" &&
  length === props.input.nodes.length
    ? props.input.nodes[i].label
    : String(i);
const sequence = computed(() => [
  ...(props.state.queue
    ? [{ name: "q · FIFO", values: props.state.queue }]
    : []),
  ...(props.state.stack
    ? [{ name: "Aufrufpfad", values: props.state.stack }]
    : []),
  ...(props.state.order
    ? [{ name: "ord · Ausgabe", values: props.state.order }]
    : []),
]);
const rowLabel = (i: number) =>
  props.input.kind === "graph"
    ? (props.input.nodes[i]?.label ?? String(i))
    : i === 0
      ? "0 · ε"
      : `${i} · ${Array.from(props.input.s)[i - 1] ?? ""}`;
const colLabel = (i: number) =>
  props.input.kind === "graph"
    ? (props.input.nodes[i]?.label ?? String(i))
    : i === 0
      ? "0 · ε"
      : `${i} · ${Array.from(props.input.t)[i - 1] ?? ""}`;
const changed = (name: string, i: number, value: LabValue) => {
  const a = props.before?.arrays?.find((a) => a.name === name);
  return !!a && a.values[i] !== value;
};
const matrixChanged = (name: string, i: number, j: number, value: LabValue) => {
  const m = props.before?.matrices?.find((m) => m.name === name);
  return !!m && m.values[i]?.[j] !== value;
};
</script>
<template>
  <section class="lab-state" aria-label="Live-Zustand des Algorithmus">
    <div v-if="state.arrays?.length" v-follow class="lab-scroll">
      <table class="lab-array-table">
        <tbody>
          <template v-for="array in state.arrays" :key="array.name">
            <tr class="lab-array-indices">
              <th>Index</th>
              <td
                v-for="(_, i) in array.values"
                :key="i"
                :class="{
                  'lab-current-cell':
                    array.axis !== 'position' &&
                    input.kind === 'graph' &&
                    array.values.length === input.nodes.length &&
                    state.current === i,
                }"
              >
                {{ header(i, array.values.length, array.axis) }}
              </td>
            </tr>
            <tr>
              <th>{{ array.name }} =</th>
              <td
                v-for="(value, i) in array.values"
                :key="i"
                :class="{ 'lab-changed': changed(array.name, i, value) }"
                :title="
                  array.kind === 'colors'
                    ? '0 unentdeckt · 1 offen · 2 abgeschlossen'
                    : undefined
                "
              >
                {{ array.kind === "nodes" ? label(value) : format(value) }}
              </td>
            </tr>
          </template>
        </tbody>
      </table>
    </div>
    <div v-for="seq in sequence" :key="seq.name" class="lab-sequence">
      <b>{{ seq.name }}</b
      ><code>⟨ {{ seq.values.map(label).join(" | ") || "leer" }} ⟩</code>
    </div>
    <div v-if="state.heap" class="lab-heap">
      <b>Offene Prioritäten · Arraydarstellung</b>
      <div class="lab-heap-items">
        <span
          v-for="(item, i) in state.heap"
          :key="item[0]"
          :title="`Position ${i}; Elternposition ${i ? Math.floor((i - 1) / 2) : 'keine'}`"
          ><small>{{ i }}</small
          >{{ label(item[0]) }} : {{ format(item[1]) }}</span
        ><span v-if="!state.heap.length">leer</span>
      </div>
    </div>
    <div v-if="state.matrices?.length" class="lab-matrices">
      <details
        v-for="(matrix, index) in state.matrices"
        :key="matrix.name"
        :open="index < 2"
      >
        <summary>{{ matrix.name }}</summary>
        <div
          v-follow
          class="lab-scroll lab-matrix-scroll"
          tabindex="0"
          :aria-label="`Matrix ${matrix.name}, horizontal und vertikal scrollbar`"
        >
          <table class="lab-matrix">
            <thead>
              <tr>
                <th>u \ v</th>
                <th v-for="(_, j) in matrix.values[0]" :key="j">
                  {{ colLabel(j) }}
                </th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(row, i) in matrix.values" :key="i">
                <th>{{ rowLabel(i) }}</th>
                <td
                  v-for="(value, j) in row"
                  :key="j"
                  :class="{
                    'lab-current-cell':
                      matrix.active?.[0] === i && matrix.active?.[1] === j,
                    'lab-source-cell': matrix.sources?.some(
                      (p) => p[0] === i && p[1] === j,
                    ),
                    'lab-changed': matrixChanged(matrix.name, i, j, value),
                  }"
                >
                  {{
                    matrix.kind === "nodes" && input.kind === "graph"
                      ? label(value)
                      : format(value)
                  }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </details>
    </div>
    <p class="lab-caption">
      ∞ unbekannt oder unerreichbar · −1 kein Eintrag · −∞ unbeschränkt sinkende
      Kosten. Markierte Werte haben sich seit dem vorigen Schritt verändert.
    </p>
  </section>
</template>
