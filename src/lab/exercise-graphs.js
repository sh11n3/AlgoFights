export const kahn = function run(g, api) {
  if (!g.directed)
    throw Error("Quellenentfernung benötigt einen gerichteten Graphen.");
  const adj = g.nodes.map(() => []),
    indeg = g.nodes.map(() => 0);
  const col = g.nodes.map(() => 0),
    q = [],
    order = [],
    removed = [];
  g.edges.forEach(({ from, to }, id) => {
    adj[from].push([to, id]);
    indeg[to]++;
  });
  for (const { id } of g.nodes)
    if (indeg[id] === 0) {
      q.push(id);
      col[id] = 1;
    }
  const emit = (message, state = {}) =>
    api.emit(message, {
      colors: col,
      queue: q,
      order,
      rejected: removed,
      arrays: [{ name: "indeg", values: indeg }],
      ...state,
    });
  emit("Alle Knoten mit Eingangsgrad 0 sind Quellen.");
  for (let head = 0; head < q.length;) {
    const u = q[head];
    order.push(u);
    col[u] = 2;
    // Only the waiting part of the queue belongs in the snapshot.
    const queue = () => q.slice(head);
    head++;
    emit(
      `${api.label(u)} aus dem Restgraphen entfernen und an die Ordnung anhängen.`,
      { current: u, queue: queue() },
    );
    for (const [v, id] of adj[u]) {
      removed.push(id);
      if (--indeg[v] === 0) {
        q.push(v);
        col[v] = 1;
      }
      emit(`Eingangsgrad von ${api.label(v)} sinkt auf ${indeg[v]}.`, {
        edge: id,
        queue: queue(),
      });
    }
  }
  emit(
    order.length === g.nodes.length
      ? "Alle Knoten sind ausgegeben."
      : "Der Restgraph enthält Kanten, aber keine Quelle mehr.",
    { queue: [] },
  );
  return order.length === g.nodes.length
    ? `Topologische Ordnung: ${order.map(api.label).join(" → ")}.`
    : "Der Restgraph enthält einen Zyklus. Es gibt keine topologische Ordnung.";
};

export const bfsCycle = function run(g, api) {
  if (g.directed)
    throw Error("Diese Zyklusprüfung benötigt einen ungerichteten Graphen.");
  const adj = g.nodes.map(() => []),
    col = g.nodes.map(() => 0);
  const pre = g.nodes.map(() => -1),
    parentEdge = pre.slice();
  g.edges.forEach(({ from, to }, id) => {
    adj[from].push([to, id]);
    if (from !== to) adj[to].push([from, id]);
  });
  const emit = (message, queue, state = {}) =>
    api.emit(message, {
      colors: col,
      queue,
      arrays: [
        { name: "col", values: col, kind: "colors" },
        { name: "pre", values: pre, kind: "nodes" },
      ],
      ...state,
    });
  emit(
    "Jede Kante zum Elternknoten gehört zum Suchbaum und zählt nicht als Zyklus.",
    [],
  );
  for (const root of [g.start, ...g.nodes.map(({ id }) => id)]) {
    if (col[root]) continue;
    const q = [root];
    col[root] = 1;
    emit(`Komponente ab ${api.label(root)} durchsuchen.`, q);
    for (let head = 0; head < q.length; head++) {
      const u = q[head];
      for (const [v, id] of adj[u]) {
        if (id === parentEdge[u]) continue;
        if (!col[v]) {
          pre[v] = u;
          parentEdge[v] = id;
          col[v] = 1;
          q.push(v);
          emit(
            `${api.label(v)} über eine Baumkante entdecken.`,
            q.slice(head + 1),
            { current: v, edge: id },
          );
          continue;
        }
        const ancestors = new Set();
        for (let x = u; x >= 0; x = pre[x]) ancestors.add(x);
        const selected = [id];
        let common = v;
        while (!ancestors.has(common)) {
          selected.push(parentEdge[common]);
          common = pre[common];
        }
        for (let x = u; x !== common; x = pre[x]) selected.push(parentEdge[x]);
        emit(
          "Eine zusätzliche Kante verbindet zwei bereits entdeckte Knoten. Sie schließt den markierten Zyklus.",
          q.slice(head + 1),
          { current: u, edge: id, selected },
        );
        return `Ein einfacher Zyklus mit ${selected.length} Kanten wurde gefunden.`;
      }
      col[u] = 2;
      emit(`${api.label(u)} abgeschlossen.`, q.slice(head + 1), { current: u });
    }
  }
  return "Zyklenfrei. In jeder Komponente wurden nur Baumkanten gefunden.";
};

