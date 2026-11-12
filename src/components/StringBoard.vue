<script setup lang="ts">
import { computed } from "vue";
import type { LabState } from "../lab/types";
const props = defineProps<{
  s: string;
  t: string;
  state: LabState;
  matching: boolean;
}>();
const a = computed(() => Array.from(props.s)),
  b = computed(() => Array.from(props.t));
const view = computed(() => props.state.string ?? {});
const upper = computed(() =>
  view.value.phase === "pattern" ? a.value : b.value,
);
const same = computed(
  () =>
    view.value.i !== undefined &&
    view.value.j !== undefined &&
    (props.matching
      ? upper.value[view.value.i] === a.value[view.value.j]
      : a.value[view.value.i] === b.value[view.value.j]),
);
</script>
<template>
  <div class="string-board" :class="{ 'string-matching': matching }">
    <p class="lab-caption">
      {{
        view.phase === "pattern"
          ? "Vorverarbeitung: Das Muster wird mit sich selbst verglichen."
          : matching
            ? "Text oben, Muster darunter. Zahlen sind Zeichenpositionen ab 0."
            : "Präfixe, aktuelle Zeichen und rekonstruierte Übereinstimmungen."
      }}
    </p>
    <div
      class="string-track-scroll"
      tabindex="0"
      aria-label="Zeichenvergleich, horizontal scrollbar"
    >
      <div v-if="matching" class="string-line">
        <b>{{ view.phase === "pattern" ? "p" : "t" }}</b>
        <div class="string-characters">
          <span
            v-for="(char, i) in upper"
            :key="i"
            :class="{
              'char-active': view.i === i,
              'char-equal': view.i === i && same,
            }"
            ><small>{{ i }}</small
            >{{ char === " " ? "␣" : char }}</span
          ><i v-if="!upper.length">ε</i>
        </div>
      </div>
      <div class="string-line">
        <b>{{ matching ? "p" : "s" }}</b>
        <div
          class="string-characters"
          :style="
            matching
              ? {
                  paddingLeft: `calc(${Math.max(0, view.offset ?? 0)} * var(--string-cell-width, 34px))`,
                }
              : undefined
          "
        >
          <span
            v-for="(char, i) in a"
            :key="i"
            :class="{
              'char-active': (matching ? view.j : view.i) === i,
              'char-equal': (matching ? view.j : view.i) === i && same,
              'char-result': view.marks?.some((pair) => pair[0] === i),
            }"
            ><small>{{ i }}</small
            >{{ char === " " ? "␣" : char }}</span
          ><i v-if="!a.length">ε</i>
        </div>
      </div>
      <div v-if="!matching" class="string-line">
        <b>t</b>
        <div class="string-characters">
          <span
            v-for="(char, i) in b"
            :key="i"
            :class="{
              'char-active': view.j === i,
              'char-equal': view.j === i && same,
              'char-result': view.marks?.some((pair) => pair[1] === i),
            }"
            ><small>{{ i }}</small
            >{{ char === " " ? "␣" : char }}</span
          ><i v-if="!b.length">ε</i>
        </div>
      </div>
    </div>
    <p v-if="view.result !== undefined" class="string-result">
      Bisher rekonstruiert: <code>„{{ view.result }}“</code>
    </p>
    <ol v-if="view.edits?.length" class="string-edits">
      <li v-for="(edit, i) in view.edits" :key="i">{{ edit }}</li>
    </ol>
  </div>
</template>
