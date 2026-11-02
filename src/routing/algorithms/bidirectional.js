// Bidirektionaler Dijkstra: vorwärts und auf eingehenden Kanten rückwärts.
export default function findRoute(graph) {
  if (graph.start === graph.target) {
    graph.trace(graph.start);
    return { path: [] };
  }
  const forward = graph.createQueue(),
    backward = graph.createQueue();
  const distances = [0, 1].map(() =>
    new Float64Array(graph.nodeCount).fill(Infinity),
  );
  const previous = [0, 1].map(() => new Int32Array(graph.nodeCount).fill(-1));
  const closed = [0, 1].map(() => new Uint8Array(graph.nodeCount));
  distances[0][graph.start] = 0;
  distances[1][graph.target] = 0;
  forward.push(graph.start, 0);
  backward.push(graph.target, 0);
  let best = Infinity,
    meeting = -1;

  function updateMeeting(node) {
    const candidate = distances[0][node] + distances[1][node];
    if (candidate < best) {
      best = candidate;
      meeting = node;
    }
  }
  function clean(queue, side) {
    while (queue.peek() && closed[side][queue.peek().node]) queue.pop();
  }

  while (true) {
    clean(forward, 0);
    clean(backward, 1);
    if (!forward.peek() || !backward.peek()) break;
    // Erst abbrechen, wenn keine kürzere Verbindung mehr möglich ist.
    if (forward.peek().priority + backward.peek().priority >= best) break;
    const side = backward.peek().priority < forward.peek().priority ? 1 : 0;
    const queue = side ? backward : forward;
    const { node } = queue.pop();
    closed[side][node] = 1;
    graph.trace(node, previous[side][node], side);
    updateMeeting(node);

    for (const edge of side ? graph.incoming[node] : graph.outgoing[node]) {
      const arc = graph.arcs[edge];
      const next = side ? arc.from : arc.to;
      const candidate = distances[side][node] + arc.length;
      if (candidate >= distances[side][next]) continue;
      distances[side][next] = candidate;
      previous[side][next] = edge;
      queue.push(next, candidate);
      updateMeeting(next);
    }
  }
  if (meeting < 0) return { path: null };

  const path = [];
  for (let v = meeting; v !== graph.start;) {
    const edge = previous[0][v];
    path.push(edge);
    v = graph.arcs[edge].from;
  }
  path.reverse();
  for (let v = meeting; v !== graph.target;) {
    const edge = previous[1][v];
    path.push(edge);
    v = graph.arcs[edge].to;
  }
  return { path };
}
