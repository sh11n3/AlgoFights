import type { RouteAlgorithm } from "../routing/types";

const priority = {
  dijkstra: ["candidate", "neueKosten"],
  astar: [
    "candidate + g.heuristic().applyAsDouble(next)",
    "neueKosten + h(nachbar)",
  ],
  greedy: ["g.heuristic().applyAsDouble(next)", "h(nachbar)"],
};

const queueSearch = (depthFirst: boolean) => `
    var pending = new ArrayDeque<Integer>();
    var seen = new boolean[g.outgoing().size()];
    var previous = new int[seen.length];
    pending.addLast(g.start());
    seen[g.start()] = true;

    while (!pending.isEmpty()) {
      int node = pending.${depthFirst ? "removeLast" : "removeFirst"}();
      if (node == g.target()) return path(g, previous, node);
      for (int edge : g.outgoing().get(node)) {
        int next = g.arcs().get(edge).to();
        if (seen[next]) continue;
        seen[next] = true;
        previous[next] = edge;
        pending.addLast(next);
      }
    }
    return null;`;

const prioritySearch = (formula: string) => `
    int count = g.outgoing().size();
    var distance = new double[count];
    Arrays.fill(distance, Double.POSITIVE_INFINITY);
    var previous = new int[count];
    var closed = new boolean[count];
    var pending = queue();
    distance[g.start()] = 0;
    pending.add(new Entry(g.start(), 0));

    while (!pending.isEmpty()) {
      int node = pending.remove().node();
      if (closed[node]) continue;
      closed[node] = true;
      if (node == g.target()) return path(g, previous, node);
      for (int edge : g.outgoing().get(node)) {
        var arc = g.arcs().get(edge);
        int next = arc.to();
        double candidate = distance[node] + arc.cost();
        if (closed[next] || candidate >= distance[next]) continue;
        distance[next] = candidate;
        previous[next] = edge;
        pending.add(new Entry(next, ${formula}));
      }
    }
    return null;`;

const bidirectional = `
    if (g.start() == g.target()) return List.of();
    int count = g.outgoing().size();
    var distance = new double[2][count];
    var previous = new int[2][count];
    var closed = new boolean[2][count];
    var queues = List.of(queue(), queue());
    for (var side : distance) Arrays.fill(side, Double.POSITIVE_INFINITY);
    distance[0][g.start()] = distance[1][g.target()] = 0;
    queues.get(0).add(new Entry(g.start(), 0));
    queues.get(1).add(new Entry(g.target(), 0));
    double best = Double.POSITIVE_INFINITY;
    int meeting = -1;

    while (true) {
      for (int side = 0; side < 2; side++) {
        var queue = queues.get(side);
        while (!queue.isEmpty() && closed[side][queue.peek().node()]) queue.remove();
      }
      if (queues.get(0).isEmpty() || queues.get(1).isEmpty()) break;
      double forward = queues.get(0).peek().priority();
      double backward = queues.get(1).peek().priority();
      if (forward + backward >= best) break;
      int side = backward < forward ? 1 : 0;
      var queue = queues.get(side);
      int node = queue.remove().node();
      closed[side][node] = true;
      var edges = (side == 0 ? g.outgoing() : g.incoming()).get(node);
      for (int edge : edges) {
        var arc = g.arcs().get(edge);
        int next = side == 0 ? arc.to() : arc.from();
        double candidate = distance[side][node] + arc.cost();
        if (candidate >= distance[side][next]) continue;
        distance[side][next] = candidate;
        previous[side][next] = edge;
        queue.add(new Entry(next, candidate));
        double combined = distance[0][next] + distance[1][next];
        if (combined < best) { best = combined; meeting = next; }
      }
    }
    if (meeting == -1) return null;
    var result = path(g, previous[0], meeting);
    for (int node = meeting; node != g.target();) {
      int edge = previous[1][node];
      result.add(edge);
      node = g.arcs().get(edge).to();
    }
    return result;`;