export const bfsCount = function run(g, api) {
  const dis = g.nodes.map(() => Infinity),
    count = g.nodes.map(() => 0);
  const pre = g.nodes.map(() => -1),
    q = [g.start];
  const adj = g.nodes.map(() => []);
  g.edges.forEach(({ from, to }, id) => {
    adj[from].push([to, id]);
    if (!g.directed && from !== to) adj[to].push([from, id]);
  });
  dis[g.start] = 0;
  count[g.start] = 1;
  const emit = (message, queue, state = {}) =>
    api.emit(message, {
      queue,
      arrays: [
        { name: "dis", values: dis },
        { name: "anz", values: count },
        { name: "pre", values: pre, kind: "nodes" },
      ],
      ...state,
    });
  emit(
    "An der Quelle beginnt genau ein leerer Weg. Alle anderen Anzahlen starten bei 0.",
    q,
  );
  for (let head = 0; head < q.length; head++) {
    const u = q[head];
    for (const [v, id] of adj[u]) {
      const fresh = dis[v] === Infinity;
      if (fresh) {
        dis[v] = dis[u] + 1;
        pre[v] = u;
        q.push(v);
      }
      if (dis[v] !== dis[u] + 1) continue;
      count[v] += count[u];
      emit(
        `${fresh ? "Erster kürzester Zugang" : "Weiterer gleich kurzer Zugang"} zu ${api.label(v)}: anz(${api.label(v)}) = ${count[v]}.`,
        q.slice(head + 1),
        { current: v, edge: id },
      );
    }
  }
  emit(
    "Jede Anzahl enthält alle kürzesten Wege ab der Quelle. Unerreichbare Knoten bleiben bei 0.",
    [],
  );
  return `Anzahlen kürzester Wege: ${count.map((value, id) => `${api.label(id)}: ${value}`).join(" · ")}.`;
};

export const bfsReach = function run(g, api) {
  const adj = g.nodes.map(() => []);
  for (const { from, to } of g.edges) {
    adj[from].push(to);
    if (!g.directed && from !== to) adj[to].push(from);
  }
  const R = g.nodes.map(() => g.nodes.map(() => 0));
  api.emit(
    "Für jede Quelle startet eine neue Breitensuche. Jede Suche füllt eine Zeile von R.",
    { matrices: [{ name: "R", values: R }] },
  );
  for (const { id: s } of g.nodes) {
    const q = [s];
    R[s][s] = 1;
    const emit = (message, head, u) =>
      api.emit(message, {
        current: u,
        queue: q.slice(head),
        arrays: [{ name: "erreicht ab " + api.label(s), values: R[s] }],
        matrices: [{ name: "R", values: R, active: [s, u] }],
      });
    emit(`Neue Suche ab ${api.label(s)}.`, 0, s);
    for (let head = 0; head < q.length; head++) {
      const u = q[head];
      for (const v of adj[u])
        if (!R[s][v]) {
          R[s][v] = 1;
          q.push(v);
        }
      if (g.nodes.length <= 12)
        emit(`${api.label(u)} expandiert.`, head + 1, u);
    }
    emit(`Zeile ${api.label(s)} abgeschlossen.`, q.length, s);
  }
  return "R enthält die Erreichbarkeit für jedes geordnete Knotenpaar, einschließlich der Wege der Länge 0 auf der Diagonale.";
};

