import * as graph from "./graph-algorithms.js";
import * as strings from "./string-algorithms.js";
import { JAVA } from "./references";
import { EXERCISE_LESSONS } from "./exercise-catalog";
import { EXERCISE_JAVA } from "./exercise-references";
import type { Lesson, LessonEntry as Entry } from "./types";

const entries: Entry[] = [
  {
    id: "paths",
    name: "Pfade & Erreichbarkeit",
    category: "Graphgrundlagen",
    run: graph.paths,
    introduction:
      "Ein Pfad ist eine Knotenfolge, deren aufeinanderfolgende Knoten durch passende Kanten verbunden sind. Hier werden einfache Pfade zwischen zwei gewählten Knoten aufgezählt.",
    prerequisites:
      "Gerichtete oder ungerichtete Graphen; beliebige endliche Kantengewichte. Ein einfacher Pfad besucht jeden Knoten höchstens einmal.",
    formulas: [
      "G = (V,E), n = |V|, m = |E|",
      "p = ⟨v₀,…,vₖ⟩; k = Anzahl der Kanten",
      "w(p) = ∑ᵢ₌₁ᵏ w(vᵢ₋₁,vᵢ)",
      "u ↝ v ⇔ es existiert ein Pfad von u nach v",
    ],
    explanation:
      "Die Suche ergänzt eine noch nicht benutzte Nachbarposition und nimmt sie nach der Rückkehr wieder aus dem aktuellen Pfad. Das Zurücknehmen verändert den Eingabegraphen nicht. Ein Zyklus beginnt und endet am selben Knoten; für einfache Zyklen darf außer dem gemeinsamen Anfang und Ende kein Knoten doppelt auftreten. Im ungerichteten Fall darf eine Kante nicht bloß hin- und zurückgelaufen werden. Die Zyklusprüfung übernimmt der entsprechende DFS-Modus.",
    complexity:
      "Das Aufzählen aller einfachen Pfade kann im vollständigen Graphen faktoriell viele Ergebnisse erzeugen. Aktueller Pfad und Rekursionsstack brauchen O(n) Zusatzspeicher. Das Aufzeichnungslimit begrenzt die Vorführung.",
    pseudocode:
      "suche(u):\n  markiere u im aktuellen Pfad\n  falls u = Ziel: gib aktuellen Pfad aus\n  sonst: für jeden unmarkierten Nachbarn v: suche(v)\n  entferne u wieder aus dem aktuellen Pfad",
  },
  {
    id: "bfs",
    name: "Breitensuche · vollständig",
    category: "Traversierung",
    run: graph.bfs,
    introduction:
      "BFS bearbeitet zuerst alle Knoten mit einer kleinen Zahl von Kanten ab der Quelle. Die Warteschlange zeigt die noch ausstehenden Besuche.",
    prerequisites:
      "Die Gewichte werden ignoriert. Kürzeste Distanz bedeutet hier: möglichst wenige Kanten. Im Gesamtgraph-Modus entsteht ein Suchwald.",
    formulas: [
      "col(v) ∈ {0,1,2}: unentdeckt, offen, abgeschlossen",
      "dis(s)=0; dis(v)=∞ für v≠s",
      "dis(v) ← dis(u)+1; pre(v) ← u",
      "q: vorne entnehmen, hinten anfügen",
    ],
    explanation:
      "Ein Knoten wird beim ersten Entdecken eingereiht. Deshalb tritt er nur einmal in die Warteschlange ein. Sein Vorgänger liegt eine Ebene näher an der Wurzel. Nach Prüfung aller Nachbarn ist der Knoten abgeschlossen. Bei Suche zum Ziel werden die Richtungen umgekehrt; die berechneten Distanzen gelten dann zum Ziel im ursprünglichen Graphen.",
    complexity:
      "Mit Adjazenzlisten O(n+m) Zeit und O(n) Zusatzspeicher; die Darstellung des Graphen benötigt zusätzlich O(n+m).",
    pseudocode:
      "dis[*] ← ∞; dis(s) ← 0; q ← ⟨s⟩\nsolange q nicht leer:\n  u ← vorne entnehmen\n  für jeden unentdeckten Nachbarn v:\n    pre(v) ← u; dis(v) ← dis(u)+1; hinten einreihen\n  u abschließen",
  },
  {
    id: "dfs",
    name: "Tiefensuche · Zeitstempel",
    category: "Traversierung",
    run: graph.dfs,
    introduction:
      "Die Tiefensuche behält den aktuellen Aufrufpfad bei und kehrt erst zurück, wenn ein Knoten vollständig bearbeitet ist.",
    prerequisites:
      "Startquelle, Suche zum Ziel oder vollständiger Suchwald. Zeitpunkte zählen Entdeckungen und Abschlüsse, keine Millisekunden.",
    formulas: [
      "beg(v) < end(v)",
      "beg(u)<beg(v)<end(v)<end(u) ⇒ u ist echter Vorfahre von v im Suchbaum",
      "pre(v) = Elternknoten im Suchwald",
    ],
    explanation:
      "Der Stack zeigt offene Aufrufe. Eine Kante zu einem unentdeckten Knoten wird Baumkante. Eine Kante zu einem noch offenen Vorfahren weist einen Zyklus nach. Bei bereits abgeschlossenen Zielen unterscheiden die Entdeckungszeiten Vorwärtskanten zu Nachfahren von Querkanten. Im ungerichteten Graphen wird die Elternkante beim Rückblick ausgelassen.",
    complexity:
      "O(n+m) Zeit und O(n) Zusatzspeicher einschließlich des Aufrufstacks.",
    pseudocode:
      "besuche(u):\n  col(u) ← offen; beg(u) ← t; t++\n  für jede ausgehende Kante (u,v):\n    falls v unentdeckt: pre(v) ← u; besuche(v)\n    sonst: Kante anhand Zustand und Zeitstempeln einordnen\n  col(u) ← abgeschlossen; end(u) ← t; t++",
  },
  {
    id: "cycle",
    name: "Zyklen & Kantenklassen",
    category: "Traversierung",
    run: graph.dfs,
    introduction:
      "Eine vollständige DFS prüft, ob der Graph einen Zyklus enthält, und zeigt die unterschiedlichen Kantenrollen.",
    prerequisites:
      "Es wird der gesamte Graph untersucht. Bei ungerichteten Graphen zählt die direkte Rückkehr über dieselbe Elternkante nicht als Zyklus.",
    formulas: [
      "gerichtet: Rückwärtskante zu einem offenen Knoten ⇒ Zyklus",
      "ungerichtet: Elternkante überspringen",
      "azyklisch ⇔ kein Zyklus vorhanden",
    ],
    explanation:
      "Offene Aufrufe bilden einen Pfad. Eine zusätzliche Kante zu einem Knoten auf diesem Pfad schließt ihn zu einem Zyklus. Ein bereits abgeschlossener Zielknoten allein beweist keinen Zyklus. Das gilt auch bei mehreren Suchbäumen in getrennten Komponenten.",
    complexity:
      "Diese vollständige Implementierung läuft in O(n+m) und benötigt O(n) Zusatzspeicher. Eine früh abbrechende Variante kann schon beim ersten Nachweis stoppen.",
    pseudocode:
      "vollständige DFS durchführen\nfür jede geprüfte Kante:\n  weißes Ziel → Baumkante\n  graues Ziel → Rückwärtskante und Zyklusnachweis\n  schwarzes Ziel → Vorwärts- oder Querkante\nbei ungerichteten Kanten: Elternkante nicht erneut zählen",
  },
  {
    id: "topology",
    name: "Topologisches Sortieren",
    category: "Traversierung",
    run: graph.topology,
    introduction:
      "Eine topologische Ordnung stellt Voraussetzungen vor die davon abhängigen Knoten.",
    prerequisites:
      "Gerichteter azyklischer Graph (DAG). Ein Zyklus führt zu einer verständlichen Ablehnung statt zu einer scheinbar gültigen Ordnung.",
    formulas: [
      "(u,v) ∈ E ⇒ pos(u) < pos(v)",
      "im DAG: end(u) > end(v) für jede Kante (u,v)",
    ],
    explanation:
      "Ein Knoten wird beim Abschließen vorne in die Ausgabe gesetzt. Nach Abschluss der DFS ist die Folge dadurch nach fallenden Endzeiten geordnet. Eine Rückwärtskante würde eine zirkuläre Voraussetzung ausdrücken und verhindert die Sortierung.",
    complexity:
      "O(n+m) Zeit, O(n) Zusatzspeicher. Die Abschlussfolge wird gesammelt und einmal umgekehrt; die Anzeige zeigt sie bereits in der Reihenfolge der entstehenden topologischen Ordnung.",
    pseudocode:
      "für jeden noch weißen Knoten: DFS starten\nbei einer Rückwärtskante: abbrechen, Graph zyklisch\nbeim Abschluss von u: u vor die bisherige Ausgabe setzen",
  },
  {
    id: "dijkstra",
    name: "Dijkstra · Heap & Relaxierung",
    category: "Kürzeste Pfade",
    run: graph.dijkstra,
    introduction:
      "Dijkstra erklärt bei jeder Entnahme die kleinste noch offene Kostenschranke für endgültig.",
    prerequisites:
      "Alle Kantenkosten müssen ≥ 0 sein. Der Lehrmodus verwendet einen indizierten binären Min-Heap mit decreaseKey.",
    formulas: [
      "δ(s,v) = min { w(p) : p führt von s nach v }",
      "dis(u)+w(u,v)<dis(v) ⇒ dis(v)←dis(u)+w(u,v), pre(v)←u",
      "u ← arg min {dis(v): v offen}",
      "is(v) = Position von v im Heap; −1 bei Abwesenheit",
      "ks[i] = Schlüssel, vs[i] = Knoten an Heap-Position i",
    ],
    explanation:
      "Die Heap-Tabelle zeigt den tatsächlichen Arrayaufbau: Eltern stehen vor ihren Kindern und haben keinen größeren Schlüssel. is wird bei jeder Vertauschung angepasst. Da keine negative Kante eine spätere Abkürzung liefern kann, stimmt die kleinste entnommene Schranke mit der optimalen Distanz überein. Mit A→B: 2, A→C: 4 und C→B: −5 würde ein ungeprüfter Dijkstra B mit 2 abschließen, obwohl über C die Kosten −1 erreichbar sind. Die App meldet deshalb negative Kanten vor dem Start. Bellman–Ford kann dieses Beispiel berechnen.",
    complexity:
      "Pro Quelle O((n+m) log n) Zeit und O(n) Zusatzspeicher. Alle Quellen: diesen Aufwand n-mal. Replays und Ergebnismatrizen werden zusätzlich gespeichert. Die Java-Referenz nutzt statt decreaseKey veraltete Einträge, die bei Entnahme übersprungen werden.",
    pseudocode:
      "dis(s)←0; alle anderen dis←∞\nQuelle in Min-Heap\nsolange Heap nicht leer:\n  u ← Minimum entnehmen und abschließen\n  für jede Kante (u,v):\n    falls neue Kosten kleiner und v offen:\n      dis(v) aktualisieren; pre(v)←u; decreaseKey(v)",
  },
  {
    id: "bellman",
    name: "Bellman–Ford",
    category: "Kürzeste Pfade",
    run: graph.bellman,
    introduction:
      "Wiederholtes Relaxieren lässt auch Wege mit negativen Kantenkosten zu.",
    prerequisites:
      "Endliche Kantengewichte. In ungerichteten Graphen wirkt eine negative Kante in beide Richtungen und erzeugt damit einen negativen geschlossenen Weg.",
    formulas: [
      "dis(s)=0; dis(v)=∞ für v≠s",
      "dis(v) ← min(dis(v), dis(u)+w(u,v))",
      "höchstens n−1 vollständige Kantendurchläufe",
      "danach noch relaxierbar und von s erreichbar ⇒ negativer Zyklus",
    ],
    explanation:
      "Ohne relevanten negativen Zyklus reicht ein einfacher kürzester Pfad mit höchstens n−1 Kanten. Jeder volle Durchlauf bringt die korrekten Kosten mindestens eine Kante weiter. Ein zusätzlicher Prüfdurchlauf weist negative Zyklen nach. Nur vom Start erreichbare Zyklen und ihre erreichbaren Folgeknoten erhalten −∞; unerreichbare Bereiche bleiben ∞.",
    complexity:
      "Pro Quelle O(nm+n) Zeit und O(n) Zusatzspeicher. Früher Stopp bei einem Durchlauf ohne Änderung. Alle Quellen: n Einzelläufe.",
    pseudocode:
      "initialisiere dis und pre\nwiederhole höchstens n−1-mal:\n  versuche jede Kante zu relaxieren\n  ohne Änderung: vorzeitig stoppen\nprüfe auf weitere Verbesserungen\nmarkiere vom negativen Zyklus beeinflusste Ziele mit −∞",
  },
  {
    id: "floyd",
    name: "Floyd–Warshall",
    category: "Kürzeste Pfade",
    run: graph.floyd,
    introduction:
      "Eine dynamische Tabelle berechnet kürzeste Wege zwischen allen Knotenpaaren.",
    prerequisites:
      "Beliebige endliche Gewichte. Negative Zyklen werden nach der Berechnung erkannt und betroffene Paare gesondert markiert.",
    formulas: [
      "D⁽⁻¹⁾ = W; Wᵤᵤ=0, fehlende Kante=∞",
      "D⁽ᶻ⁾ᵤᵥ = min(D⁽ᶻ⁻¹⁾ᵤᵥ, D⁽ᶻ⁻¹⁾ᵤᶻ + D⁽ᶻ⁻¹⁾ᶻᵥ)",
      "bei Verbesserung: Pᵤᵥ ← Pᶻᵥ aus dem vorherigen Durchlauf",
      "Dᵥᵥ < 0 ⇒ negativer Zyklus",
    ],
    explanation:
      "Ein optimaler Weg nutzt den neu erlaubten Zwischenknoten z entweder gar nicht oder zerfällt dort in zwei bekannte Teilwege. Die markierte Zelle ist das neue Teilproblem; die beiden Quellenzellen erklären den Kandidaten. D vorher und P vorher bleiben während eines Durchlaufs unverändert. P speichert den Vorgänger des Spaltenknotens auf einem Weg ab dem Zeilenknoten. Dynamische Programmierung löst kleinere Teilprobleme zuerst und verwendet deren gespeicherte Ergebnisse wieder.",
    complexity:
      "O(n³) Zeit, O(n²) Arbeitsspeicher ohne Replay. Um die Animation übersichtlich zu halten, werden Durchlaufwechsel und tatsächliche Verbesserungen aufgezeichnet.",
    pseudocode:
      "D ← Gewichtungsmatrix; P ← direkte Vorgänger\nfür jeden Zwischenknoten z:\n  alte Tabellen sichern\n  für jedes Paar u,v:\n    Kandidat ← D_alt[u,z]+D_alt[z,v]\n    falls günstiger: D[u,v]←Kandidat; P[u,v]←P_alt[z,v]\nnegative Diagonale prüfen; beeinflusste Paare markieren",
  },
  {
    id: "union",
    name: "Union-Find · Komponenten",
    category: "Komponenten",
    run: graph.union,
    introduction:
      "Disjunkte Mengen wachsen durch die betrachteten Verbindungen zusammen.",
    prerequisites:
      "Für schwachen Zusammenhang werden Kantenrichtungen ignoriert. r speichert direkt den kleinsten Knotenindex der jeweiligen Menge.",
    formulas: [
      "make(v): r(v)←v",
      "find(v)=r(v)",
      "union(u,v): alle Einträge beider Mengen auf denselben Repräsentanten setzen",
      "u ∼ v ⇔ u und v sind gegenseitig erreichbar in der ungerichteten Sicht",
    ],
    explanation:
      "Anfangs ist jeder Knoten nur mit sich selbst verbunden. Jede Kante rechtfertigt, die Mengen ihrer beiden Enden zu vereinigen. Erreichbarkeit in ungerichteten Graphen ist reflexiv, symmetrisch und transitiv; ihre Äquivalenzklassen sind die Komponenten. Die einfache Arrayvariante macht jede Änderung sichtbar. Optimiertes Union-Find verwendet Elternbäume, Pfadkompression und Rang-/Größenregeln; dessen Aufwand ist amortisiert O(α(n)), nicht exakt konstant.",
    complexity:
      "Diese Variante: make und find O(1), union O(n); insgesamt O(n+nm), O(n) Zusatzspeicher. Keine Laufzeitangabe einer optimierten Variante auf diesen Code übertragen.",
    pseudocode:
      "r[v] ← v für alle Knoten\nfür jede Kante {u,v}:\n  a ← r[u]; b ← r[v]\n  falls a≠b: alle Einträge a oder b durch min(a,b) ersetzen",
  },
  {
    id: "components",
    name: "Komponenten · DFS",
    category: "Komponenten",
    run: graph.components,
    introduction:
      "Jeder neue DFS-Start entdeckt genau eine noch nicht bearbeitete schwache Komponente.",
    prerequisites:
      "Bei gerichteten Eingaben werden beide Richtungen betrachtet. Starke Komponenten benötigen Kosaraju.",
    formulas: [
      "rep(v)=Wurzel des DFS-Baums von v",
      "rep(u)=rep(v) ⇔ gleiche schwache Komponente",
    ],
    explanation:
      "Nach einer vollständigen Suche ab einer Wurzel gibt es keinen unentdeckten Knoten mehr, der zu dieser Komponente gehört. Eine neue Wurzel kann deshalb eine neue Repräsentantenfarbe erhalten. Gleiche Farben im Graphen und gleiche rep-Einträge beschreiben dieselbe Klasse.",
    complexity:
      "O(n+m) Zeit, O(n) Zusatzspeicher zusätzlich zur ungerichteten Adjazenzsicht.",
    pseudocode:
      "für jeden Knoten u:\n  falls u unentdeckt:\n    starte DFS mit Wurzel u\n    setze rep(v)←u für alle dabei entdeckten v",
  },
  {
    id: "kosaraju",
    name: "Kosaraju · starke Komponenten",
    category: "Komponenten",
    run: graph.kosaraju,
    introduction:
      "Zwei vollständige Tiefensuchen trennen einen gerichteten Graphen in gegenseitig erreichbare Bereiche.",
    prerequisites:
      "Gerichteter Graph. Die erste Suche arbeitet hier auf Gᵀ, die zweite auf G.",
    formulas: [
      "Gᵀ=(V,Eᵀ), Eᵀ={(v,u):(u,v)∈E}",
      "u ↝ v in G ⇔ v ↝ u in Gᵀ",
      "u ≈ v ⇔ u ↝ v und v ↝ u",
      "ord: absteigende Endzeit der ersten DFS",
    ],
    explanation:
      "Das Umdrehen der Kanten verändert die starken Komponenten nicht. Die Endzeiten der ersten Suche liefern eine Reihenfolge, in der die zweite Suche keine noch unentdeckte fremde Komponente mit einsammelt. Im zweiten Durchlauf bekommen genau die Knoten eines Suchbaums denselben rep-Wert. Die Richtungsumkehr und der Phasenwechsel werden sichtbar mitgespielt.",
    complexity:
      "O(n+m) Zeit. Arrays und Aufrufstack O(n), zusätzliche Adjazenzdarstellungen O(n+m). Die Abschlussfolge der ersten Suche wird einmal umgekehrt, um ord für den zweiten Durchlauf zu bilden.",
    pseudocode:
      "Gᵀ bilden\nvollständige DFS auf Gᵀ; Abschlussreihenfolge merken\nReihenfolge umkehren\nalle Knoten wieder unentdeckt setzen\nDFS auf G in dieser Reihenfolge\njeder neue Suchbaum ergibt eine starke Komponente",
  },
  {
    id: "kruskal",
    name: "Kruskal · Spannwald",
    category: "Spannbäume",
    run: graph.kruskal,
    introduction:
      "Die günstigsten Kanten verbinden nach und nach bisher getrennte Bäume.",
    prerequisites:
      "Ungerichteter Graph. Negative und gleiche Gewichte sind erlaubt. Ohne Zusammenhang entsteht ein minimaler Spannwald.",
    formulas: [
      "T ⊆ E; w(T)=∑ₑ∈T w(e)",
      "zusammenhängend: |T|=n−1",
      "find(u)≠find(v) ⇒ Kante {u,v} aufnehmen",
    ],
    explanation:
      "Eine Kante innerhalb einer schon verbundenen Menge würde einen Zyklus erzeugen und wird verworfen. Die nächste günstigste Verbindung zwischen verschiedenen Mengen ist eine sichere Schnittkante: Es gibt einen minimalen Spannwald, der die bisher gewählten Kanten enthält. Bei gleichen Gewichten können mehrere gleich gute Ergebnisse existieren. Ein minimaler Spannbaum minimiert die Summe aller Baumkanten, nicht die Start-Ziel-Distanz.",
    complexity:
      "Mit dieser direkten Repräsentantenverwaltung O(m log m + nm) Zeit und O(n+m) Speicher. Mit optimiertem Union-Find dominiert bei üblichen Graphen das Kantensortieren.",
    pseudocode:
      "Kanten aufsteigend nach Gewicht ordnen\nfür jede Kante {u,v}:\n  falls Repräsentanten verschieden:\n    Kante in T aufnehmen; Mengen vereinigen\n  sonst: Kante verwerfen",
  },
  {
    id: "prim",
    name: "Prim · Spannwald",
    category: "Spannbäume",
    run: graph.prim,
    introduction:
      "Prim erweitert einen bestehenden Baum jeweils über die günstigste Verbindung nach außen.",
    prerequisites:
      "Ungerichteter Graph. Für getrennte Komponenten beginnt die Lernvariante jeweils einen weiteren Baum.",
    formulas: [
      "dis(v)=min {w(u,v): u bereits im Baum}",
      "pre(v)=Ende der aktuell günstigsten Anschlusskante im Baum",
      "(tu[i],tv[i]) = i-te aufgenommene Kante",
    ],
    explanation:
      "dis speichert die Kosten einer einzelnen Anschlusskante. Die Wurzel des Min-Heaps enthält den nächsten Knoten über die günstigste Kante, die den bisherigen Baum mit dem Rest verbindet. Nach der Entnahme werden seine Nachbarn geprüft und bei günstigeren Kanten die Prioritäten gesenkt. Die Ansicht zeigt den Heap in seiner tatsächlichen Array-Reihenfolge.",
    complexity:
      "O((n+m) log(n+1)) Zeit und O(n+m) Speicher mit indiziertem Min-Heap und Adjazenzlisten.",
    pseudocode:
      "dis(Wurzel)←0; übrige dis←∞\nsolange der Min-Heap nicht leer ist:\n  u mit kleinster Priorität entnehmen\n  Elternkante in tu und tv aufnehmen\n  bei günstigerer Anschlusskante dis/pre ändern und Heap aktualisieren\nbei Restkomponenten neue Wurzel wählen",
  },
  {
    id: "trees",
    name: "Bäume · Beziehungen & XML",
    category: "Bäume & XML",
    run: graph.trees,
    introduction:
      "Eine Wurzel macht Elternbeziehungen, Ebenen und Traversierungsreihenfolgen eines Baums eindeutig.",
    prerequisites:
      "Freier Baum oder Wald; bei gerichteter Darstellung höchstens ein Elternknoten je Knoten und keine Zyklen. Die gewählte Quelle ist im ungerichteten Baum die Wurzel.",
    formulas: [
      "freier Baum ⇔ zusammenhängend und azyklisch",
      "Wald: jede Komponente ist ein Baum",
      "Tiefe(Wurzel)=0; Tiefe(Kind)=Tiefe(Eltern)+1",
      "Höhe(Blatt)=0; Höhe(u)=maxₖᵢₙd (1+Höhe(Kind))",
      "Baumhöhe als Ebenenzahl = Höhe(Wurzel)+1",
      "echter Vorfahre u von v ⇔ beg(u)<beg(v)<end(v)<end(u)",
      "verschiedene Geschwister u,v: pre(u)=pre(v)≠−1",
    ],
    explanation:
      "Beim Betreten entsteht die Preorder, beim Verlassen die Postorder. Ein Blatt hat keine Kinder. Der Baumgrad ist die Kinderzahl; er unterscheidet sich vom Grad eines Knotens im ungerichteten Graphen. XML-Elemente bilden durch ihre Verschachtelung ebenfalls einen gewurzelten Baum. XPath wählt darin beispielsweise Kinder oder Nachfahren aus. Das XML-Beispiel lässt sich bearbeiten; ausgewählte Elemente werden im Graphen markiert.",
    complexity:
      "Die Traversierung und Berechnung von Tiefe/Höhe benötigen O(n+m) Zeit und O(n) Zusatzspeicher. Die vorbereitende Prüfung gerichteter Wurzeln nutzt hier einfache Kantenscans mit O(nm). XPath-Aufwand hängt vom Ausdruck ab.",
    pseudocode:
      "betrete u: Beginnzeit, Preorder und Tiefe speichern\nfür jedes Kind v:\n  pre(v)←u; Tiefe(v)←Tiefe(u)+1; besuche(v)\n  Höhe(u)←max(Höhe(u),Höhe(v)+1)\nverlasse u: Endzeit und Postorder speichern",
  },
];