function queuePseudo(depthFirst: boolean) {
  return `offen ← [start] (${depthFirst ? "Stapel, LIFO" : "Warteschlange, FIFO"})
gesehen ← {start}

SOLANGE offen nicht leer ist
    knoten ← ${depthFirst ? "letzten" : "ersten"} Eintrag entfernen
    WENN knoten = ziel: GIB Weg über die Vorgängerkanten ZURÜCK
    FÜR JEDE ausgehende Kante von knoten zu nachbar
        WENN nachbar nicht in gesehen ist
            merke nachbar als gesehen und speichere seine Vorgängerkante
            füge nachbar hinten in offen ein

GIB »kein Weg« ZURÜCK`;
}

function priorityPseudo(formula: string) {
  return `kosten[start] ← 0; alle anderen Kosten ← ∞
offen ← Min-Prioritätswarteschlange mit (start, 0)
abgeschlossen ← ∅

SOLANGE offen nicht leer ist
    knoten ← Eintrag mit kleinster Priorität entfernen
    WENN knoten abgeschlossen ist: ÜBERSPRINGE ihn
    markiere knoten als abgeschlossen
    WENN knoten = ziel: GIB Weg über die Vorgängerkanten ZURÜCK
    FÜR JEDE ausgehende Kante von knoten zu nachbar
        neueKosten ← kosten[knoten] + Kosten der Kante
        WENN nachbar nicht abgeschlossen ist UND neueKosten < kosten[nachbar]
            aktualisiere kosten[nachbar] und seine Vorgängerkante
            füge nachbar mit Priorität ${formula} ein

GIB »kein Weg« ZURÜCK`;
}

export function routeReference(id: RouteAlgorithm) {
  const breadth = id === "bfs" || id === "dfs";
  const both = id === "bidirectional";
  const body = breadth
    ? queueSearch(id === "dfs")
    : both
      ? bidirectional
      : prioritySearch(priority[id][0]);
  const pseudocode = breadth
    ? queuePseudo(id === "dfs")
    : both
      ? `
WENN start = ziel: GIB leeren Weg ZURÜCK
Starte zwei Dijkstra-Suchen: vorwärts bei start, rückwärts bei ziel
best ← ∞; treffpunkt ← keiner

SOLANGE beide Warteschlangen offene Knoten enthalten
    entferne bereits abgeschlossene Einträge an beiden Spitzen
    WENN eine Warteschlange leer ist: BEENDE die Schleife
    WENN kleinste offene Kosten beider Suchen zusammen ≥ best: BEENDE die Schleife
    entnimm den billigsten offenen Knoten beider Seiten
    markiere ihn für diese Seite als abgeschlossen
    verbessere Nachbarn über ausgehende Kanten (vorwärts)
        oder eingehende Kanten (rückwärts)
    FÜR JEDE Verbesserung an nachbar
        summe ← Kosten vom Start zu nachbar + Kosten von nachbar zum Ziel
        WENN summe < best: setze best und treffpunkt auf summe und nachbar

WENN kein treffpunkt existiert: GIB »kein Weg« ZURÜCK
GIB den Weg über die Vorgängerkanten beider Seiten ZURÜCK`.trim()
      : priorityPseudo(priority[id][1]);

  return {
    pseudocode,
    java: `import java.util.*;
import java.util.function.IntToDoubleFunction;

class RouteSearch {
  record Arc(int from, int to, double cost) {}
  // Die Listen outgoing und incoming enthalten Kanten-IDs pro Knoten.
  record Graph(int start, int target, List<Arc> arcs, List<List<Integer>> outgoing,
               List<List<Integer>> incoming, IntToDoubleFunction heuristic) {}

  // Kanten-IDs in Wegreihenfolge oder null, wenn kein Weg existiert.
  static List<Integer> findRoute(Graph g) {${body}
  }
${
  breadth
    ? ""
    : `
  record Entry(int node, double priority) {}

  static PriorityQueue<Entry> queue() {
    return new PriorityQueue<>(Comparator.comparingDouble(Entry::priority)
        .thenComparingInt(Entry::node));
  }
`
}
  static List<Integer> path(Graph g, int[] previous, int node) {
    var path = new ArrayList<Integer>();
    while (node != g.start()) {
      int edge = previous[node];
      path.add(edge);
      node = g.arcs().get(edge).from();
    }
    Collections.reverse(path);
    return path;
  }
}`,
  };
}