export const matrixPowers = function run(g, api) {
  const n = g.nodes.length;
  const kMax = g.options?.power ?? Math.max(1, n - 1);
  if (!Number.isInteger(kMax) || kMax < 1 || kMax > 32)
    throw Error("Der Exponent muss zwischen 1 und 32 liegen.");
  const A = g.nodes.map(() => g.nodes.map(() => 0n));
  for (const { from, to } of g.edges) {
    A[from][to] = 1n;
    if (!g.directed) A[to][from] = 1n;
  }
  const text = (matrix) => matrix.map((row) => row.map(String));
  const base = text(A);
  const sum = A.map((row) => row.slice());
  let power = A;
  api.emit(
    "A¹ = A. Ein Eintrag zählt die Kantenfolgen mit genau einer Kante.",
    { matrices: [{ name: "A¹", values: base }] },
  );
  for (let k = 2; k <= kMax; k++) {
    const next = g.nodes.map(() => g.nodes.map(() => 0n));
    for (let u = 0; u < n; u++) {
      for (let v = 0; v < n; v++) {
        for (let x = 0; x < n; x++) next[u][v] += power[u][x] * A[x][v];
        sum[u][v] += next[u][v];
      }
      if (n <= 8)
        api.emit(
          `A^${k}: Zeile ${api.label(u)} aus A^${k - 1} · A berechnen.`,
          {
            current: u,
            matrices: [
              {
                name: `A^${k} · Zwischenstand`,
                values: text(next),
                active: [u, 0],
              },
            ],
          },
        );
    }
    power = next;
    api.emit(
      `A^${k} fertig. Die Einträge zählen Kantenfolgen der Länge ${k}.`,
      {
        matrices: [
          { name: `A^${k}`, values: text(power) },
          { name: "Summe der Potenzen", values: text(sum) },
        ],
      },
    );
  }
  api.emit(
    "Positive Einträge der Summe zeigen Erreichbarkeit innerhalb der untersuchten Längen. Die Diagonale schließt Länge 0 ein.",
    {
      matrices: [
        { name: `A^${kMax}`, values: text(power) },
        { name: "Summe der Potenzen", values: text(sum) },
        {
          name: `R bis Länge ${kMax}`,
          values: sum.map((row, i) =>
            row.map((value, j) => Number(i === j || value > 0n)),
          ),
        },
      ],
    },
  );
  return `A bis A^${kMax} berechnet. Gezählt werden Kantenfolgen, bei denen Knoten mehrfach vorkommen dürfen.`;
};

export const longestDag = function run(g, api) {
  if (!g.directed)
    throw Error("Längste DAG-Pfade benötigen einen gerichteten Graphen.");
  const indeg = g.nodes.map(() => 0),
    adj = g.nodes.map(() => []),
    q = [];
  for (const { from, to } of g.edges) {
    indeg[to]++;
    adj[from].push(to);
  }
  for (const { id } of g.nodes) if (indeg[id] === 0) q.push(id);
  for (let head = 0; head < q.length; head++)
    for (const v of adj[q[head]]) if (--indeg[v] === 0) q.push(v);
  if (q.length !== g.nodes.length)
    throw Error(
      "Der Graph enthält einen Zyklus. Dieses Verfahren setzt einen DAG voraus.",
    );
  const cost = g.nodes.map(() => Infinity),
    pre = g.nodes.map(() => -1);
  const chosen = g.nodes.map(() => -1);
  cost[g.start] = 0;
  const emit = (message, state = {}) =>
    api.emit(message, {
      selected: chosen.filter((id) => id >= 0),
      arrays: [
        { name: "dis mit −w", values: cost },
        {
          name: "max",
          values: cost.map((value) => (value === 0 ? 0 : -value)),
        },
        { name: "pre", values: pre, kind: "nodes" },
      ],
      ...state,
    });
  emit(
    "Der Graph ist azyklisch. Bellman–Ford verwendet die negierten Kantengewichte.",
  );
  for (let pass = 1; pass < g.nodes.length; pass++) {
    let changed = false;
    g.edges.forEach(({ from, to, weight }, id) => {
      const candidate = cost[from] - weight;
      if (candidate >= cost[to]) return;
      cost[to] = candidate;
      pre[to] = from;
      chosen[to] = id;
      changed = true;
      emit(
        `Durchlauf ${pass}: Eine längere Verbindung zu ${api.label(to)} gefunden.`,
        { current: to, edge: id },
      );
    });
    emit(`Ende von Durchlauf ${pass}${changed ? "." : " ohne Änderung."}`);
    if (!changed) break;
  }
  return `Längste Pfadgewichte ab ${api.label(g.start)}: ${cost.map((value, id) => `${api.label(id)}: ${value === Infinity ? "unerreichbar" : -value}`).join(" · ")}.`;
};

