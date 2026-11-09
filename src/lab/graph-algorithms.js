// Standalone implementations: the editor opens precisely one of these functions.
export const bfs = function run(g, api) {
  const n = g.nodes.length,
    col = Array(n).fill(0),
    dis = Array(n).fill(Infinity),
    pre = Array(n).fill(-1),
    q = [];
  const reverse = g.mode === "target";
  const adj = g.nodes.map(() => []);
  g.edges.forEach((e, id) => {
    adj[reverse ? e.to : e.from].push([reverse ? e.from : e.to, id]);
    if (!g.directed)
      adj[reverse ? e.from : e.to].push([reverse ? e.to : e.from, id]);
  });
  const emit = (text, state = {}) =>
    api.emit(text, {
      colors: col,
      queue: q,
      arrays: [
        { name: "col", values: col, kind: "colors" },
        { name: "dis", values: dis },
        { name: "pre", values: pre, kind: "nodes" },
      ],
      transpose: reverse,
      ...state,
    });
  emit(
    "Initialisierung: Alle Knoten sind unentdeckt. ∞ bezeichnet eine unbekannte Distanz.",
  );
  const roots =
    g.mode === "all"
      ? [g.start, ...g.nodes.map((v) => v.id).filter((v) => v !== g.start)]
      : [reverse ? g.target : g.start];
  for (const root of roots) {
    if (col[root]) continue;
    col[root] = 1;
    dis[root] = 0;
    q.push(root);
    emit(`${api.label(root)} wird Wurzel eines Suchbaums.`, { current: root });
    while (q.length) {
      const u = q.shift();
      emit(`${api.label(u)} vorne aus q entnehmen.`, { current: u });
      for (const [v, id] of adj[u]) {
        if (!col[v]) {
          col[v] = 1;
          dis[v] = dis[u] + 1;
          pre[v] = u;
          q.push(v);
          emit(
            `${api.label(v)} entdecken: eine Kante weiter als ${api.label(u)}.`,
            { current: v, edge: id },
          );
        } else
          emit(
            `${api.label(v)} wurde bereits entdeckt; kein zweites Einreihen.`,
            { current: u, edge: id },
          );
      }
      col[u] = 2;
      emit(`${api.label(u)} ist vollständig besucht.`, { current: u });
    }
  }
  return `${col.filter((v) => v === 2).length} Knoten besucht. dis zählt Kanten, nicht Kantengewichte.${reverse ? " Im transponierten Graphen entsprechen die Distanzen Wegen zum gewählten Ziel im ursprünglichen Graphen." : ""}`;
};

export const dfs = function run(g, api) {
  const n = g.nodes.length,
    col = Array(n).fill(0),
    pre = Array(n).fill(-1),
    beg = Array(n).fill(-1),
    end = Array(n).fill(-1),
    stack = [],
    order = [],
    tree = [];
  let time = 0,
    cycle = false;
  const adj = g.nodes.map(() => []),
    reverse = g.mode === "target";
  g.edges.forEach((e, id) => {
    adj[reverse ? e.to : e.from].push([reverse ? e.from : e.to, id]);
    if (!g.directed)
      adj[reverse ? e.from : e.to].push([reverse ? e.to : e.from, id]);
  });
  const emit = (text, state = {}) =>
    api.emit(text, {
      colors: col,
      stack,
      order,
      selected: tree,
      transpose: reverse,
      arrays: [
        { name: "col", values: col, kind: "colors" },
        { name: "pre", values: pre, kind: "nodes" },
        { name: "beg", values: beg },
        { name: "end", values: end },
        { name: "t", values: [time], axis: "position" },
      ],
      ...state,
    });
  emit(
    "Noch keine Entdeckung. Der Zeitzähler läuft über alle Suchbäume hinweg.",
  );
  function visit(u, parentEdge = -1) {
    col[u] = 1;
    beg[u] = time++;
    stack.push(u);
    emit(`${api.label(u)} betreten: Beginnzeit festhalten.`, { current: u });
    for (const [v, id] of adj[u]) {
      if (!g.directed && id === parentEdge) continue;
      if (col[v] === 0) {
        pre[v] = u;
        tree.push(id);
        emit(`Baumkante: ${api.label(v)} ist noch unentdeckt.`, {
          current: u,
          edge: id,
        });
        visit(v, id);
      } else if (col[v] === 1) {
        cycle = true;
        emit(
          `Rückwärtskante zu ${api.label(v)}: Ein Zyklus ist nachgewiesen.`,
          { current: u, edge: id },
        );
      } else
        emit(
          `${beg[u] < beg[v] ? "Vorwärtskante zu einem Nachfahren" : "Querkante außerhalb des aktuellen Nachfahrenbereichs"}: ${api.label(v)} ist bereits abgeschlossen.`,
          { current: u, edge: id },
        );
    }
    stack.pop();
    col[u] = 2;
    end[u] = time++;
    order.push(u);
    emit(
      `${api.label(u)} verlassen: Endzeit festhalten und zum Aufrufer zurückkehren.`,
      { current: u },
    );
  }
  const roots =
    g.mode === "all"
      ? [g.start, ...g.nodes.map((v) => v.id).filter((v) => v !== g.start)]
      : [reverse ? g.target : g.start];
  for (const root of roots) if (!col[root]) visit(root);
  return `${col.filter((v) => v === 2).length} Knoten abgeschlossen. ${cycle ? "Ein Zyklus wurde gefunden." : g.mode === "all" ? "Der gesamte Graph ist zyklenfrei." : "Im untersuchten erreichbaren Teil wurde kein Zyklus gefunden."} Die Abschlussfolge rückwärts liefert bei einem DAG eine topologische Ordnung.`;
};