const stringEntries: Entry[] = [
  {
    id: "levenshtein",
    name: "Levenshtein · dynamisch",
    category: "Editierdistanz",
    run: strings.levenshtein,
    introduction:
      "Die Editierdistanz zählt die kleinste Zahl von Einfügungen, Löschungen und Ersetzungen, die s in t überführen.",
    prerequisites:
      "Jede Editieroperation kostet 1; unveränderte Zeichen kosten 0. Beide Eingaben dürfen leer sein.",
    formulas: [
      "D[i][j]=d(s[:i],t[:j])",
      "D[i][0]=i; D[0][j]=j",
      "D[i][j]=min(D[i−1][j]+1, D[i][j−1]+1, D[i−1][j−1]+1[s[i−1]≠t[j−1]])",
    ],
    explanation:
      "Die drei Vorgängerzellen stehen für Löschen, Einfügen und Ersetzen beziehungsweise Beibehalten. 1[... ] ist die Indikatorfunktion: Sie liefert 1 bei einer wahren Bedingung und sonst 0. Nach dem Füllen erklärt ein Rückweg durch die Tabelle eine optimale Operationsfolge. Bei gleich guten Vorgängern gibt es mehrere korrekte Folgen.",
    complexity:
      "O((|s|+1)(|t|+1)) Zeit und Speicher für die Tabelle; die Rekonstruktion braucht O(|s|+|t|) Schritte. Ohne Rekonstruktion wären nur zwei Zeilen nötig.",
    pseudocode:
      "Randzeile und Randspalte initialisieren\nfür jede übrige Zelle:\n  Minimum aus Löschen, Einfügen, Ersetzen/Behalten\nvon rechts unten zurück zu (0,0) gehen\nOperationsfolge umkehren",
  },
  {
    id: "levenshtein-recursive",
    name: "Levenshtein · naive Rekursion",
    category: "Editierdistanz",
    run: strings.levenshteinRecursive,
    introduction:
      "Die direkte Rekursion macht sichtbar, warum wiederholte Teilprobleme teuer werden.",
    prerequisites:
      "Für diese Vorführung zusammen höchstens 12 Zeichen; das Schrittlimit kann viel früher greifen. Gleiche Teilprobleme werden absichtlich nicht wiederverwendet.",
    formulas: [
      "d(s[:0],t[:j])=j; d(s[:i],t[:0])=i",
      "d(i,j)=min(d(i−1,j)+1, d(i,j−1)+1, d(i−1,j−1)+1[s[i−1]≠t[j−1]])",
    ],
    explanation:
      "Jeder innere Aufruf verzweigt bis zu dreimal. Der sichtbare Aufrufstack zeigt nur den aktuellen Zweig, während die Anzahl der Aufrufe weiter wächst. Bereits berechnete Argumentpaare werden erkannt und im Text erwähnt, ihr Ergebnis wird aber nicht als Abkürzung verwendet. Die DP-Version vermeidet genau diese Wiederholungen.",
    complexity:
      "Exponentialer Zeitaufwand, grob O(3^(|s|+|t|)); O(|s|+|t|) Stacktiefe. Die Lernanzeige merkt sich zusätzlich schon beobachtete Argumentpaare und das Replay.",
    pseudocode:
      "d(i,j):\n  falls i=0: gib j zurück\n  falls j=0: gib i zurück\n  berechne drei rekursive Nachbarprobleme\n  gib ihr Kostenminimum zurück",
  },
  {
    id: "substring",
    name: "Gemeinsame Teilzeichenkette · DP",
    category: "Gemeinsamkeiten",
    run: strings.substring,
    introduction:
      "Gesucht ist ein möglichst langer zusammenhängender Abschnitt, der in beiden Eingaben vorkommt.",
    prerequisites:
      "Zusammenhängend bedeutet: Innerhalb des Ergebnisses dürfen keine Zeichen übersprungen werden.",
    formulas: [
      "D[i][j]=lc_suf(s[:i],t[:j])",
      "D[i][j]=D[i−1][j−1]+1 bei gleichen letzten Zeichen, sonst 0",
      "Länge = maxᵢ,ⱼ D[i][j]",
    ],
    explanation:
      "Jede Zelle misst nur das gemeinsame Suffix der beiden Präfixe. Ein ungleiches Zeichen beendet diesen Lauf. Das größte Tabellenfeld liefert die beste Länge; seine Zeile bezeichnet die Endposition in s. Anders als bei der Teilfolge genügt deshalb nicht allein die rechte untere Zelle.",
    complexity:
      "O((|s|+1)(|t|+1)) Zeit und Speicher; bei reinem Längenvergleich genügt O(min(|s|,|t|)) Arbeitsspeicher.",
    pseudocode:
      "Randwerte ← 0\nfür i,j:\n  bei gleichen Zeichen: D[i,j]←D[i−1,j−1]+1\n  sonst: D[i,j]←0\n  bisheriges Maximum und seine Endposition merken\nzusammenhängenden Abschnitt aus s zurückgeben",
  },
  {
    id: "substring-naive",
    name: "Gemeinsame Teilzeichenkette · naiv",
    category: "Gemeinsamkeiten",
    run: strings.substringNaive,
    introduction:
      "Diese Variante probiert Paare gleich langer Abschnitte aus. Lange Kandidaten werden zuerst geprüft.",
    prerequisites:
      "Für lange Eingaben das Schrittlimit beachten. Der erste vollständige Treffer bei absteigenden Längen ist bereits maximal.",
    formulas: ["s[i:i+ℓ] = t[j:j+ℓ]", "ℓ von min(|s|,|t|) abwärts"],
    explanation:
      "Ein Zeichenvergleich nach dem anderen zeigt, wie oft fast gleiche Abschnitte erneut geprüft werden. Die DP-Version nutzt lokale Übereinstimmungen wieder, statt vollständige Abschnitte immer neu zu vergleichen.",
    complexity:
      "Diese direkte Variante liegt in O(min(|s|,|t|)²·|s|·|t|) im schlechtesten Fall, bei gleich langen Eingaben also O(n⁴). Ohne Eingaben und Replay nur konstanter Zusatzspeicher.",
    pseudocode:
      "für Länge ℓ von groß nach klein:\n  für jeden Start i in s und j in t:\n    vergleiche ℓ Zeichen\n    falls alle gleich: gib diesen Abschnitt zurück",
  },
  {
    id: "subsequence",
    name: "Gemeinsame Teilfolge · DP",
    category: "Gemeinsamkeiten",
    run: strings.subsequence,
    introduction:
      "Eine gemeinsame Teilfolge darf Zeichen auslassen, muss aber deren Reihenfolge erhalten.",
    prerequisites:
      "Nicht mit der zusammenhängenden Teilzeichenkette verwechseln. Es können mehrere verschieden geschriebene optimale Ergebnisse existieren.",
    formulas: [
      "D[i][j]=lc_seq(s[:i],t[:j])",
      "gleiche letzte Zeichen: D[i][j]=D[i−1][j−1]+1",
      "sonst: D[i][j]=max(D[i−1][j],D[i][j−1])",
      "D[i][0]=D[0][j]=0",
    ],
    explanation:
      "Bei gleichen Endzeichen erweitern wir eine gemeinsame Teilfolge der kürzeren Präfixe. Sonst wird eines der Endzeichen ausgelassen. Im Rückweg werden nur passende diagonale Schritte als Ergebniszeichen gesammelt. Das optimale Ergebnis steht in D[|s|][|t|].",
    complexity: "O((|s|+1)(|t|+1)) Zeit und Speicher; Rückweg O(|s|+|t|).",
    pseudocode:
      "Tabelle mit Randwert 0 anlegen\nbei gleichen Endzeichen: diagonal +1\nsonst: Maximum aus oben und links\nvon rechts unten zurückgehen\npassende diagonale Zeichen sammeln und umkehren",
  },
  {
    id: "naive-match",
    name: "Mustersuche · naiv",
    category: "Mustersuche",
    run: strings.naiveMatch,
    introduction:
      "Das Muster wird an jeder möglichen Textposition erneut von vorne verglichen.",
    prerequisites:
      "Erste Eingabe ist das Muster p, zweite Eingabe der Text t. Ein leeres Muster passt an Index 0.",
    formulas: ["Treffer an i ⇔ t[i:i+|p|]=p", "kein Treffer ⇒ −1"],
    explanation:
      "Schon ein abweichendes Zeichen verschiebt den Versuch um eine Textposition. Dabei können zuvor erfolgreiche Vergleiche erneut nötig werden. Die Darstellung markiert die aktuelle Ausrichtung und den zuletzt geprüften Zeichenvergleich.",
    complexity:
      "O(|p|·|t|+1) Zeit im schlechtesten Fall; O(1) Zusatzspeicher ohne Eingaben und Replay.",
    pseudocode:
      "für jede passende Textposition i:\n  vergleiche p von vorne mit t ab i\n  bei vollständiger Gleichheit: gib i zurück\ngib −1 zurück",
  },
  {
    id: "kmp",
    name: "Knuth–Morris–Pratt",
    category: "Mustersuche",
    run: strings.kmp,
    introduction:
      "KMP nutzt schon bekannte Musterstruktur, um nach einem Fehlvergleich sicher weiterzusuchen.",
    prerequisites:
      "Muster p und Text t. Die Verschiebungstabelle s besitzt |p|+1 Einträge; s[0]=−1 ist ein Kontrollwert.",
    formulas: [
      "s[0]=−1",
      "s[j]=max {k<j : p[:k] ist Suffix von p[:j]}",
      "Fehlvergleich: j ← s[j]; Textposition i bleibt unverändert",
    ],
    explanation:
      "Zuerst wird das Muster mit sich selbst verglichen. Ein Tabellenwert beschreibt den längsten echten Rand eines Musterpräfixes. Beim Fehlvergleich kann dieser bereits passende Anfang erhalten bleiben. Der Textzeiger läuft niemals zurück. Die ersten Frames erklären den Tabellenaufbau, danach folgt die Suche mit sichtbaren Verschiebungen.",
    complexity:
      "Vorverarbeitung O(|p|), Suche O(|t|), zusammen O(|p|+|t|+1); O(|p|) Zusatzspeicher ohne Replay.",
    pseudocode:
      "Verschiebungstabelle durch Selbstvergleich berechnen\ni←0; j←0\nsolange Text und Muster nicht fertig:\n  bei Fehlvergleich: j←s[j] wiederholen\n  i und j erhöhen\nbei vollständig gefundenem Muster: gib i−j zurück\nsonst: gib −1 zurück",
  },
];
export const LESSONS: Lesson[] = [
  ...entries,
  ...stringEntries.map((e) => ({ ...e, kind: "string" as const })),
  ...EXERCISE_LESSONS,
].map(({ run, ...entry }) => ({
  ...entry,
  kind: entry.kind ?? "graph",
  source: run.toString().replace(/^function[^(]*\(/, "function run("),
  java:
    JAVA[entry.id === "maze" ? "bfs" : entry.id] ??
    EXERCISE_JAVA[entry.id] ??
    "",
  pseudocode: entry.pseudocode,
}));
export const GRAPH_LESSONS = LESSONS.filter((item) => item.kind === "graph");
export const STRING_LESSONS = LESSONS.filter((item) => item.kind === "string");
