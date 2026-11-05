<script setup lang="ts">
import { computed, ref, watch } from "vue";
import type { SearchArrayState } from "../graph/array-trace.js";

const props = defineProps<{
  nodes: Array<{ id: number; label: string }>;
  frames?: SearchArrayState[][];
  order?: Uint32Array;
  step: number;
  side?: number;
  breadthFirst: boolean;
}>();
const tableScroll = ref<HTMLElement>();
const orderScroll = ref<HTMLElement>();
const activeNode = computed(() => props.order?.[props.step - 1]);
const dual = computed(() => props.frames?.[0]?.length === 2);
const rows = computed(() => {
  const previous = props.frames?.[props.step - 1];
  return (props.frames?.[props.step] ?? []).flatMap((state) => {
    const suffix = dual.value ? (state.side === 0 ? "₊" : "₋") : "";
    const last = previous?.find((item) => item.side === state.side);
    const row = (name: string, values: number[], before?: number[]) => ({
      name: name + suffix,
      values,
      before,
    });
    return [
      ...(state.dis ? [row("dis", state.dis, last?.dis)] : []),
      row("pre", state.pre, last?.pre),
    ];
  });
});
const shownOrder = computed(
  () => props.order?.subarray(0, props.step).join(" | ") ?? "",
);
const format = (value: number) =>
  value === Infinity ? "∞" : value === -1 ? "−1" : String(value);

watch(
  [() => props.step, () => props.frames],
  () => {
    const scroll = tableScroll.value;
    const cell = scroll?.querySelector(".array-active-node");
    if (scroll && cell) {
      const bounds = scroll.getBoundingClientRect(),
        column = cell.getBoundingClientRect();
      const labelWidth =
        scroll.querySelector("thead th")?.getBoundingClientRect().width ?? 0;
      if (column.right > bounds.right)
        scroll.scrollLeft += column.right - bounds.right;
      if (column.left < bounds.left + labelWidth)
        scroll.scrollLeft -= bounds.left + labelWidth - column.left;
    }
    if (orderScroll.value)
      orderScroll.value.scrollLeft = orderScroll.value.scrollWidth;
  },
  { flush: "post" },
);
</script>

<template>
  <section class="graph-search-arrays" aria-label="Suchverlauf als Arrays">
    <div class="search-array-heading">
      <h3>Suchverlauf als Arrays</h3>
      <span v-if="order"
        >{{
          step === 0 ? "Initialzustand" : `Schritt ${step} / ${order.length}`
        }}
        <template v-if="activeNode !== undefined"
          >· Knoten {{ activeNode }} ({{ nodes[activeNode].label }})</template
        >
        <template v-if="dual && step > 0"
          >· {{ side === 1 ? "rückwärts" : "vorwärts" }}</template
        >
      </span>
    </div>
    <template v-if="order">
      <div
        v-if="rows.length"
        ref="tableScroll"
        class="search-array-scroll"
        tabindex="0"
        aria-label="Distanz- und Vorgängerarrays, horizontal scrollbar"
      >
        <table aria-label="Arraywerte pro Knotenindex">
          <thead>
            <tr>
              <th scope="col">Index</th>
              <td aria-hidden="true"></td>
              <th
                v-for="node in nodes"
                :key="node.id"
                scope="col"
                :title="`Knoten ${node.label}`"
                :class="{ 'array-active-node': node.id === activeNode }"
              >
                {{ node.id }}
              </th>
              <td aria-hidden="true"></td>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in rows" :key="row.name">
              <th scope="row">{{ row.name }} =</th>
              <td class="array-bracket">[</td>
              <td
                v-for="(value, index) in row.values"
                :key="index"
                class="array-entry"
                :class="{
                  'array-changed': row.before && row.before[index] !== value,
                }"
              >
                {{ format(value) }}
              </td>
              <td class="array-bracket">]</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p v-if="rows.length" class="search-array-note">
        {{
          step === 0
            ? "Werte vor dem ersten Schritt."
            : "Werte nach diesem Schritt. Änderungen zum vorigen Schritt sind markiert."
        }}
        <template v-if="rows.some((row) => row.name.startsWith('dis'))">
          <template v-if="breadthFirst">dis zählt Kanten. </template>∞ steht für
          eine noch unbekannte Distanz.</template
        >
        −1 steht für einen fehlenden Vorgänger.<template v-if="dual">
          ₊ vorwärts, ₋ rückwärts.</template
        >
      </p>
      <p v-else class="search-array-note">
        Eigener Code kann mit <code>graph.track(dis, previous)</code> und
        <code>graph.trace(…)</code> seine Arraywerte aufzeichnen.
      </p>
      <div
        ref="orderScroll"
        class="search-array-order"
        tabindex="0"
        aria-label="Expansionsfolge, horizontal scrollbar"
      >
        <code>Expandiert = [{{ shownOrder }}]</code>
      </div>
    </template>
    <p v-else class="search-array-note">
      Starte eine Suche, um die Arraywerte Schritt für Schritt zu verfolgen.
    </p>
  </section>
</template>