export const topology = function run(g, api) {
  if (!g.directed)
    throw Error("Topologisches Sortieren benötigt einen gerichteten Graphen.");
  const n = g.nodes.length,
    col = Array(n).fill(0),
    pre = Array(n).fill(-1),
    beg = Array(n).fill(-1),
    end = Array(n).fill(-1),
    ord = [],
    stack = [];
  const adj = g.nodes.map(() => []);
  g.edges.forEach((e, id) => adj[e.from].push([e.to, id]));
  let t = 0,
    cyclic = false;
  const emit = (text, state = {}) =>
    api.emit(text, {
      colors: col,
      stack,
      order: [...ord].reverse(),
      arrays: [
        { name: "col", values: col, kind: "colors" },
        { name: "pre", values: pre, kind: "nodes" },
        { name: "beg", values: beg },
        { name: "end", values: end },
      ],
      ...state,
    });
  emit("Ganzheitliche Tiefensuche: Jede Komponente wird berücksichtigt.");
  function visit(u) {
    col[u] = 1;
    beg[u] = t++;
    stack.push(u);
    emit(`${api.label(u)} entdecken.`, { current: u });
    for (const [v, id] of adj[u]) {
      if (!col[v]) {
        pre[v] = u;
        emit("Baumkante verfolgen.", { current: u, edge: id });
        visit(v);
        if (cyclic) return;
      } else if (col[v] === 1) {
        cyclic = true;
        emit(
          "Rückwärtskante gefunden: Eine topologische Ordnung existiert nicht.",
          { current: u, edge: id },
        );
        return;
      } else
        emit("Bereits abgeschlossener Zielknoten.", { current: u, edge: id });
    }
    stack.pop();
    col[u] = 2;
    end[u] = t++;
    ord.push(u);
    emit(`${api.label(u)} vorne in die Ausgabe setzen.`, { current: u });
  }
  for (let u = 0; u < n; u++)
    if (!col[u]) {
      visit(u);
      if (cyclic)
        return "Zyklischer Graph: keine topologische Sortierung möglich.";
    }
  return `Topologische Ordnung: ${ord.reverse().map(api.label).join(" → ")}. Für jede Kante steht der Start vor dem Ende.`;
};

