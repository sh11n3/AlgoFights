import { createArena, startPositions } from "../core/arena";
import { hashSeed } from "../core/random";
import type { Settings } from "../core/types";

// The iframe has no allow-same-origin, storage, navigation, forms, or network permissions.
// Only a trusted bootstrap runs in it. Each custom strategy gets a separate blob worker.
export async function createSandbox(settings: Settings): Promise<{
  ports: Record<number, MessagePort>;
  terminate: (id: number) => void;
  dispose: () => void;
}> {
  const custom = settings.participants
    .map((p, id) => ({ ...p, id }))
    .filter((p) => p.code !== undefined);
  if (!custom.length) return { ports: {}, terminate() {}, dispose() {} };
  const response = await fetch(
    new URL(`${import.meta.env.BASE_URL}strategy-runner.js`, location.href),
  );
  if (!response.ok)
    throw new Error("Die Strategie-Sandbox konnte nicht geladen werden.");
  const source = await response.text();
  const frame = document.createElement("iframe");
  frame.hidden = true;
  frame.title = "Isolierte Strategieausführung";
  frame.sandbox.add("allow-scripts");
  frame.srcdoc = `<!doctype html><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline' 'unsafe-eval' blob:; worker-src blob:; child-src blob:; connect-src 'none'; img-src 'none'; style-src 'none'; form-action 'none'; base-uri 'none'"><script>
    const workers = new Map();
    addEventListener('message', (e) => {
      if (e.source !== parent) return;
      if (e.data.type === 'terminate') { workers.get(e.data.id)?.terminate(); workers.delete(e.data.id); return; }
      if (e.data.type !== 'init') return;
      try {
        const url = URL.createObjectURL(new Blob([e.data.source], {type:'text/javascript'}));
        const worker = new Worker(url); URL.revokeObjectURL(url);
        workers.set(e.data.config.id, worker);
        worker.postMessage(e.data.config, [e.ports[0]]);
      } catch (error) { e.ports[0].postMessage({ready:true,error:String(error.message)}); }
    });
    parent.postMessage({type:'sandbox-ready'}, '*');
  <\/script>`;
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup();
      frame.remove();
      reject(new Error("Die Sandbox konnte nicht geöffnet werden."));
    }, 5000);
    const listener = (event: MessageEvent) => {
      if (
        event.source === frame.contentWindow &&
        event.data?.type === "sandbox-ready"
      ) {
        cleanup();
        resolve();
      }
    };
    const cleanup = () => {
      clearTimeout(timer);
      removeEventListener("message", listener);
    };
    addEventListener("message", listener);
    document.body.appendChild(frame);
  });
  const arena = createArena(settings.shape, settings.resolution);
  const initial = Uint32Array.from(
    startPositions(arena, settings.participants.length, settings.seed).map(
      (pos, id) => (pos << 2) | id,
    ),
  );
  const ports: Record<number, MessagePort> = {};
  for (const participant of custom) {
    const channel = new MessageChannel();
    ports[participant.id] = channel.port1;
    frame.contentWindow!.postMessage(
      {
        type: "init",
        source,
        config: {
          id: participant.id,
          code: participant.code,
          width: arena.width,
          height: arena.height,
          mask: arena.mask,
          initial,
          seed: hashSeed(settings.seed + ":player:" + participant.id),
        },
      },
      "*",
      [channel.port2],
    );
  }
  return {
    ports,
    terminate(id) {
      frame.contentWindow?.postMessage({ type: "terminate", id }, "*");
    },
    dispose() {
      for (const port of Object.values(ports)) port.close();
      frame.remove();
    },
  };
}
