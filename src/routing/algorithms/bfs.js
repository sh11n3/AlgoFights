// Breitensuche: FIFO, zuerst Wege mit wenigen Kanten.
export default function findRoute(graph) {
  const queue = [graph.start];
  const seen = new Set(queue);
  const previous = new Map();
  const depth = graph.track && new Float64Array(graph.nodeCount).fill(Infinity);
  if (depth) {
    depth[graph.start] = 0;
    graph.track(depth, previous);
  }
  for (let i = 0; i < queue.length; i++) {
    const node = queue[i];
    graph.trace(node, previous.get(node) ?? -1);
    if (node === graph.target) {
      const path = [];
      for (let v = node; v !== graph.start; ) {
        const edge = previous.get(v);
        path.push(edge);
        v = graph.arcs[edge].from;
      }
      return { path: path.reverse() };
    }
    for (const edge of graph.outgoing[node]) {
      const next = graph.arcs[edge].to;
      if (seen.has(next)) continue;
      seen.add(next);
      previous.set(next, edge);
      if (depth) depth[next] = depth[node] + 1;
      queue.push(next);
    }
  }
  return { path: null };
}
