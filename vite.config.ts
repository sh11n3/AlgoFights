import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

export default defineConfig({
  plugins: [vue()],
  base: "./",
  worker: { format: "iife" },
  build: {
    target: "es2022",
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return;
          if (
            id.includes("/@lezer/javascript/") ||
            id.includes("/@codemirror/lang-javascript/")
          )
            return "editor-javascript";
          if (
            id.includes("/@codemirror/") ||
            id.includes("/@lezer/") ||
            id.includes("/codemirror/")
          )
            return "editor-core";
        },
      },
    },
  },
});
