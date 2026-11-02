import { Simulation } from "../core/engine";
import type { CustomAnswer, CustomRequest, Settings } from "../core/types";

const scope = self as unknown as DedicatedWorkerGlobalScope;
scope.onmessage = async ({ data }) => {
  if (data.type !== "run") return;
  const start = performance.now();
  try {
    const sim = new Simulation(data.settings as Settings);
    const ports: Record<number, MessagePort> = data.ports ?? {};
    const unavailable = new Map<number, string>();
    const started = performance.now();
    const eventCursors = sim.players.map(() => sim.events.length);
    const pending = new Map<
      number,
      {
        resolve: (answer: CustomAnswer) => void;
        timer: ReturnType<typeof setTimeout>;
      }
    >();
    const waitFor = (
      id: number,
      request?: CustomRequest,
    ): Promise<CustomAnswer> =>
      new Promise((resolve) => {
        if (unavailable.has(id)) {
          resolve({ error: unavailable.get(id) });
          return;
        }
        if (request && performance.now() - started > 45000) {
          const error =
            "Das Rundenbudget von 45 Sekunden für eigenen Code ist überschritten.";
          unavailable.set(id, error);
          scope.postMessage({ type: "terminate-custom", id });
          resolve({ error });
          return;
        }
        const timer = setTimeout(
          () => {
            pending.delete(id);
            const error = request
              ? "Zeitlimit überschritten (250 ms pro Zug). Mögliche Endlosschleife; Strategie wurde beendet."
              : "Die Strategie konnte nicht gestartet werden (Zeitlimit).";
            unavailable.set(id, error);
            scope.postMessage({ type: "terminate-custom", id });
            resolve({ error });
          },
          request ? 250 : 5000,
        );
        pending.set(id, { resolve, timer });
        if (request) ports[id]!.postMessage(request);
      });
    const ready = Object.keys(ports).map((key) => {
      const id = Number(key);
      const promise = waitFor(id);
      ports[id]!.onmessage = ({ data: answer }) => {
        const waiting = pending.get(id);
        if (!waiting) return;
        clearTimeout(waiting.timer);
        pending.delete(id);
        if (answer.error) {
          unavailable.set(id, String(answer.error).slice(0, 400));
          scope.postMessage({ type: "terminate-custom", id });
        }
        waiting.resolve(answer);
      };
      ports[id]!.start();
      return promise;
    });
    await Promise.all(ready);
    let lastProgress = 0;
    while (!sim.finished) {
      if (sim.players.some((p) => p.code !== undefined && !p.fallback)) {
        await sim.tickCustom((p, request) => {
          request.delta = Uint32Array.from(
            sim.events.slice(eventCursors[p.id]),
          );
          eventCursors[p.id] = sim.events.length;
          return waitFor(p.id, request);
        }, new Uint32Array());
      } else sim.tick();
      if (sim.step % 2048 === 0 || performance.now() - lastProgress > 200) {
        scope.postMessage({
          type: "progress",
          occupied: sim.occupied,
          playable: sim.arena.playable,
          step: sim.step,
        });
        lastProgress = performance.now();
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
    }
    for (const port of Object.values(ports)) port.close();
    const replay = sim.replay(performance.now() - start);
    scope.postMessage({ type: "result", replay }, [
      replay.events.buffer,
      replay.offsets.buffer,
      replay.arena.mask.buffer,
    ]);
  } catch (error) {
    scope.postMessage({
      type: "error",
      error: error instanceof Error ? error.message : String(error),
    });
  }
};
