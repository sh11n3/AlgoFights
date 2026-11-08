<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from "vue";
import { basicSetup, EditorView } from "codemirror";
import { javascript } from "@codemirror/lang-javascript";
import { java } from "@codemirror/lang-java";
import { oneDark } from "@codemirror/theme-one-dark";
const props = defineProps<{
  modelValue: string;
  language: "javascript" | "java" | "pseudocode";
}>();
const emit = defineEmits<{ "update:modelValue": [code: string] }>();
const host = ref<HTMLElement>();
let view: EditorView | undefined;
function create() {
  view?.destroy();
  if (!host.value) return;
  view = new EditorView({
    parent: host.value,
    doc: props.modelValue,
    extensions: [
      basicSetup,
      oneDark,
      props.language === "java"
        ? java()
        : props.language === "javascript"
          ? javascript()
          : [],
      EditorView.lineWrapping,
      EditorView.contentAttributes.of({
        "aria-label": `Code-Editor ${props.language}`,
        spellcheck: "false",
      }),
      EditorView.updateListener.of((u) => {
        if (u.docChanged) emit("update:modelValue", u.state.doc.toString());
      }),
      EditorView.theme({
        "&": {
          minHeight: "330px",
          maxHeight: "650px",
          backgroundColor: "#10151e",
          fontSize: "13px",
        },
        ".cm-scroller": { overflow: "auto", fontFamily: "var(--mono)" },
      }),
    ],
  });
}
onMounted(create);
watch(() => props.language, create);
watch(
  () => props.modelValue,
  (value) => {
    if (view && value !== view.state.doc.toString())
      view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: value },
      });
  },
);
onBeforeUnmount(() => view?.destroy());
</script>
<template><div ref="host" class="code-editor lab-code-input"></div></template>