export const bellman = function run(g, api) {
  const n = g.nodes.length,
    dis = Array(n).fill(Infinity),
    pre = Array(n).fill(-1),
    reverse = g.mode === "target";
  const arcs = [];
  g.edges.forEach((e, id) => {
    arcs.push({
      u: reverse ? e.to : e.from,
      v: reverse ? e.from : e.to,
      w: e.weight,
      id,
    });
    if (!g.directed && e.from !== e.to)
      arcs.push({
        u: reverse ? e.from : e.to,
        v: reverse ? e.to : e.from,
        w: e.weight,
        id,
      });
  });
  const emit = (text, state = {}) =>
    api.emit(text, {
      transpose: reverse,
      arrays: [
        { name: "dis", values: dis },
        { name: "pre", values: pre, kind: "nodes" },
      ],
      ...state,
    });
  const sources =
    g.mode === "all"
      ? g.nodes.map((v) => v.id)
      : [reverse ? g.target : g.start];
  const table = [];
  for (const s of sources) {
    dis.fill(Infinity);
    pre.fill(-1);
    dis[s] = 0;
    emit(`Quelle ${api.label(s)}: Kosten 0, alle anderen ∞.`, { current: s });
    for (let pass = 1; pass < n; pass++) {
      let changed = false;
      for (const { u, v, w, id } of arcs) {
        if (dis[u] + w < dis[v]) {
          dis[v] = dis[u] + w;
          pre[v] = u;
          changed = true;
          emit(`Durchlauf ${pass}: dis(${api.label(v)}) wird ${dis[v]}.`, {
            current: v,
            edge: id,
          });
        } else
          emit(`Durchlauf ${pass}: Diese Kante verbessert keine Schranke.`, {
            current: u,
            edge: id,
          });
      }
      emit(`Ende von Durchlauf ${pass}.`);
      if (!changed) {
        emit(
          "Keine Änderung in diesem Durchlauf: Die endlichen Distanzen sind endgültig.",
        );
        break;
      }
    }
    const bad = new Set();
    for (const { u, v, w, id } of arcs)
      if (dis[u] !== Infinity && dis[u] + w < dis[v]) {
        bad.add(v);
        emit(
          "Nach n−1 Durchläufen noch verbesserbar: ein von der Quelle erreichbarer negativer Zyklus.",
          { current: v, edge: id },
        );
      }
    for (let pass = 0; pass < n; pass++)
      for (const { u, v } of arcs) if (bad.has(u)) bad.add(v);
    for (const v of bad) dis[v] = -Infinity;
    table.push(dis.slice());
    emit(
      bad.size
        ? "−∞ markiert Knoten, deren Wegkosten durch Wiederholen eines erreichbaren negativen Zyklus unbeschränkt sinken."
        : "Kein von dieser Quelle erreichbarer negativer Zyklus.",
      {
        matrices:
          g.mode === "all"
            ? [{ name: "D · berechnete Quellen", values: table }]
            : [],
      },
    );
  }
  return g.mode === "all"
    ? "Alle Quellen bearbeitet. Zeilen von D entsprechen den Quellen, Spalten den Zielen."
    : "Alle Distanzen der gewählten Quelle berechnet. ∞: unerreichbar; −∞: kein endliches Minimum wegen eines relevanten negativen Zyklus.";
};

