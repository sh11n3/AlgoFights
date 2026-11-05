import type { RoadGraph, SearchNetwork } from "../routing/types";
import type { RouteOutput } from "../routing/custom";
import queueSource from "../routing/queue.js?raw";
import arrayTraceSource from "../graph/array-trace.js?raw";

// User code only sees a copy, in a blob worker under an opaque iframe origin.
export async function runRouteCode(
  graph: Omit<SearchNetwork, "nodes"> & {
    nodes: Array<
      | Pick<RoadGraph["nodes"][number], "id" | "lat" | "lon">
      | { id: number; label: string; x: number; y: number }
    >;
  },
  start: number,
  target: number,
  code: string,
  signal: AbortSignal,
  options?: {
    heuristic: number[];
    stepLimit: number;
    weighted: boolean;
    directed: boolean;
  },
): Promise<RouteOutput> {
  if (signal.aborted) throw new DOMException("Abgebrochen", "AbortError");
  if (code.length > 50000)
    throw new Error("Höchstens 50.000 Zeichen Code sind erlaubt.");
  const response = await fetch(`${import.meta.env.BASE_URL}route-runner.js`, {
    signal,
  });
  if (!response.ok)
    throw new Error("Die Wegsuche-Sandbox konnte nicht geladen werden.");
  const helpers = options ? `${queueSource}\n${arrayTraceSource}` : queueSource;
  const source = helpers.replace(/^export /gm, "") + "\n" + (await response.text());
  if (signal.aborted) throw new DOMException("Abgebrochen", "AbortError");
  const frame = document.createElement("iframe");
  frame.hidden = true;
  frame.title = "Isolierte eigene Wegsuche";
  frame.sandbox.add("allow-scripts");
  frame.srcdoc = `<!doctype html><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline' 'unsafe-eval' blob:; worker-src blob:; child-src blob:; connect-src 'none'; img-src 'none'; style-src 'none'; form-action 'none'; base-uri 'none'"><script>
    let worker;
    addEventListener('message', e => {
      if(e.source !== parent || e.data.type !== 'init') return;
      try {
        const url=URL.createObjectURL(new Blob([e.data.source],{type:'text/javascript'}));
        worker=new Worker(url); URL.revokeObjectURL(url);
        worker.postMessage(e.data.config,[e.ports[0]]);
      } catch(error) { e.ports[0].postMessage({error:String(error.message)}); }
    });
    parent.postMessage({type:'route-sandbox-ready'},'*');
  <\/script>`;
  return new Promise((resolve, reject) => {
    const channel = new MessageChannel();
    let timer: ReturnType<typeof setTimeout>;
    let settled = false;
    const finish = (error?: unknown, result?: RouteOutput) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      removeEventListener("message", ready);
      signal.removeEventListener("abort", abort);
      channel.port1.close();
      channel.port2.close();
      frame.remove(); // Removes its dedicated worker, including endless user code.
      if (error) reject(error);
      else resolve(result!);
    };
    const abort = () => finish(new DOMException("Abgebrochen", "AbortError"));
    const ready = (event: MessageEvent) => {
      if (
        event.source !== frame.contentWindow ||
        event.data?.type !== "route-sandbox-ready"
      )
        return;
      removeEventListener("message", ready);
      frame.contentWindow!.postMessage(
        {
          type: "init",
          source,
          config: {
            code,
            start,
            target,
            options,
            // A single graph snapshot per run. No map areas, imagery or per-step messages.
            nodes: graph.nodes.map((node) =>
              "lat" in node
                ? { id: node.id, lat: node.lat, lon: node.lon }
                : { id: node.id, label: node.label, x: node.x, y: node.y },
            ),
            arcs: graph.arcs.map(({ from, to, length }) => ({
              from,
              to,
              length,
            })),
            outgoing: graph.outgoing,
            incoming: graph.incoming,
          },
        },
        "*",
        [channel.port2],
      );
    };
    channel.port1.onmessage = ({ data }) => {
      if (data.ready) {
        clearTimeout(timer);
        timer = setTimeout(
          () =>
            finish(
              new Error(
                "Zeitlimit von 5 Sekunden überschritten. Die eigene Wegsuche wurde beendet.",
              ),
            ),
          5000,
        );
        channel.port1.postMessage({ type: "run" });
      } else if (data.error)
        finish(new Error(String(data.error).slice(0, 500)));
      else finish(undefined, data.result);
    };
    timer = setTimeout(
      () =>
        finish(
          new Error("Die Wegsuche-Sandbox konnte nicht gestartet werden."),
        ),
      5000,
    );
    signal.addEventListener("abort", abort, { once: true });
    addEventListener("message", ready);
    channel.port1.start();
    document.body.appendChild(frame);
    if (signal.aborted) abort();
  });
}
