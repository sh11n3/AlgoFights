import { shallowRef, ref, onBeforeUnmount } from "vue";
import { createSandbox } from "./sandbox";
import type { Replay, Settings } from "../core/types";

export function useBattle() {
  const replay = shallowRef<Replay | null>(null);
  const preparing = ref(false),
    progress = ref(0),
    error = ref("");
  let worker: Worker | null = null,
    sandbox: Awaited<ReturnType<typeof createSandbox>> | null = null,
    generation = 0;
  let cancelPromise: (() => void) | null = null;
  function abort() {
    generation++;
    worker?.terminate();
    worker = null;
    sandbox?.dispose();
    sandbox = null;
    preparing.value = false;
    cancelPromise?.();
    cancelPromise = null;
  }
  async function run(settings: Settings): Promise<Replay | null> {
    abort();
    const current = generation;
    preparing.value = true;
    progress.value = 0;
    error.value = "";
    try {
      const created = await createSandbox(settings);
      if (current !== generation) {
        created.dispose();
        return null;
      }
      sandbox = created;
      worker = new Worker(
        new URL("../workers/simulation.ts", import.meta.url),
        { type: "module" },
      );
      return await new Promise<Replay | null>((resolve) => {
        cancelPromise = () => resolve(null);
        worker!.onerror = (event) => {
          error.value = event.message || "Die Berechnung ist fehlgeschlagen.";
          abort();
          resolve(null);
        };
        worker!.onmessage = ({ data }) => {
          if (current !== generation) return;
          if (data.type === "progress")
            progress.value = data.occupied / data.playable;
          if (data.type === "terminate-custom") sandbox?.terminate(data.id);
          if (data.type === "error") {
            error.value = data.error;
            abort();
            resolve(null);
          }
          if (data.type === "result") {
            const result = data.replay as Replay;
            replay.value = result;
            progress.value = 1;
            cancelPromise = null;
            abort();
            resolve(result);
          }
        };
        worker!.postMessage(
          { type: "run", settings, ports: sandbox!.ports },
          Object.values(sandbox!.ports),
        );
      });
    } catch (e) {
      if (current === generation) {
        error.value = e instanceof Error ? e.message : String(e);
        abort();
      }
      return null;
    }
  }
  onBeforeUnmount(abort);
  return { replay, preparing, progress, error, run, abort };
}
