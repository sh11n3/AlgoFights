// Independently written Java 17 references. They compute results without replay hooks.
const header = `import java.util.*;

public final class Algorithmus {
  public record Edge(int from, int to, double weight) {}
  static List<List<Edge>> adjacency(int n, List<Edge> edges, boolean directed) {
    var a = new ArrayList<List<Edge>>();
    for (int i=0; i<n; i++) a.add(new ArrayList<>());
    for (var e : edges) {
      a.get(e.from()).add(e);
      if (!directed) a.get(e.to()).add(new Edge(e.to(), e.from(), e.weight()));
    }
    return a;
  }
`;
const wrap = (code: string) => header + code + "\n}\n";
const dfsBody = `
  static int time;
  static void visit(int u, List<List<Edge>> a, int[] col, int[] pre,
                    int[] beg, int[] end, List<Integer> post) {
    col[u]=1; beg[u]=time++;
    for (var e : a.get(u)) if (col[e.to()]==0) {
      pre[e.to()]=u; visit(e.to(),a,col,pre,beg,end,post);
    }
    col[u]=2; end[u]=time++; post.add(u);
  }
  public static int[][] dfs(int n, List<Edge> edges, boolean directed) {
    var a=adjacency(n,edges,directed);
    int[] col=new int[n],pre=new int[n],beg=new int[n],end=new int[n];
    Arrays.fill(pre,-1); time=0;
    var post=new ArrayList<Integer>();
    for(int u=0;u<n;u++) if(col[u]==0) visit(u,a,col,pre,beg,end,post);
    return new int[][]{col,pre,beg,end};
  }`;