export const dijkstra = function run(g, api) {
  if (g.edges.some((e) => e.weight < 0))
    throw Error(
      "Dijkstra setzt nichtnegative Kantengewichte voraus. Verwende Bellman–Ford.",
    );
  const n = g.nodes.length,
    reverse = g.mode === "target",
    adj = g.nodes.map(() => []),
    table = [];
  g.edges.forEach((e, id) => {
    adj[reverse ? e.to : e.from].push([reverse ? e.from : e.to, e.weight, id]);
    if (!g.directed && e.from !== e.to)
      adj[reverse ? e.from : e.to].push([
        reverse ? e.to : e.from,
        e.weight,
        id,
      ]);
  });
  for (const root of g.mode === "all"
    ? g.nodes.map((v) => v.id)
    : [reverse ? g.target : g.start]) {
    const dis = Array(n).fill(Infinity),
      pre = Array(n).fill(-1),
      col = Array(n).fill(0),
      heap = [],
      is = Array(n).fill(-1);
    const emit = (text, state = {}) =>
      api.emit(text, {
        colors: col,
        heap,
        transpose: reverse,
        arrays: [
          { name: "dis", values: dis },
          { name: "pre", values: pre, kind: "nodes" },
          { name: "is", values: is },
          {
            name: "ks",
            values: heap.map((entry) => entry[1]),
            axis: "position",
          },
          {
            name: "vs",
            values: heap.map((entry) => entry[0]),
            kind: "nodes",
            axis: "position",
          },
        ],
        ...state,
      });
    const swap = (a, b) => {
      [heap[a], heap[b]] = [heap[b], heap[a]];
      is[heap[a][0]] = a;
      is[heap[b][0]] = b;
    };
    function decrease(v, key) {
      let i = is[v];
      if (i < 0) {
        i = heap.length;
        heap.push([v, key]);
        is[v] = i;
      } else heap[i][1] = key;
      while (i > 0) {
        const p = (i - 1) >> 1;
        if (heap[p][1] <= heap[i][1]) break;
        swap(i, p);
        i = p;
      }
    }
    function pop() {
      const item = heap[0],
        last = heap.pop();
      is[item[0]] = -1;
      if (heap.length) {
        heap[0] = last;
        is[last[0]] = 0;
        let i = 0;
        while (2 * i + 1 < heap.length) {
          let c = 2 * i + 1;
          if (c + 1 < heap.length && heap[c + 1][1] < heap[c][1]) c++;
          if (heap[i][1] <= heap[c][1]) break;
          swap(i, c);
          i = c;
        }
      }
      return item[0];
    }
    dis[root] = 0;
    decrease(root, 0);
    col[root] = 1;
    emit(`Quelle ${api.label(root)} in den indizierten Min-Heap einfügen.`, {
      current: root,
    });
    while (heap.length) {
      const u = pop();
      col[u] = 2;
      emit(
        `${api.label(u)} besitzt die kleinste offene Schranke und wird endgültig.`,
        { current: u },
      );
      for (const [v, w, id] of adj[u]) {
        if (col[v] !== 2 && dis[u] + w < dis[v]) {
          dis[v] = dis[u] + w;
          pre[v] = u;
          col[v] = 1;
          decrease(v, dis[v]);
          emit(`Relaxierung und decreaseKey für ${api.label(v)}.`, {
            current: v,
            edge: id,
          });
        } else
          emit("Keine Verbesserung über diese Kante.", {
            current: u,
            edge: id,
          });
      }
    }
    table.push(dis.slice());
    emit("Quelle vollständig bearbeitet.", {
      matrices:
        g.mode === "all"
          ? [{ name: "D · berechnete Quellen", values: table }]
          : [],
    });
  }
  return "Alle angeforderten Distanzen sind berechnet. is speichert die Heap-Position; −1 bedeutet: nicht im Heap. Jeder offene Knoten hat genau einen Heap-Eintrag.";
};

export const floyd = function run(g, api) {
  const n = g.nodes.length,
    D = g.nodes.map((_, u) => g.nodes.map((_, v) => (u === v ? 0 : Infinity))),
    P = g.nodes.map(() => Array(n).fill(-1));
  for (const e of g.edges) {
    if (e.weight < D[e.from][e.to]) {
      D[e.from][e.to] = e.weight;
      P[e.from][e.to] = e.from;
    }
    if (!g.directed && e.weight < D[e.to][e.from]) {
      D[e.to][e.from] = e.weight;
      P[e.to][e.from] = e.to;
    }
  }
  const emit = (text, state = {}) =>
    api.emit(text, {
      matrices: [
        { name: "D", values: D },
        { name: "P", values: P, kind: "nodes" },
      ],
      ...state,
    });
  emit(
    "D startet mit direkten Kantengewichten und 0 auf der Diagonale; P enthält Vorgänger.",
  );
  for (let z = 0; z < n; z++) {
    const old = D.map((r) => r.slice()),
      oldP = P.map((r) => r.slice());
    emit(`${api.label(z)} wird als weiterer Zwischenknoten zugelassen.`, {
      current: z,
    });
    for (let u = 0; u < n; u++)
      for (let v = 0; v < n; v++) {
        const via = old[u][z] + old[z][v];
        if (via < D[u][v]) {
          D[u][v] = via;
          P[u][v] = oldP[z][v];
          api.emit(
            `Über ${api.label(z)} wird ${api.label(u)} → ${api.label(v)} günstiger: ${via}.`,
            {
              current: z,
              matrices: [
                {
                  name: "D",
                  values: D,
                  active: [u, v],
                  sources: [
                    [u, z],
                    [z, v],
                  ],
                },
                { name: "P", values: P, active: [u, v], kind: "nodes" },
                { name: "D vorher", values: old },
                { name: "P vorher", values: oldP, kind: "nodes" },
              ],
            },
          );
        }
      }
  }
  const negative = g.nodes.filter((v) => D[v.id][v.id] < 0).map((v) => v.id),
    reachable = D.map((row) => row.map((v) => v < Infinity));
  for (const z of negative)
    for (let u = 0; u < n; u++)
      for (let v = 0; v < n; v++)
        if (reachable[u][z] && reachable[z][v]) {
          D[u][v] = -Infinity;
          P[u][v] = -1;
        }
  emit(
    negative.length
      ? "Negative Diagonale nachgewiesen. Betroffene Quell-Ziel-Paare erhalten −∞."
      : "Alle Zwischenknoten verarbeitet. D enthält die kürzesten Pfadgewichte.",
  );
  return negative.length
    ? "Negative Zyklen gefunden. Nur Paare mit Zugang zum Zyklus und anschließendem Weg zum Ziel sind unbeschränkt."
    : "Alle Paare berechnet. P[u][v] ist der Vorgänger von v auf einem kürzesten Weg ab u.";
};