export const allShortest = function run(g, api) {
  const n = g.nodes.length,
    dis = g.nodes.map(() => Infinity);
  const { start, target } = g,
    arcs = [],
    q = [];
  const toward = g.nodes.map(() => []);
  g.edges.forEach(({ from, to, weight }, id) => {
    arcs.push([from, to, weight, id]);
    if (!g.directed && from !== to) arcs.push([to, from, weight, id]);
  });
  for (const [u, v] of arcs) toward[v].push(u);
  const reachesTarget = new Set([target]);
  q.push(target);
  for (let head = 0; head < q.length; head++)
    for (const u of toward[q[head]]) {
      if (!reachesTarget.has(u)) {
        reachesTarget.add(u);
        q.push(u);
      }
    }
  dis[start] = 0;
  const emit = (message, state = {}) =>
    api.emit(message, { arrays: [{ name: "dis", values: dis }], ...state });
  emit("Zuerst die kürzesten Distanzen per Relaxierung berechnen.");
  for (let pass = 1; pass < n; pass++) {
    let changed = false;
    for (const [u, v, w, id] of arcs)
      if (dis[u] + w < dis[v]) {
        dis[v] = dis[u] + w;
        changed = true;
        emit(`Distanz zu ${api.label(v)} verbessert.`, {
          current: v,
          edge: id,
        });
      }
    if (!changed) break;
  }
  if (dis[target] === Infinity) return "Das Ziel ist unerreichbar.";
  if (arcs.some(([u, v, w]) => reachesTarget.has(v) && dis[u] + w < dis[v]))
    return "Ein erreichbarer negativer Zyklus kann den Weg zum Ziel verbilligen. Es gibt kein endliches Minimum.";
  const tight = g.nodes.map(() => []);
  for (const [u, v, w, id] of arcs)
    if (
      reachesTarget.has(v) &&
      Number.isFinite(dis[u]) &&
      dis[u] + w === dis[v]
    )
      tight[u].push([v, id]);
  const onPath = new Set([start]),
    path = [start],
    chosen = [];
  let count = 0;
  function visit(u) {
    emit(
      u === target
        ? `Kürzester Pfad ${++count}: ${path.map(api.label).join(" → ")}.`
        : `Optimalen Teilpfad ab ${api.label(u)} erweitern.`,
      { current: u, stack: path, selected: chosen },
    );
    if (u === target) return;
    for (const [v, id] of tight[u])
      if (!onPath.has(v)) {
        onPath.add(v);
        path.push(v);
        chosen.push(id);
        visit(v);
        onPath.delete(v);
        path.pop();
        chosen.pop();
      }
  }
  visit(start);
  return `${count} gleich kurze einfache ${count === 1 ? "Verbindung" : "Verbindungen"}, Gewicht jeweils ${dis[target]}. Jeder Treffer ist im Ablauf markiert.`;
};

export const coloring = function run(g, api) {
  if (g.directed)
    throw Error("Wähle einen ungerichteten Graphen für die Färbung.");
  const k = g.options?.colorCount ?? 3;
  if (!Number.isInteger(k) || k < 1 || k > 8)
    throw Error("Erlaubt sind 1 bis 8 Farben.");
  const adj = g.nodes.map(() => []),
    colors = g.nodes.map(() => -1);
  for (const { from, to } of g.edges) {
    if (from === to) return "Eine Schlinge verhindert eine gültige Färbung.";
    adj[from].push(to);
    adj[to].push(from);
  }
  const emit = (message, current) =>
    api.emit(message, {
      current,
      groups: colors,
      arrays: [
        { name: "farbe", values: colors.map((c) => (c < 0 ? "—" : c + 1)) },
      ],
    });
  emit(`Bis zu ${k} Farben stehen bereit.`);
  function visit(used) {
    let best = -1,
      saturation = -1;
    for (const { id } of g.nodes)
      if (colors[id] < 0) {
        const s = new Set(adj[id].map((v) => colors[v]).filter((c) => c >= 0))
          .size;
        if (
          s > saturation ||
          (s === saturation && adj[id].length > adj[best].length)
        ) {
          best = id;
          saturation = s;
        }
      }
    if (best < 0) return true;
    const unavailable = new Set(adj[best].map((v) => colors[v]));
    emit(`Verfügbare Farben für ${api.label(best)} prüfen.`, best);
    for (let c = 0; c < Math.min(k, used + 1); c++)
      if (!unavailable.has(c)) {
        colors[best] = c;
        emit(`${api.label(best)} erhält Farbe ${c + 1}.`, best);
        if (visit(Math.max(used, c + 1))) return true;
        colors[best] = -1;
        emit(
          "Dieser Versuch lässt sich nicht vervollständigen. Farbe zurücknehmen.",
          best,
        );
      }
    return false;
  }
  return visit(0)
    ? `Gültige Färbung mit ${new Set(colors).size} Farben gefunden.`
    : `Keine gültige Färbung mit höchstens ${k} Farben.`;
};