export const JAVA: Record<string, string> = {
  bfs: wrap(`
  public static int[][] bfs(int n, List<Edge> edges, boolean directed, int source) {
    var a=adjacency(n,edges,directed); var q=new ArrayDeque<Integer>();
    int[] dis=new int[n],pre=new int[n]; Arrays.fill(dis,-1); Arrays.fill(pre,-1);
    dis[source]=0; q.add(source);
    while(!q.isEmpty()) {
      int u=q.remove();
      for(var e:a.get(u)) if(dis[e.to()]<0) {
        dis[e.to()]=dis[u]+1; pre[e.to()]=u; q.add(e.to());
      }
    }
    return new int[][]{dis,pre}; // -1: unreachable or no predecessor
  }`),
  dfs: wrap(dfsBody),
  cycle: wrap(`
  static boolean visit(int u,int parent,List<List<Edge>> a,int[] col,boolean directed) {
    col[u]=1;
    for(var e:a.get(u)) {
      int v=e.to(); if(!directed && v==parent) continue;
      if(col[v]==1 || col[v]==0 && visit(v,u,a,col,directed)) return true;
    }
    col[u]=2; return false;
  }
  public static boolean cyclic(int n,List<Edge> edges,boolean directed) {
    var a=adjacency(n,edges,directed); int[] col=new int[n];
    for(int u=0;u<n;u++) if(col[u]==0 && visit(u,-1,a,col,directed)) return true;
    return false;
  }`),
  topology: wrap(`
  static void visit(int u,List<List<Edge>> a,int[] col,List<Integer> post) {
    col[u]=1;
    for(var e:a.get(u)) {
      if(col[e.to()]==1) throw new IllegalArgumentException("Cycle");
      if(col[e.to()]==0) visit(e.to(),a,col,post);
    }
    col[u]=2; post.add(u);
  }
  public static List<Integer> topological(int n,List<Edge> edges) {
    var a=adjacency(n,edges,true); int[] col=new int[n]; var post=new ArrayList<Integer>();
    for(int u=0;u<n;u++) if(col[u]==0) visit(u,a,col,post);
    Collections.reverse(post); return post;
  }`),
  bellman: wrap(`
  public static double[] bellmanFord(int n,List<Edge> edges,int source) {
    double[] d=new double[n]; Arrays.fill(d,Double.POSITIVE_INFINITY); d[source]=0;
    for(int pass=1;pass<n;pass++) {
      boolean changed=false;
      for(var e:edges) if(d[e.from()]+e.weight()<d[e.to()]) {
        d[e.to()]=d[e.from()]+e.weight(); changed=true;
      }
      if(!changed) break;
    }
    boolean[] bad=new boolean[n];
    for(var e:edges) if(d[e.from()]!=Double.POSITIVE_INFINITY && d[e.from()]+e.weight()<d[e.to()]) bad[e.to()]=true;
    for(int pass=0;pass<n;pass++) for(var e:edges) if(bad[e.from()]) bad[e.to()]=true;
    for(int v=0;v<n;v++) if(bad[v]) d[v]=Double.NEGATIVE_INFINITY;
    return d;
  }`),
  dijkstra: wrap(`
  record Entry(int node,double cost) {}
  public static double[] dijkstra(int n,List<Edge> edges,boolean directed,int source) {
    if(edges.stream().anyMatch(e->e.weight()<0)) throw new IllegalArgumentException("Negative edge");
    var a=adjacency(n,edges,directed);
    var q=new PriorityQueue<Entry>(Comparator.comparingDouble(Entry::cost));
    double[] d=new double[n]; Arrays.fill(d,Double.POSITIVE_INFINITY); d[source]=0;
    q.add(new Entry(source,0));
    while(!q.isEmpty()) {
      var x=q.remove(); if(x.cost()!=d[x.node()]) continue;
      for(var e:a.get(x.node())) if(x.cost()+e.weight()<d[e.to()]) {
        d[e.to()]=x.cost()+e.weight(); q.add(new Entry(e.to(),d[e.to()]));
      }
    }
    return d;
  }
  // Java reference uses lazy entries; the animated JS version uses indexed decreaseKey.`),
  floyd: wrap(`
  public static double[][] floydWarshall(int n,List<Edge> edges) {
    double[][] d=new double[n][n];
    for(int u=0;u<n;u++){Arrays.fill(d[u],Double.POSITIVE_INFINITY);d[u][u]=0;}
    for(var e:edges) d[e.from()][e.to()]=Math.min(d[e.from()][e.to()],e.weight());
    for(int z=0;z<n;z++) {
      double[][] next=new double[n][n];
      for(int u=0;u<n;u++) for(int v=0;v<n;v++) next[u][v]=Math.min(d[u][v],d[u][z]+d[z][v]);
      d=next;
    }
    boolean[][] reach=new boolean[n][n];
    for(int u=0;u<n;u++) for(int v=0;v<n;v++) reach[u][v]=d[u][v]<Double.POSITIVE_INFINITY;
    for(int z=0;z<n;z++) if(d[z][z]<0)
      for(int u=0;u<n;u++) for(int v=0;v<n;v++) if(reach[u][z]&&reach[z][v]) d[u][v]=Double.NEGATIVE_INFINITY;
    return d;
  }`),
  union: wrap(`
  public static int[] components(int n,List<Edge> edges) {
    int[] r=new int[n]; for(int v=0;v<n;v++) r[v]=v;
    for(var e:edges) {
      int a=r[e.from()],b=r[e.to()],root=Math.min(a,b);
      if(a!=b) for(int v=0;v<n;v++) if(r[v]==a||r[v]==b) r[v]=root;
    }
    return r;
  }`),
  components: wrap(`
  static void visit(int u,int root,List<List<Edge>> a,int[] rep) {
    rep[u]=root; for(var e:a.get(u)) if(rep[e.to()]<0) visit(e.to(),root,a,rep);
  }
  public static int[] components(int n,List<Edge> edges) {
    var a=adjacency(n,edges,false); int[] rep=new int[n]; Arrays.fill(rep,-1);
    for(int u=0;u<n;u++) if(rep[u]<0) visit(u,u,a,rep);
    return rep;
  }`),
  kosaraju: wrap(`
  static void post(int u,List<List<Edge>> a,boolean[] seen,List<Integer> ord) {
    seen[u]=true; for(var e:a.get(u)) if(!seen[e.to()]) post(e.to(),a,seen,ord);
    ord.add(u);
  }
  static void assign(int u,int root,List<List<Edge>> a,int[] rep) {
    rep[u]=root; for(var e:a.get(u)) if(rep[e.to()]<0) assign(e.to(),root,a,rep);
  }
  public static int[] kosaraju(int n,List<Edge> edges) {
    var reversed=new ArrayList<Edge>(); for(var e:edges) reversed.add(new Edge(e.to(),e.from(),e.weight()));
    var rev=adjacency(n,reversed,true); var a=adjacency(n,edges,true);
    var order=new ArrayList<Integer>(); boolean[] seen=new boolean[n];
    for(int u=0;u<n;u++) if(!seen[u]) post(u,rev,seen,order);
    Collections.reverse(order); int[] rep=new int[n]; Arrays.fill(rep,-1);
    for(int u:order) if(rep[u]<0) assign(u,u,a,rep);
    return rep;
  }`),
  kruskal: wrap(`
  public static List<Edge> kruskal(int n,List<Edge> edges) {
    var sorted=new ArrayList<>(edges); sorted.sort(Comparator.comparingDouble(Edge::weight));
    var tree=new ArrayList<Edge>(); int[] r=new int[n]; for(int v=0;v<n;v++)r[v]=v;
    for(var e:sorted) {
      int a=r[e.from()],b=r[e.to()]; if(a==b)continue;
      tree.add(e); for(int v=0;v<n;v++)if(r[v]==a||r[v]==b)r[v]=Math.min(a,b);
    }
    return tree; // forest if the graph is disconnected
  }`),
  prim: wrap(`
  public static int[] prim(int n,List<Edge> edges,int source) {
    var a=adjacency(n,edges,false); double[] key=new double[n]; Arrays.fill(key,Double.POSITIVE_INFINITY);
    int[] pre=new int[n]; Arrays.fill(pre,-1); boolean[] done=new boolean[n]; key[source]=0;
    for(int count=0;count<n;count++) {
      int u=-1; for(int v=0;v<n;v++)if(!done[v]&&(u<0||key[v]<key[u]))u=v;
      done[u]=true; // an infinite key begins another tree
      for(var e:a.get(u))if(!done[e.to()]&&e.weight()<key[e.to()]){key[e.to()]=e.weight();pre[e.to()]=u;}
    }
    return pre;
  }`),
  trees: wrap(
    dfsBody +
      `
  public static boolean ancestor(int u,int v,int[] beg,int[] end) {
    return beg[u]<beg[v] && end[v]<end[u];
  }
  // pre contains parents. Equal nonnegative parents identify siblings.
  // Node depth: parent depth + 1. Node height: max(child height + 1), leaf height 0.`,
  ),
  paths: wrap(`
  static void walk(int u,int target,List<List<Edge>> a,boolean[] used,List<Integer> path,List<List<Integer>> all) {
    used[u]=true; path.add(u);
    if(u==target) all.add(new ArrayList<>(path));
    else for(var e:a.get(u)) if(!used[e.to()]) walk(e.to(),target,a,used,path,all);
    path.remove(path.size()-1);used[u]=false;
  }
  public static List<List<Integer>> simplePaths(int n,List<Edge> edges,boolean directed,int start,int target) {
    var result=new ArrayList<List<Integer>>();walk(start,target,adjacency(n,edges,directed),new boolean[n],new ArrayList<>(),result);return result;
  }`),
};
const stringWrap = (body: string) =>
  `import java.util.*;\npublic final class Algorithmus {\n${body}\n}\n`;