export const union = function run(g, api) {
  const r = g.nodes.map((v) => v.id),
    selected = [];
  const emit = (text, state = {}) =>
    api.emit(text, {
      groups: r,
      selected,
      arrays: [{ name: "r", values: r, kind: "nodes" }],
      ...state,
    });
  emit(
    "make: Jeder Knoten startet als eigene Menge und repräsentiert sich selbst.",
  );
  for (let id = 0; id < g.edges.length; id++) {
    const { from: u, to: v } = g.edges[id],
      a = r[u],
      b = r[v];
    emit(
      `find(${api.label(u)}) = ${api.label(a)}, find(${api.label(v)}) = ${api.label(b)}. Richtungen werden für schwachen Zusammenhang ignoriert.`,
      { edge: id, current: u },
    );
    if (a !== b) {
      const rep = Math.min(a, b);
      for (let i = 0; i < r.length; i++)
        if (r[i] === a || r[i] === b) r[i] = rep;
      selected.push(id);
      emit(`union: Beide Mengen erhalten Repräsentant ${api.label(rep)}.`, {
        edge: id,
        current: v,
      });
    } else emit("Beide Enden gehören schon zur gleichen Menge.", { edge: id });
  }
  return `${new Set(r).size} schwache Zusammenhangskomponenten. Gleiche Werte in r bedeuten gleiche Mengen. Diese bewusst einfache Variante speichert Repräsentanten direkt.`;
};

export const components = function run(g, api) {
  const n = g.nodes.length,
    rep = Array(n).fill(-1),
    col = Array(n).fill(0),
    stack = [],
    selected = [];
  const adj = g.nodes.map(() => []);
  g.edges.forEach((e, id) => {
    adj[e.from].push([e.to, id]);
    adj[e.to].push([e.from, id]);
  });
  const emit = (text, state = {}) =>
    api.emit(text, {
      groups: rep,
      colors: col,
      stack,
      selected,
      arrays: [
        { name: "rep", values: rep, kind: "nodes" },
        { name: "col", values: col, kind: "colors" },
      ],
      ...state,
    });
  emit("Ganzheitliche DFS auf der ungerichteten Sicht des Graphen.");
  let count = 0;
  function visit(u, root) {
    rep[u] = root;
    col[u] = 1;
    stack.push(u);
    emit(
      `${api.label(u)} gehört zur Komponente mit Wurzel ${api.label(root)}.`,
      { current: u },
    );
    for (const [v, id] of adj[u])
      if (!col[v]) {
        selected.push(id);
        emit("Neue Baumkante innerhalb dieser Komponente.", {
          current: u,
          edge: id,
        });
        visit(v, root);
      }
    stack.pop();
    col[u] = 2;
    emit("Knoten abgeschlossen.", { current: u });
  }
  for (let u = 0; u < n; u++)
    if (!col[u]) {
      count++;
      visit(u, u);
    }
  return `${count} schwache Komponenten; jeder DFS-Baum beschreibt eine Komponente.`;
};

