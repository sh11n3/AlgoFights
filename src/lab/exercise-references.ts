import { wrap } from "./references";

export const EXERCISE_JAVA: Record<string, string> = {
  kahn: wrap(`
  public static List<Integer> order(int n, List<Edge> edges) {
    var adj = adjacency(n, edges, true);
    int[] indeg = new int[n];
    for (var edge : edges) indeg[edge.to()]++;
    var queue = new ArrayDeque<Integer>();
    var order = new ArrayList<Integer>();
    for (int v = 0; v < n; v++) if (indeg[v] == 0) queue.add(v);
    while (!queue.isEmpty()) {
      int u = queue.remove(); order.add(u);
      for (var edge : adj.get(u)) if (--indeg[edge.to()] == 0) queue.add(edge.to());
    }
    if (order.size() != n) throw new IllegalArgumentException("Zyklus im Graphen");
    return order;
  }`),
  "bfs-cycle": wrap(`
  public static boolean hasCycle(int n, List<Edge> edges) {
    var adj = adjacency(n, edges, false);
    boolean[] seen = new boolean[n]; int[] pre = new int[n]; Arrays.fill(pre, -1);
    for (int s = 0; s < n; s++) {
      if (seen[s]) continue;
      var queue = new ArrayDeque<Integer>(); queue.add(s); seen[s] = true;
      while (!queue.isEmpty()) {
        int u = queue.remove();
        for (var edge : adj.get(u)) {
          int v = edge.to();
          if (v == pre[u]) continue;
          if (seen[v]) return true;
          seen[v] = true; pre[v] = u; queue.add(v);
        }
      }
    }
    return false;
  }`),
  "bfs-count": wrap(`
  public static long[] count(int n, List<Edge> edges, boolean directed, int s) {
    var adj = adjacency(n, edges, directed);
    int[] dis = new int[n]; Arrays.fill(dis, -1);
    long[] anz = new long[n]; dis[s] = 0; anz[s] = 1;
    var queue = new ArrayDeque<Integer>(); queue.add(s);
    while (!queue.isEmpty()) {
      int u = queue.remove();
      for (var edge : adj.get(u)) {
        int v = edge.to();
        if (dis[v] == -1) { dis[v] = dis[u] + 1; queue.add(v); }
        if (dis[v] == dis[u] + 1) anz[v] += anz[u];
      }
    }
    return anz;
  }`),
  "bfs-reach": wrap(`
  public static boolean[][] reach(int n, List<Edge> edges, boolean directed) {
    var adj = adjacency(n, edges, directed);
    boolean[][] r = new boolean[n][n];
    for (int s = 0; s < n; s++) {
      var q = new ArrayDeque<Integer>(); q.add(s); r[s][s] = true;
      while (!q.isEmpty()) for (var e : adj.get(q.remove())) {
        if (!r[s][e.to()]) { r[s][e.to()] = true; q.add(e.to()); }
      }
    }
    return r;
  }`),
  "matrix-powers":
    "import java.math.BigInteger;\n" +
    wrap(`
  public record Result(BigInteger[][] power, BigInteger[][] sum, boolean[][] reach) {}
  static BigInteger[][] zeros(int n) {
    var result = new BigInteger[n][n];
    for (var row : result) Arrays.fill(row, BigInteger.ZERO);
    return result;
  }
  public static Result powers(int n, List<Edge> edges, boolean directed, int k) {
    if (k < 1) throw new IllegalArgumentException("k muss mindestens 1 sein");
    var a = zeros(n); var sum = zeros(n);
    for (var edge : edges) {
      a[edge.from()][edge.to()] = BigInteger.ONE;
      if (!directed) a[edge.to()][edge.from()] = BigInteger.ONE;
    }
    for (int u = 0; u < n; u++) sum[u] = a[u].clone();
    var power = a;
    for (int i = 2; i <= k; i++) {
      var next = zeros(n);
      for (int u = 0; u < n; u++) for (int v = 0; v < n; v++) {
        for (int x = 0; x < n; x++) next[u][v] = next[u][v].add(power[u][x].multiply(a[x][v]));
        sum[u][v] = sum[u][v].add(next[u][v]);
      }
      power = next;
    }
    var reach = new boolean[n][n];
    for (int u = 0; u < n; u++) for (int v = 0; v < n; v++) reach[u][v] = u == v || sum[u][v].signum() > 0;
    return new Result(power, sum, reach);
  }`),
  "longest-dag": wrap(`
  public static double[] longest(int n, List<Edge> edges, int s) {
    var adj = adjacency(n, edges, true);
    int[] indeg = new int[n];
    for (var edge : edges) indeg[edge.to()]++;
    var sources = new ArrayDeque<Integer>();
    for (int v = 0; v < n; v++) if (indeg[v] == 0) sources.add(v);
    int removed = 0;
    while (!sources.isEmpty()) {
      removed++;
      for (var edge : adj.get(sources.remove())) if (--indeg[edge.to()] == 0) sources.add(edge.to());
    }
    if (removed != n) throw new IllegalArgumentException("DAG benötigt");
    double[] cost = new double[n]; Arrays.fill(cost, Double.POSITIVE_INFINITY); cost[s] = 0;
    for (int i = 1; i < n; i++) {
      boolean changed = false;
      for (var edge : edges) if (cost[edge.from()] - edge.weight() < cost[edge.to()]) {
        cost[edge.to()] = cost[edge.from()] - edge.weight(); changed = true;
      }
      if (!changed) break;
    }
    for (int i = 0; i < n; i++) cost[i] = -cost[i];
    return cost;
  }`),
  "all-shortest": wrap(`
  static void collect(int u, int target, List<List<Edge>> adj, double[] dis,
                      boolean[] seen, List<Integer> path, List<List<Integer>> output) {
    if (u == target) { output.add(List.copyOf(path)); return; }
    for (var edge : adj.get(u)) {
      int v = edge.to();
      if (seen[v] || dis[u] + edge.weight() != dis[v]) continue;
      seen[v] = true; path.add(v);
      collect(v, target, adj, dis, seen, path, output);
      path.remove(path.size() - 1); seen[v] = false;
    }
  }
  public static List<List<Integer>> shortest(int n, List<Edge> edges, boolean directed, int s, int t) {
    var adj = adjacency(n, edges, directed);
    var arcs = adj.stream().flatMap(List::stream).toList();
    var relevant = new boolean[n]; relevant[t] = true;
    for (int i = 1; i < n; i++) for (var edge : arcs) if (relevant[edge.to()]) relevant[edge.from()] = true;
    double[] dis = new double[n]; Arrays.fill(dis, Double.POSITIVE_INFINITY); dis[s] = 0;
    for (int i = 1; i < n; i++) for (var edge : arcs)
      if (relevant[edge.to()]) dis[edge.to()] = Math.min(dis[edge.to()], dis[edge.from()] + edge.weight());
    for (var edge : arcs) if (relevant[edge.to()] && dis[edge.from()] + edge.weight() < dis[edge.to()])
      throw new IllegalArgumentException("Relevanter negativer Zyklus");
    var output = new ArrayList<List<Integer>>();
    if (Double.isFinite(dis[t])) {
      boolean[] seen = new boolean[n]; seen[s] = true;
      collect(s, t, adj, dis, seen, new ArrayList<>(List.of(s)), output);
    }
    return output;
  }`),
  coloring: wrap(`
  static boolean colorNext(List<List<Edge>> adj, int[] color, int k) {
    int u = -1, best = -1;
    for (int v = 0; v < color.length; v++) if (color[v] < 0) {
      int distinct = (int) adj.get(v).stream().map(e -> color[e.to()]).filter(c -> c >= 0).distinct().count();
      if (distinct > best) { u = v; best = distinct; }
    }
    if (u < 0) return true;
    boolean[] blocked = new boolean[k];
    for (var e : adj.get(u)) if (color[e.to()] >= 0) blocked[color[e.to()]] = true;
    for (int c = 0; c < k; c++) if (!blocked[c]) {
      color[u] = c;
      if (colorNext(adj, color, k)) return true;
      color[u] = -1;
    }
    return false;
  }
  public static Optional<int[]> color(int n, List<Edge> edges, int k) {
    if (edges.stream().anyMatch(e -> e.from() == e.to())) return Optional.empty();
    int[] color = new int[n]; Arrays.fill(color, -1);
    return colorNext(adjacency(n, edges, false), color, k) ? Optional.of(color) : Optional.empty();
  }`),
  hamilton: wrap(`
  static boolean extend(List<List<Edge>> adj, boolean[] used, List<Integer> path, boolean cycle) {
    int u = path.get(path.size() - 1);
    if (path.size() == used.length) {
      if (!cycle) return true;
      int start = path.get(0);
      if (adj.get(u).stream().noneMatch(e -> e.to() == start)) return false;
      path.add(start); return true;
    }
    for (var e : adj.get(u)) if (!used[e.to()]) {
      used[e.to()] = true; path.add(e.to());
      if (extend(adj, used, path, cycle)) return true;
      path.remove(path.size() - 1); used[e.to()] = false;
    }
    return false;
  }
  public static List<Integer> hamilton(int n, List<Edge> edges, boolean directed, boolean cycle) {
    if (cycle && n < (directed ? 2 : 3)) return List.of();
    var adj = adjacency(n, edges, directed);
    for (int s = 0; s < (cycle ? Math.min(n, 1) : n); s++) {
      var path = new ArrayList<Integer>(); path.add(s);
      var used = new boolean[n]; used[s] = true;
      if (extend(adj, used, path, cycle)) return path;
    }
    return List.of();
  }`),
  "spanning-trees": wrap(`
  static long count(List<Edge> edges, int i, int needed, int[] rep) {
    if (needed == 0) return 1;
    if (edges.size() - i < needed) return 0;
    var edge = edges.get(i);
    int a = rep[edge.from()], b = rep[edge.to()];
    long result = count(edges, i + 1, needed, rep);
    if (a != b) {
      var joined = rep.clone();
      for (int v = 0; v < joined.length; v++) if (joined[v] == b) joined[v] = a;
      result += count(edges, i + 1, needed - 1, joined);
    }
    return result;
  }
  public static long spanningTrees(int n, List<Edge> edges) {
    if (n < 1 || n > 8 || edges.size() > 16) throw new IllegalArgumentException("Zu großer Graph");
    int[] rep = new int[n]; for (int v = 0; v < n; v++) rep[v] = v;
    return count(edges, 0, n - 1, rep);
  }`),
  "anchor-match": wrap(`
  public static int search(String pattern, String text, int anchor) {
    int[] p = pattern.codePoints().toArray(), t = text.codePoints().toArray();
    if (p.length == 0) return 0;
    if (anchor < 0) {
      var frequencies = new HashMap<Integer, Integer>();
      for (int c : t) frequencies.merge(c, 1, Integer::sum);
      anchor = 0;
      for (int j = 1; j < p.length; j++)
        if (frequencies.getOrDefault(p[j], 0) < frequencies.getOrDefault(p[anchor], 0)) anchor = j;
    }
    if (anchor >= p.length) throw new IllegalArgumentException("Anker außerhalb des Musters");
    candidate: for (int i = 0; i + p.length <= t.length; i++) {
      if (p[anchor] != t[i + anchor]) continue;
      for (int j = anchor - 1; j >= 0; j--) if (p[j] != t[i + j]) continue candidate;
      for (int j = anchor + 1; j < p.length; j++) if (p[j] != t[i + j]) continue candidate;
      return i;
    }
    return -1;
  }`),
  "edit-metric": wrap(`
  public record Result(int lower, int upper, int rs, int st, int rt) {}
  static int distance(int[] a, int[] b) {
    int[] prev = new int[b.length + 1];
    for (int j = 0; j <= b.length; j++) prev[j] = j;
    for (int i = 1; i <= a.length; i++) {
      int[] row = new int[b.length + 1]; row[0] = i;
      for (int j = 1; j <= b.length; j++)
        row[j] = Math.min(Math.min(prev[j] + 1, row[j-1] + 1), prev[j-1] + (a[i-1] == b[j-1] ? 0 : 1));
      prev = row;
    }
    return prev[b.length];
  }
  public static Result metric(String r, String s, String t) {
    int[] a = r.codePoints().toArray(), b = s.codePoints().toArray(), c = t.codePoints().toArray();
    return new Result(Math.abs(b.length-c.length), Math.max(b.length,c.length), distance(a,b), distance(b,c), distance(a,c));
  }`),
};