JAVA.levenshtein = stringWrap(`  public static int distance(String s,String t) {
    int[][] d=new int[s.length()+1][t.length()+1];
    for(int i=0;i<=s.length();i++)d[i][0]=i;
    for(int j=0;j<=t.length();j++)d[0][j]=j;
    for(int i=1;i<=s.length();i++)for(int j=1;j<=t.length();j++)
      d[i][j]=Math.min(d[i-1][j]+1,Math.min(d[i][j-1]+1,d[i-1][j-1]+(s.charAt(i-1)==t.charAt(j-1)?0:1)));
    return d[s.length()][t.length()];
  }
  // Reconstruction follows a predecessor cell that attained the minimum.`);
JAVA["levenshtein-recursive"] =
  stringWrap(`  public static int distance(String s,int i,String t,int j) {
    if(i==0)return j; if(j==0)return i;
    return Math.min(distance(s,i-1,t,j)+1,Math.min(distance(s,i,t,j-1)+1,
      distance(s,i-1,t,j-1)+(s.charAt(i-1)==t.charAt(j-1)?0:1)));
  }`);
JAVA.substring =
  stringWrap(`  public static String commonSubstring(String s,String t) {
    int[][] d=new int[s.length()+1][t.length()+1];int best=0,end=0;
    for(int i=1;i<=s.length();i++)for(int j=1;j<=t.length();j++) {
      d[i][j]=s.charAt(i-1)==t.charAt(j-1)?d[i-1][j-1]+1:0;
      if(d[i][j]>best){best=d[i][j];end=i;}
    }
    return s.substring(end-best,end);
  }`);
JAVA["substring-naive"] =
  stringWrap(`  public static String commonSubstring(String s,String t) {
    for(int len=Math.min(s.length(),t.length());len>0;len--)
      for(int i=0;i+len<=s.length();i++)for(int j=0;j+len<=t.length();j++) {
        int k=0;while(k<len&&s.charAt(i+k)==t.charAt(j+k))k++;
        if(k==len)return s.substring(i,i+len);
      }
    return "";
  }`);
JAVA.subsequence =
  stringWrap(`  public static String commonSubsequence(String s,String t) {
    int[][] d=new int[s.length()+1][t.length()+1];
    for(int i=1;i<=s.length();i++)for(int j=1;j<=t.length();j++)
      d[i][j]=s.charAt(i-1)==t.charAt(j-1)?d[i-1][j-1]+1:Math.max(d[i-1][j],d[i][j-1]);
    var result=new StringBuilder();int i=s.length(),j=t.length();
    while(i>0&&j>0){if(s.charAt(i-1)==t.charAt(j-1)){result.append(s.charAt(--i));j--;}
      else if(d[i-1][j]>=d[i][j-1])i--;else j--;}
    return result.reverse().toString();
  }`);
JAVA["naive-match"] =
  stringWrap(`  public static int search(String pattern,String text) {
    for(int i=0;i+pattern.length()<=text.length();i++) {
      int j=0;while(j<pattern.length()&&text.charAt(i+j)==pattern.charAt(j))j++;
      if(j==pattern.length())return i;
    }
    return -1;
  }`);
JAVA.kmp = stringWrap(`  public static int[] shifts(String p) {
    int[] s=new int[p.length()+1];s[0]=-1;int i=0,j=-1;
    while(i<p.length()){while(j>=0&&p.charAt(i)!=p.charAt(j))j=s[j];i++;j++;s[i]=j;}
    return s;
  }
  public static int search(String p,String t) {
    int[] s=shifts(p);int i=0,j=0;
    while(i<t.length()&&j<p.length()){while(j>=0&&t.charAt(i)!=p.charAt(j))j=s[j];i++;j++;}
    return j==p.length()?i-j:-1;
  }`);
