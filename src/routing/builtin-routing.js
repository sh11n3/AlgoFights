function distance(a, b) {
  const rad = Math.PI / 180,
    x = (b.lat - a.lat) * rad,
    y = (b.lon - a.lon) * rad;
  const h =
    Math.sin(x / 2) ** 2 +
    Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(y / 2) ** 2;
  return (
    6371008.8 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(Math.max(0, 1 - h)))
  );
}
class Heap {
  values = [];
  push(node, priority) {
    const item = [node, priority];
    this.values.push(item);
    let i = this.values.length - 1;
    while (i) {
      const p = (i - 1) >> 1;
      if (this.values[p][1] <= priority) break;
      this.values[i] = this.values[p];
      i = p;
    }
    this.values[i] = item;
  }
  pop() {
    const first = this.values[0],
      last = this.values.pop();
    if (!this.values.length) return first;
    let i = 0;
    while (true) {
      let c = i * 2 + 1;
      if (c >= this.values.length) break;
      if (
        c + 1 < this.values.length &&
        this.values[c + 1][1] < this.values[c][1]
      )
        c++;
      if (this.values[c][1] >= last[1]) break;
      this.values[i] = this.values[c];
      i = c;
    }
    this.values[i] = last;
    return first;
  }
  peek() {
    return this.values[0];
  }
}
export function searchGraph(graph, start, target, algorithm) {
  if (
    !Number.isInteger(start) ||
    !Number.isInteger(target) ||
    !graph.nodes[start] ||
    !graph.nodes[target]
  )
    throw new Error("Start und Ziel müssen gültige Straßenknoten sein.");
  const begin = performance.now(),
    n = graph.nodes.length;
  const nodes = [],
    edges = [],
    sides = [];
  const trace = (node, edge, side = 0) => {
    nodes.push(node);
    edges.push(edge);
    sides.push(side);
  };
  const df = new Float64Array(n).fill(Infinity),
    pf = new Int32Array(n).fill(-1);
  df[start] = 0;
  const path = [];
  let found = false;
  const reconstruct = (end) => {
    for (let v = end; v !== start;) {
      const edge = pf[v];
      if (edge < 0) throw new Error("Unvollständige Vorgängerkette.");
      path.push(edge);
      v = graph.arcs[edge].from;
    }
    path.reverse();
  };
  if (start === target) {
    trace(start, -1);
    found = true;
  } else if (algorithm === "bidirectional") {
    const db = new Float64Array(n).fill(Infinity),
      pb = new Int32Array(n).fill(-1),
      sf = new Uint8Array(n),
      sb = new Uint8Array(n);
    db[target] = 0;
    const f = new Heap(),
      b = new Heap();
    f.push(start, 0);
    b.push(target, 0);
    let best = Infinity,
      meeting = -1;
    const clean = (heap, settled) => {
      while (heap.peek() && settled[heap.peek()[0]]) heap.pop();
    };
    const meet = (v) => {
      if (df[v] + db[v] < best) {
        best = df[v] + db[v];
        meeting = v;
      }
    };
    while (true) {
      clean(f, sf);
      clean(b, sb);
      if (!f.peek() || !b.peek()) break;
      if (f.peek()[1] + b.peek()[1] >= best) break;
      const reverse = b.peek()[1] < f.peek()[1],
        heap = reverse ? b : f,
        settled = reverse ? sb : sf,
        dist = reverse ? db : df,
        pred = reverse ? pb : pf;
      const [v] = heap.pop();
      if (settled[v]) continue;
      settled[v] = 1;
      trace(v, pred[v], reverse ? 1 : 0);
      meet(v);
      for (const edge of reverse ? graph.incoming[v] : graph.outgoing[v]) {
        const arc = graph.arcs[edge],
          w = reverse ? arc.from : arc.to,
          candidate = dist[v] + arc.length;
        if (candidate < dist[w]) {
          dist[w] = candidate;
          pred[w] = edge;
          heap.push(w, candidate);
          meet(w);
        }
      }
    }
    if (meeting >= 0) {
      found = true;
      reconstruct(meeting);
      for (let v = meeting; v !== target;) {
        const edge = pb[v];
        if (edge < 0) throw new Error("Unvollständiger Rückwärtspfad.");
        path.push(edge);
        v = graph.arcs[edge].to;
      }
    }
  } else if (algorithm === "bfs" || algorithm === "dfs") {
    const queue = [start],
      seen = new Uint8Array(n);
    seen[start] = 1;
    let cursor = 0;
    while (algorithm === "bfs" ? cursor < queue.length : queue.length > 0) {
      const v = algorithm === "bfs" ? queue[cursor++] : queue.pop();
      trace(v, pf[v]);
      if (v === target) {
        found = true;
        break;
      }
      for (const edge of graph.outgoing[v]) {
        const a = graph.arcs[edge];
        if (seen[a.to]) continue;
        seen[a.to] = 1;
        pf[a.to] = edge;
        queue.push(a.to);
      }
    }
    if (found) reconstruct(target);
  } else {
    const heap = new Heap(),
      settled = new Uint8Array(n);
    heap.push(start, 0);
    while (heap.peek()) {
      const [v] = heap.pop();
      if (settled[v]) continue;
      settled[v] = 1;
      trace(v, pf[v]);
      if (v === target) {
        found = true;
        break;
      }
      for (const edge of graph.outgoing[v]) {
        const arc = graph.arcs[edge],
          candidate = df[v] + arc.length;
        if (settled[arc.to] || candidate >= df[arc.to]) continue;
        df[arc.to] = candidate;
        pf[arc.to] = edge;
        const h =
          algorithm === "dijkstra"
            ? 0
            : distance(graph.nodes[arc.to], graph.nodes[target]);
        heap.push(arc.to, algorithm === "greedy" ? h : candidate + h);
      }
    }
    if (found) reconstruct(target);
  }
  return {
    algorithm,
    found,
    distance: found
      ? path.reduce((sum, e) => sum + graph.arcs[e].length, 0)
      : Infinity,
    traceNodes: Uint32Array.from(nodes),
    traceEdges: Int32Array.from(edges),
    traceSides: Uint8Array.from(sides),
    path: Uint32Array.from(path),
    milliseconds: performance.now() - begin,
  };
}
