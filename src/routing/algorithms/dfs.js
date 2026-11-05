// Tiefensuche: LIFO, einen Zweig zuerst bis in die Tiefe verfolgen.
export default function findRoute(graph) {
  const queue = [graph.start];
  const seen = new Set(queue);
  const previous = new Map();
  graph.track?.(null, previous);
  while (queue.length) {
    const node = queue.pop();
    graph.trace(node, previous.get(node) ?? -1);
    if (node === graph.target) {
      const path = [];
      for (let v = node; v !== graph.start;) {
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
      queue.push(next);
    }
  }
  return { path: null };
}