export const kosaraju = function run(g, api) {
  if (!g.directed)
    throw Error(
      "Kosaraju wird hier auf gerichteten Graphen demonstriert. Für ungerichtete Graphen wähle Komponenten-DFS.",
    );
  const n = g.nodes.length,
    col = Array(n).fill(0),
    beg = Array(n).fill(-1),
    end = Array(n).fill(-1),
    rep = Array(n).fill(-1),
    ord = [],
    stack = [];
  const adj = g.nodes.map(() => []),
    rev = g.nodes.map(() => []);
  g.edges.forEach((e, id) => {
    adj[e.from].push([e.to, id]);
    rev[e.to].push([e.from, id]);
  });
  let t = 0,
    phase = 1;
  const emit = (text, state = {}) =>
    api.emit(text, {
      colors: col,
      groups: rep,
      stack,
      order: ord,
      transpose: phase === 1,
      arrays: [
        { name: "beg", values: beg },
        { name: "end", values: end },
        { name: "rep", values: rep, kind: "nodes" },
      ],
      ...state,
    });
  emit("Phase 1: Alle Kanten umdrehen und eine vollständige DFS durchführen.");
  function visit(u, root) {
    col[u] = 1;
    beg[u] = t++;
    stack.push(u);
    if (phase === 2) rep[u] = root;
    emit(`Phase ${phase}: ${api.label(u)} betreten.`, { current: u });
    for (const [v, id] of (phase === 1 ? rev : adj)[u])
      if (!col[v]) {
        emit("Unentdeckten Nachbarn verfolgen.", { current: u, edge: id });
        visit(v, root);
      }
    stack.pop();
    col[u] = 2;
    end[u] = t++;
    if (phase === 1) ord.push(u);
    emit(`Phase ${phase}: ${api.label(u)} abschließen.`, { current: u });
  }
  for (let u = 0; u < n; u++) if (!col[u]) visit(u, u);
  ord.reverse();
  phase = 2;
  col.fill(0);
  beg.fill(-1);
  end.fill(-1);
  t = 0;
  emit(
    "Phase 2: Ursprüngliche Richtungen; Startreihenfolge ord aus absteigenden Endzeiten der ersten DFS.",
  );
  let count = 0;
  for (const root of ord)
    if (!col[root]) {
      count++;
      visit(root, root);
    }
  return `${count} starke Zusammenhangskomponenten. Gleiche rep-Werte kennzeichnen gegenseitig erreichbare Knoten.`;
};

export const kruskal = function run(g, api) {
  if (g.directed) throw Error("Kruskal benötigt einen ungerichteten Graphen.");
  const r = g.nodes.map((v) => v.id),
    selected = [],
    rejected = [],
    tu = [],
    tv = [];
  const order = g.edges
    .map((_, id) => id)
    .sort((a, b) => g.edges[a].weight - g.edges[b].weight || a - b);
  const gu = order.map((id) => g.edges[id].from);
  const gv = order.map((id) => g.edges[id].to);
  const gw = order.map((id) => g.edges[id].weight);
  let weight = 0;
  const emit = (text, state = {}) =>
    api.emit(text, {
      groups: r,
      selected,
      rejected,
      arrays: [
        { name: "gu", values: gu, kind: "nodes", axis: "position" },
        { name: "gv", values: gv, kind: "nodes", axis: "position" },
        { name: "gw", values: gw, axis: "position" },
        { name: "r", values: r, kind: "nodes" },
        { name: "tu", values: tu, kind: "nodes", axis: "position" },
        { name: "tv", values: tv, kind: "nodes", axis: "position" },
      ],
      ...state,
    });
  emit("Kanten nach Gewicht ordnen. Der Wald ist zunächst leer.");
  for (const id of order) {
    const { from: u, to: v, weight: w } = g.edges[id],
      a = r[u],
      b = r[v];
    if (a === b) {
      rejected.push(id);
      emit("Verwerfen: Diese Kante würde einen Zyklus schließen.", {
        edge: id,
      });
    } else {
      selected.push(id);
      tu.push(u);
      tv.push(v);
      weight += w;
      const root = Math.min(a, b);
      for (let i = 0; i < r.length; i++)
        if (r[i] === a || r[i] === b) r[i] = root;
      emit(`Kante aufnehmen: Das Waldgewicht beträgt jetzt ${weight}.`, {
        edge: id,
        current: v,
      });
    }
  }
  return `${new Set(r).size === 1 ? "Minimaler Spannbaum" : "Minimaler Spannwald für einen nicht zusammenhängenden Graphen"}: ${selected.length} Kanten, Gesamtgewicht ${weight}.`;
};

