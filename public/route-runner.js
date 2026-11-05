/* Trusted bootstrap in an opaque-origin, network-disabled sandbox worker. */
(() => {
  self.onmessage = ({ data, ports }) => {
    const port = ports[0],
      send = port.postMessage.bind(port);
    const { code, start, target, nodes, arcs, outgoing, incoming, options } =
      data;
    const freeze = Object.freeze,
      now = performance.now.bind(performance);
    const traces = [[], [], []];
    const arrays =
      options && typeof createArrayTrace === "function"
        ? createArrayTrace(nodes.length, arcs)
        : null;
    const stepLimit = {};
    let limited = false;
    let queries = 0;
    const nodeId = (id) => {
      if (!Number.isInteger(id) || !nodes[id])
        throw new Error("Ungültige Knoten-ID: " + id);
      return id;
    };
    nodes.forEach(freeze);
    arcs.forEach(freeze);
    outgoing.forEach(freeze);
    incoming.forEach(freeze);
    const graph = freeze({
      start,
      target,
      nodeCount: nodes.length,
      nodes: freeze(nodes),
      arcs: freeze(arcs),
      outgoing: freeze(outgoing),
      incoming: freeze(incoming),
      ...(options && {
        weighted: options.weighted,
        directed: options.directed,
        stepLimit: options.stepLimit,
        track: arrays?.track,
      }),
      createQueue,
      neighbors(id) {
        if (++queries > 2000000)
          throw new Error("Mehr als 2.000.000 Graph-Abfragen.");
        return outgoing[nodeId(id)].map((edge) =>
          freeze({ id: edge, ...arcs[edge] }),
        );
      },
      heuristic(id) {
        if (++queries > 2000000)
          throw new Error("Mehr als 2.000.000 Graph-Abfragen.");
        if (options) return options.heuristic[nodeId(id)];
        const a = nodes[nodeId(id)],
          b = nodes[target],
          rad = Math.PI / 180;
        const h =
          Math.sin(((b.lat - a.lat) * rad) / 2) ** 2 +
          Math.cos(a.lat * rad) *
            Math.cos(b.lat * rad) *
            Math.sin(((b.lon - a.lon) * rad) / 2) ** 2;
        return (
          6371008.8 *
          2 *
          Math.atan2(Math.sqrt(h), Math.sqrt(Math.max(0, 1 - h)))
        );
      },
      trace(node, edge = -1, side = 0) {
        if (options && traces[0].length >= options.stepLimit) {
          if (!limited) arrays?.capture();
          limited = true;
          throw stepLimit;
        }
        if (traces[0].length >= 250000)
          throw new Error("Höchstens 250.000 Suchschritte sind erlaubt.");
        const id = nodeId(node);
        arrays?.capture();
        traces[0].push(id);
        traces[1].push(edge);
        traces[2].push(side);
      },
    });
    send({ ready: true });
    port.onmessage = () => {
      const begin = now();
      const sendLimited = () =>
        send({
          result: {
            path: null,
            traceNodes: traces[0],
            traceEdges: traces[1],
            traceSides: traces[2],
            milliseconds: now() - begin,
            limited: true,
            arrayFrames: arrays?.frames,
          },
        });
      try {
        const decide = new Function(
          '"use strict";\n' +
            code +
            '\n;if(typeof findRoute!=="function") throw new Error("Definiere function findRoute(graph)."); return findRoute;',
        )();
        const result = decide(graph);
        if (limited) return sendLimited();
        if (
          !result ||
          typeof result !== "object" ||
          typeof result.then === "function"
        )
          throw new Error(
            "findRoute muss synchron { path: [Kanten-IDs] } oder { path: null } zurückgeben.",
          );
        const path = result.found === false ? null : result.path;
        if (
          !(
            path === null ||
            Array.isArray(path) ||
            path instanceof Uint32Array
          ) ||
          (path?.length ?? 0) > 250000
        )
          throw new Error(
            "path muss ein Array von höchstens 250.000 Kanten-IDs oder null sein.",
          );
        const entries = [
          options ? traces[0] : (result.traceNodes ?? traces[0]),
          options ? traces[1] : (result.traceEdges ?? traces[1]),
          options ? traces[2] : (result.traceSides ?? traces[2]),
        ];
        if (
          entries.some(
            (a) =>
              !(Array.isArray(a) || ArrayBuffer.isView(a)) || a.length > 250000,
          ) ||
          entries.some((a) => a.length !== entries[0].length)
        )
          throw new Error(
            "Ungültiges Suchprotokoll. Nutze graph.trace(node, edge, side).",
          );
        if (traces[0].length) arrays?.capture();
        send({
          result: {
            path,
            traceNodes: entries[0],
            traceEdges: entries[1],
            traceSides: entries[2],
            milliseconds: now() - begin,
            arrayFrames: arrays?.frames,
          },
        });
      } catch (error) {
        if (limited) return sendLimited();
        send({ error: String(error?.message || error).slice(0, 500) });
      }
    };
    port.start();
  };
})();
