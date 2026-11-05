// A*: bisherige Kosten plus geschätzte Restkosten zum Ziel.
export default function findRoute(graph) {
  const distance = new Float64Array(graph.nodeCount).fill(Infinity);
  const previous = new Int32Array(graph.nodeCount).fill(-1);
  const closed = new Uint8Array(graph.nodeCount);
  const queue = graph.createQueue();
  distance[graph.start] = 0;
  graph.track?.(distance, previous);
  queue.push(graph.start, 0);

  while (queue.peek()) {
    const { node } = queue.pop();
    if (closed[node]) continue;
    closed[node] = 1;
    graph.trace(node, previous[node]);

    if (node === graph.target) {
      const path = [];
      for (let v = node; v !== graph.start;) {
        const edge = previous[v];
        path.push(edge);
        v = graph.arcs[edge].from;
      }
      return { path: path.reverse() };
    }

    for (const edge of graph.outgoing[node]) {
      const arc = graph.arcs[edge];
      const candidate = distance[node] + arc.length;
      if (closed[arc.to] || candidate >= distance[arc.to]) continue;
      distance[arc.to] = candidate;
      previous[arc.to] = edge;
      queue.push(arc.to, candidate + graph.heuristic(arc.to));
    }
  }
  return { path: null };
}