export const prim = function run(g, api) {
  if (g.directed) throw Error("Prim benötigt einen ungerichteten Graphen.");
  const n = g.nodes.length,
    dis = Array(n).fill(Infinity),
    pre = Array(n).fill(-1),
    col = Array(n).fill(0),
    best = Array(n).fill(-1),
    selected = [],
    tu = [],
    tv = [],
    heap = [],
    is = Array(n).fill(-1),
    adj = g.nodes.map(() => []);
  let weight = 0,
    trees = 0;
  g.edges.forEach((e, id) => {
    adj[e.from].push([e.to, e.weight, id]);
    adj[e.to].push([e.from, e.weight, id]);
  });
  function swap(i, j) {
    [heap[i], heap[j]] = [heap[j], heap[i]];
    is[heap[i]] = i;
    is[heap[j]] = j;
  }
  function before(a, b) {
    return dis[a] < dis[b] || (dis[a] === dis[b] && a < b);
  }
  function decrease(v, priority) {
    dis[v] = priority;
    let i = is[v];
    if (i < 0) {
      i = heap.length;
      heap.push(v);
      is[v] = i;
    }
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (!before(heap[i], heap[parent])) break;
      swap(i, parent);
      i = parent;
    }
  }
  function extractMin() {
    const u = heap[0],
      last = heap.pop();
    is[u] = -1;
    if (heap.length) {
      heap[0] = last;
      is[last] = 0;
      for (let i = 0; 2 * i + 1 < heap.length;) {
        let child = 2 * i + 1;
        if (child + 1 < heap.length && before(heap[child + 1], heap[child]))
          child++;
        if (!before(heap[child], heap[i])) break;
        swap(i, child);
        i = child;
      }
    }
    return u;
  }
  const emit = (text, state = {}) =>
    api.emit(text, {
      colors: col,
      selected,
      heap: heap.map((v) => [v, dis[v]]),
      arrays: [
        { name: "dis", values: dis },
        { name: "pre", values: pre, kind: "nodes" },
        { name: "tu", values: tu, kind: "nodes", axis: "position" },
        { name: "tv", values: tv, kind: "nodes", axis: "position" },
      ],
      ...state,
    });
  emit(
    "dis beschreibt die günstigste Anschlusskante. Der Spannwald und der Min-Heap starten leer.",
  );
  for (const root of [
    g.start,
    ...g.nodes.map((v) => v.id).filter((v) => v !== g.start),
  ]) {
    if (col[root] === 2) continue;
    trees++;
    decrease(root, 0);
    col[root] = 1;
    emit("Neuen Baum beginnen.", { current: root });
    while (heap.length) {
      const u = extractMin();
      col[u] = 2;
      if (best[u] >= 0) {
        selected.push(best[u]);
        tu.push(pre[u]);
        tv.push(u);
        weight += dis[u];
      }
      emit(`${api.label(u)} aus der Heap-Wurzel entnehmen und aufnehmen.`, {
        current: u,
        ...(best[u] >= 0 ? { edge: best[u] } : {}),
      });
      for (const [v, w, id] of adj[u])
        if (col[v] !== 2 && w < dis[v]) {
          decrease(v, w);
          pre[v] = u;
          best[v] = id;
          col[v] = 1;
          emit(`Bessere Anschlusskante für ${api.label(v)}.`, {
            edge: id,
            current: v,
          });
        }
      emit(`Durchlauf für ${api.label(u)} abgeschlossen.`, { current: u });
    }
  }
  return `${trees === 1 ? "Minimaler Spannbaum" : "Minimaler Spannwald"}: ${selected.length} Kanten, Gesamtgewicht ${weight}.`;
};

