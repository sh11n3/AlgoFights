import runtime from "../lab/runtime.js?raw";
import type { LabInput, LabResult } from "../lab/types";

export function runLesson(
  input: LabInput,
  source: string,
  limit: number,
  signal: AbortSignal,
  custom = false,
): Promise<LabResult> {
  return custom
    ? sandbox(input, source, limit, signal)
    : new Promise((resolve, reject) => {
        if (signal.aborted) {
          reject(new DOMException("Abgebrochen", "AbortError"));
          return;
        }
        const worker = new Worker(
          new URL("../workers/lessons.ts", import.meta.url),
          { type: "module" },
        );
        const finish = (error?: unknown, result?: LabResult) => {
          clearTimeout(timer);
          signal.removeEventListener("abort", abort);
          worker.terminate();
          if (error) reject(error);
          else resolve(result!);
        };
        const abort = () =>
          finish(new DOMException("Abgebrochen", "AbortError"));
        const timer = setTimeout(
          () =>
            finish(
              new Error(
                "Berechnung nach 5 Sekunden beendet. Eingabe verkleinern.",
              ),
            ),
          5000,
        );
        signal.addEventListener("abort", abort, { once: true });
        worker.onmessage = ({ data }) =>
          finish(data.error ? new Error(data.error) : undefined, data.result);
        worker.onerror = () =>
          finish(
            new Error("Der Berechnungsworker konnte nicht ausgeführt werden."),
          );
        worker.postMessage({ input, source, limit });
      });
}

async function sandbox(
  input: LabInput,
  source: string,
  limit: number,
  signal: AbortSignal,
): Promise<LabResult> {
  if (signal.aborted) throw new DOMException("Abgebrochen", "AbortError");
  if (source.length > 50000) throw Error("Höchstens 50.000 Zeichen Code.");
  const response = await fetch(`${import.meta.env.BASE_URL}lesson-runner.js`, {
    signal,
  });
  if (!response.ok)
    throw Error("Die Lehrlabor-Sandbox konnte nicht geladen werden.");
  const bootstrap =
    runtime.replace(/^export /gm, "") + "\n" + (await response.text());
  if (signal.aborted) throw new DOMException("Abgebrochen", "AbortError");
  const frame = document.createElement("iframe");
  frame.hidden = true;
  frame.title = "Isolierter eigener Lehralgorithmus";
  frame.sandbox.add("allow-scripts");
  frame.srcdoc = `<!doctype html><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline' 'unsafe-eval' blob:; worker-src blob:; child-src blob:; connect-src 'none'; style-src 'none'; img-src 'none'; form-action 'none'; base-uri 'none'"><script>let worker;addEventListener('message',e=>{if(e.source!==parent||e.data.type!=='init')return;try{const url=URL.createObjectURL(new Blob([e.data.bootstrap],{type:'text/javascript'}));worker=new Worker(url);URL.revokeObjectURL(url);worker.postMessage(e.data.config,[e.ports[0]]);}catch(error){e.ports[0].postMessage({error:String(error.message)});}});parent.postMessage({type:'lesson-ready'},'*');<\/script>`;
  return new Promise((resolve, reject) => {
    let settled = false;
    const channel = new MessageChannel();
    const finish = (error?: unknown, result?: LabResult) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      removeEventListener("message", ready);
      signal.removeEventListener("abort", abort);
      channel.port1.close();
      channel.port2.close();
      frame.remove();
      if (error) reject(error);
      else resolve(result!);
    };
    const abort = () => finish(new DOMException("Abgebrochen", "AbortError"));
    const ready = (e: MessageEvent) => {
      if (e.source !== frame.contentWindow || e.data?.type !== "lesson-ready")
        return;
      removeEventListener("message", ready);
      frame.contentWindow!.postMessage(
        { type: "init", bootstrap, config: { input, source, limit } },
        "*",
        [channel.port2],
      );
    };
    let timer = setTimeout(
      () => finish(new Error("Die Sandbox konnte nicht gestartet werden.")),
      5000,
    );
    channel.port1.onmessage = ({ data }) => {
      if (data.ready) {
        clearTimeout(timer);
        timer = setTimeout(
          () =>
            finish(
              new Error(
                "Zeitlimit von 5 Sekunden überschritten. Der eigene Algorithmus wurde beendet.",
              ),
            ),
          5000,
        );
        channel.port1.postMessage({ run: true });
      } else
        finish(data.error ? new Error(data.error) : undefined, data.result);
    };
    signal.addEventListener("abort", abort, { once: true });
    addEventListener("message", ready);
    channel.port1.start();
    document.body.appendChild(frame);
    if (signal.aborted) abort();
  });
}
