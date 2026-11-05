<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from "vue";
import { EditorView } from "codemirror";
import { java } from "@codemirror/lang-java";
import { oneDark } from "@codemirror/theme-one-dark";

const props = defineProps<{ code: string; language: "java" | "pseudocode" }>();
const host = ref<HTMLElement>();
let view: EditorView | undefined;
onMounted(() => {
  view = new EditorView({
    doc: props.code,
    parent: host.value,
    extensions: [
      oneDark,
      props.language === "java" ? java() : [],
      EditorView.editable.of(false),
      EditorView.contentAttributes.of({
        tabindex: "0",
        "aria-readonly": "true",
        "aria-label":
          props.language === "java" ? "Java-Referenzcode" : "Pseudocode",
      }),
      EditorView.lineWrapping,
      EditorView.theme({
        "&": {
          maxHeight: "min(65vh, 700px)",
          fontSize: "13px",
          backgroundColor: "#10151e",
        },
        ".cm-scroller": { fontFamily: "var(--mono)", overflow: "auto" },
      }),
    ],
  });
});
watch(
  () => props.code,
  (insert) => {
    if (!view) return;
    view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert } });
    view.scrollDOM.scrollTop = 0;
  },
);
onBeforeUnmount(() => view?.destroy());
</script>

<template><div ref="host" class="code-editor code-reference"></div></template>