export const trees = function run(g, api) {
  const n = g.nodes.length,
    adj = g.nodes.map(() => []),
    parent = Array(n).fill(-1),
    depth = Array(n).fill(-1),
    height = Array(n).fill(0),
    beg = Array(n).fill(-1),
    end = Array(n).fill(-1),
    col = Array(n).fill(0),
    stack = [],
    preorder = [],
    postorder = [],
    selected = [];
  let time = 0,
    cyclic = false,
    count = 0;
  g.edges.forEach((e, id) => {
    adj[e.from].push([e.to, id]);
    if (!g.directed) adj[e.to].push([e.from, id]);
  });
  if (g.directed) {
    const deg = Array(n).fill(0);
    g.edges.forEach((e) => deg[e.to]++);
    if (deg.some((d) => d > 1))
      throw Error(
        "Kein gerichteter Wurzelwald: Ein Knoten hat mehr als einen Elternknoten.",
      );
  }
  const emit = (text, state = {}) =>
    api.emit(text, {
      colors: col,
      selected,
      stack,
      order: preorder,
      arrays: [
        { name: "pre", values: parent, kind: "nodes" },
        { name: "Tiefe", values: depth },
        { name: "Höhe", values: height },
        { name: "beg", values: beg },
        { name: "end", values: end },
        { name: "Postorder", values: postorder, kind: "nodes" },
      ],
      ...state,
    });
  emit(
    "Wurzeln, Ebenen und Beziehungen anhand einer vollständigen Baumtraversierung untersuchen.",
  );
  function visit(u, edge = -1) {
    col[u] = 1;
    beg[u] = time++;
    preorder.push(u);
    stack.push(u);
    emit("Knoten betreten: Preorder und Beginnzeit.", { current: u });
    for (const [v, id] of adj[u]) {
      if (id === edge && !g.directed) continue;
      if (col[v]) {
        cyclic = true;
        emit("Zusätzliche Kante entdeckt: kein Baum beziehungsweise Wald.", {
          current: u,
          edge: id,
        });
        continue;
      }
      parent[v] = u;
      depth[v] = depth[u] + 1;
      selected.push(id);
      visit(v, id);
      height[u] = Math.max(height[u], height[v] + 1);
    }
    stack.pop();
    col[u] = 2;
    end[u] = time++;
    postorder.push(u);
    emit(`Knoten verlassen: Höhe ${height[u]}, Tiefe ${depth[u]}.`, {
      current: u,
    });
  }
  const roots = g.directed
    ? g.nodes
        .filter((v) => !g.edges.some((e) => e.to === v.id))
        .map((v) => v.id)
    : [g.start];
  for (const root of [...roots, ...g.nodes.map((v) => v.id)])
    if (!col[root]) {
      count++;
      depth[root] = 0;
      visit(root);
    }
  return cyclic
    ? "Die Eingabe ist kein Wald. Die dargestellten Elternwerte beschreiben nur den entstandenen Suchwald."
    : `${count === 1 ? "Baum" : "Wald mit " + count + " Bäumen"}. Höhe eines Knotens: längster Abstieg in Kanten; Baumhöhe hier als Ebenenzahl: Wurzelhöhe + 1. Vorfahren erkennt man an beg(u) < beg(v) < end(v) < end(u).`;
};

export const paths = function run(g, api) {
  const n = g.nodes.length,
    adj = g.nodes.map(() => []),
    path = [g.start],
    selected = [],
    col = Array(n).fill(0);
  let found = 0;
  g.edges.forEach((e, id) => {
    adj[e.from].push([e.to, id]);
    if (!g.directed && e.from !== e.to) adj[e.to].push([e.from, id]);
  });
  const emit = (text, state = {}) =>
    api.emit(text, {
      colors: col,
      selected,
      stack: path,
      arrays: [{ name: "p", values: path, kind: "nodes" }],
      ...state,
    });
  emit(
    "Einfache Pfade untersuchen: Kein Knoten darf innerhalb des Pfades doppelt vorkommen.",
  );
  function visit(u, weight) {
    col[u] = 1;
    emit(
      `Aktueller Pfad: ${path.map(api.label).join(" → ")}; k=${selected.length}, w(p)=${weight}.`,
      { current: u },
    );
    if (u === g.target) {
      found++;
      emit("Ein einfacher Start-Ziel-Pfad wurde gefunden.", { current: u });
    } else
      for (const [v, id] of adj[u]) {
        if (col[v]) continue;
        path.push(v);
        selected.push(id);
        visit(v, weight + g.edges[id].weight);
        selected.pop();
        path.pop();
      }
    col[u] = 0;
  }
  visit(g.start, 0);
  return `${found} einfache Pfade gefunden. Diese Aufzählung kann exponentiell wachsen; das Schrittlimit begrenzt die Vorführung. Zyklen und Zyklenfreiheit untersucht die vollständige DFS.`;
};