export const hamilton = function run(g, api) {
  const cycle = g.options?.hamiltonCycle ?? false;
  const n = g.nodes.length,
    adj = g.nodes.map(() => []);
  if (cycle && n < (g.directed ? 2 : 3))
    return "Zu wenige Knoten für einen Hamiltonkreis in diesem Graphen.";
  g.edges.forEach(({ from, to }, id) => {
    if (from === to) return;
    adj[from].push([to, id]);
    if (!g.directed) adj[to].push([from, id]);
  });
  const used = new Set(),
    path = [],
    edges = [];
  const name = cycle ? "Hamiltonkreis" : "Hamiltonpfad";
  api.emit(
    `${name} suchen. Jeder Knoten darf genau einmal im Pfad vorkommen.`,
    {},
  );
  function visit(u) {
    api.emit(`Pfad ab ${api.label(u)} weiter prüfen.`, {
      current: u,
      selected: edges,
      stack: path,
    });
    if (path.length === n) {
      if (!cycle) return true;
      const back = adj[u].find(([v]) => v === path[0]);
      if (!back) return false;
      edges.push(back[1]);
      path.push(path[0]);
      return true;
    }
    for (const [v, id] of adj[u])
      if (!used.has(v)) {
        used.add(v);
        path.push(v);
        edges.push(id);
        if (visit(v)) return true;
        used.delete(v);
        path.pop();
        edges.pop();
      }
    return false;
  }
  const roots = cycle
    ? [g.start]
    : [g.start, ...g.nodes.map(({ id }) => id).filter((id) => id !== g.start)];
  for (const root of roots) {
    path.push(root);
    used.add(root);
    if (visit(root)) {
      api.emit(`${name} gefunden.`, { selected: edges, order: path });
      return `${name}: ${path.map(api.label).join(" → ")}.`;
    }
    path.pop();
    used.delete(root);
  }
  api.emit("Alle zulässigen Erweiterungen geprüft.");
  return `Kein ${name} vorhanden.`;
};

export const spanningTrees = function run(g, api) {
  if (g.directed)
    throw Error("Spannbäume werden hier auf ungerichteten Graphen aufgezählt.");
  const n = g.nodes.length,
    m = g.edges.length;
  if (n > 8 || m > 16)
    throw Error(
      "Aufzählen ist auf 8 Knoten und 16 Kanten begrenzt. Kruskal und Prim können größere Graphen verarbeiten.",
    );
  const r = g.nodes.map(({ id }) => id),
    selected = [];
  let count = 0,
    upper = m < n - 1 ? 0 : 1;
  for (let i = 1; upper && i < n; i++) upper = (upper * (m - i + 1)) / i;
  api.emit(
    `Ein Spannbaum benötigt ${n - 1} Kanten. Es gibt höchstens ${upper} Teilmengen dieser Größe.`,
    { groups: r },
  );
  function visit(i, labels) {
    if (selected.length === n - 1) {
      api.emit(`Spannbaum ${++count}: zyklenfrei und zusammenhängend.`, {
        selected,
      });
      return;
    }
    if (m - i < n - 1 - selected.length) return;
    const { from, to } = g.edges[i];
    const a = labels[from],
      b = labels[to];
    if (a !== b) {
      selected.push(i);
      visit(
        i + 1,
        labels.map((v) => (v === b ? a : v)),
      );
      selected.pop();
    }
    visit(i + 1, labels);
  }
  visit(0, r);
  return `${count} Spannbäume. Die obere Schranke ${upper} zählt auch Teilmengen, die einen Zyklus enthalten oder nicht alle Knoten verbinden.`;
};
