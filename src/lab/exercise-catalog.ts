import * as graph from "./exercise-graphs.js";
import { bfs } from "./graph-algorithms.js";
import { anchorMatch, editMetric } from "./string-algorithms.js";
import type { LessonEntry } from "./types";

export const EXERCISE_LESSONS: LessonEntry[] = [
  {
    id: "kahn",
    name: "Topologische Sortierung · Quellenentfernung",
    category: "Traversierung",
    run: graph.kahn,
    introduction:
      "Quellen des Restgraphen werden der Reihe nach ausgegeben. Ihre ausgehenden Kanten verschwinden aus dem Restgraphen.",
    prerequisites:
      "Gerichteter Graph. Eine vollständige Ordnung existiert genau dann, wenn der Graph azyklisch ist.",
    formulas: [
      "Quelle u ⇔ indeg(u) = 0",
      "(u,v) entfernen ⇒ indeg(v) ← indeg(v) − 1",
    ],
    explanation:
      "Eine Quelle hat im Restgraphen keine unerfüllte Voraussetzung. Durch das Entfernen ihrer Kanten können neue Quellen entstehen. Bleiben Knoten ohne verfügbare Quelle übrig, lässt sich in diesem Restgraphen eine Vorgängerkette bis zur ersten Wiederholung verfolgen. Das weist einen Zyklus nach.",
    complexity:
      "O(n+m) Zeit und Speicher mit Adjazenzlisten und Warteschlange.",
    pseudocode:
      "indeg aller Knoten zählen; Quellen in q einreihen\nsolange q nicht leer:\n  u entnehmen und ausgeben\n  jede Ausgangskante von u entfernen\n  neue Quellen in q aufnehmen\nwenn weniger als n Knoten ausgegeben wurden: Zyklus",
  },
  {
    id: "bfs-cycle",
    name: "Zyklenerkennung · Breitensuche",
    category: "Traversierung",
    run: graph.bfsCycle,
    introduction:
      "Der BFS-Suchwald liefert einen einfachen Zyklus, sobald eine zusätzliche Kante zwei bereits entdeckte Knoten verbindet.",
    prerequisites:
      "Ungerichteter Graph. Getrennte Komponenten werden nacheinander durchsucht.",
    formulas: [
      "v unentdeckt ⇒ pre(v) ← u",
      "v entdeckt und Kante ≠ Elternkante ⇒ Zyklus",
    ],
    explanation:
      "Die beiden Knoten liegen im selben Suchbaum. Ihre Elternketten treffen sich bei einem gemeinsamen Vorfahren. Zusammen mit der geprüften Kante ergeben die beiden Abschnitte bis zu diesem Vorfahren einen einfachen Zyklus. Die direkte Rückkehr entlang derselben Elternkante wird übersprungen.",
    complexity:
      "O(n+m) Zeit und Speicher; der Nachweis folgt höchstens n Elternzeigern.",
    pseudocode:
      "Breitensuche ab jeder unentdeckten Komponente starten\nfür jede geprüfte Kante u—v:\n  Elternkante von u überspringen\n  wenn v neu ist: als Kind von u einreihen\n  sonst: Zyklus aus Baumweg und dieser Kante ausgeben",
  },
  {
    id: "bfs-count",
    name: "Breitensuche · kürzeste Wege zählen",
    category: "Traversierung",
    run: graph.bfsCount,
    introduction:
      "Neben der kürzesten Distanz speichert die BFS, wie viele kürzeste Wege jeden Knoten erreichen.",
    prerequisites:
      "Jede Kante zählt als ein Schritt. Kantengewichte gehen nicht in die Berechnung ein.",
    formulas: [
      "dis(s)=0; anz(s)=1",
      "dis(v)=dis(u)+1 ⇒ anz(v) ← anz(v)+anz(u)",
    ],
    explanation:
      "Der erste Zugang bestimmt die BFS-Ebene. Weitere Zugänge aus der unmittelbar vorherigen Ebene sind ebenso kurz. Jeder kürzeste Weg endet mit genau einer solchen Kante, weshalb die Anzahlen ihrer Vorgänger addiert werden. Kanten innerhalb einer Ebene oder zurück in eine frühere Ebene tragen nichts bei.",
    complexity:
      "O(n+m) Zeit und Speicher. Ein Knoten wird nur beim ersten Erreichen eingereiht.",
    pseudocode:
      "dis(s)←0; anz(s)←1; q←⟨s⟩\nsolange q nicht leer:\n  u entnehmen\n  für jeden Nachbarn v:\n    bei erster Entdeckung: dis(v)←dis(u)+1; v einreihen\n    falls dis(v)=dis(u)+1: anz(v) um anz(u) erhöhen",
  },
  {
    id: "bfs-reach",
    name: "Erreichbarkeit · BFS pro Quelle",
    category: "Graphgrundlagen",
    run: graph.bfsReach,
    introduction:
      "Eine eigenständige Breitensuche pro Knoten ergibt die Zeilen der Erreichbarkeitsmatrix.",
    prerequisites:
      "Gerichtete oder ungerichtete Eingabe. Für jede Quelle werden die Markierungen neu begonnen.",
    formulas: [
      "R[u,v] = 1 ⇔ v ist von u erreichbar",
      "R[u,u]=1 durch den Pfad der Länge 0",
    ],
    explanation:
      "Eine Breitensuche ab u erreicht genau die Knoten, die über Kantenfolgen ab u zugänglich sind. Anders als bei einem Suchwald behalten die späteren Suchen keine Markierungen der früheren Quellen. Kleine Graphen zeigen jede Expansion; bei größeren Graphen werden die fertigen Zeilen aufgezeichnet.",
    complexity:
      "O(n(n+m)) Zeit, im dichten Fall O(n³), und O(n²+n+m) Speicher mit Ausgabematrix.",
    pseudocode:
      "für jede Quelle u:\n  mit leerer Besuchsmenge BFS ab u starten\n  jeden erreichten Knoten v in Zeile u als R[u,v]←1 markieren",
  },
  {
    id: "matrix-powers",
    name: "Adjazenzmatrix · Potenzen und Erreichbarkeit",
    category: "Graphgrundlagen",
    run: graph.matrixPowers,
    introduction:
      "Die Matrixprodukte A², A³ und weitere Potenzen zählen Kantenfolgen einer festen Länge.",
    prerequisites:
      "Gerichteter oder ungerichteter Graph. Gewichte spielen für die 0/1-Adjazenzmatrix keine Rolle.",
    formulas: [
      "(Aᵏ⁺¹)[u,v] = ∑ₓ (Aᵏ)[u,x] · A[x,v]",
      "für u≠v: u ↝ v ⇔ (A + … + Aⁿ⁻¹)[u,v] > 0",
    ],
    explanation:
      "Eine Kantenfolge der Länge k+1 zerfällt eindeutig in eine Folge bis x und die letzte Kante x→v. Wiederholte Knoten sind erlaubt. Für die Erreichbarkeit verschiedener Knoten genügt Länge n−1, weil man aus einer Verbindung alle Umwege über wiederholte Knoten entfernen kann. Die Anzeige verwendet exakte ganze Zahlen und setzt R auf der Diagonale auf 1.",
    complexity:
      "Bis Exponent k: O(k·n³) arithmetische Operationen, O(n²) Matrixeinträge im Arbeitsspeicher; große ganze Zahlen erhöhen die Kosten je Operation.",
    pseudocode:
      "A aus Kanten bilden; P←A; S←A\nfür i von 2 bis k:\n  P←P·A; S←S+P\nR[u,v]←1 falls u=v oder S[u,v]>0, sonst 0",
  },
  {
    id: "longest-dag",
    name: "Bellman–Ford · längste DAG-Pfade",
    category: "Kürzeste Pfade",
    run: graph.longestDag,
    introduction:
      "Die längsten Pfade ab einer Quelle lassen sich auf kürzeste Pfade mit negierten Gewichten zurückführen.",
    prerequisites:
      "Gerichteter azyklischer Graph. Positive und negative Kantengewichte sind zulässig.",
    formulas: ["w′(u,v)=−w(u,v)", "maxₚ w(p)=−minₚ w′(p)"],
    explanation:
      "Das Negieren kehrt die Ordnung der Pfadgewichte um. Weil ein DAG keine Zyklen besitzt, kann das Negieren keinen negativen Zyklus erzeugen. Die Vorgänger im Lauf mit negierten Gewichten beschreiben daher längste Wege im ursprünglichen Graphen. Die Ansicht zeigt beide Vorzeichen.",
    complexity:
      "O(n·m+n+m) Zeit mit Bellman–Ford und DAG-Prüfung; O(n+m) Speicher.",
    pseudocode:
      "Azyklizität prüfen\nalle Kantengewichte negieren\nBellman–Ford ab s ausführen\nendliche Distanzen wieder negieren; Vorgänger beibehalten",
  },
  {
    id: "all-shortest",
    name: "Alle gleich kurzen Pfade",
    category: "Kürzeste Pfade",
    run: graph.allShortest,
    introduction:
      "Nach dem Berechnen der Distanz werden sämtliche einfachen Pfade mit optimalem Gewicht einzeln markiert.",
    prerequisites:
      "Start und Ziel. Ist ein negativer Zyklus vom Start erreichbar und führt von ihm ein Weg zum Ziel, existiert kein endliches Minimum.",
    formulas: [
      "optimale Kante (u,v) ⇒ dis[u]+w(u,v)=dis[v]",
      "Summe der Differenzen entlang eines optimalen Pfads = dis[Ziel]−dis[Start]",
    ],
    explanation:
      "Die Relaxierung bestimmt die kürzesten Distanzen. Danach folgt die Pfadsuche nur Kanten mit exakt passender Distanz. Die Gleichungen addieren sich zum optimalen Gesamtgewicht. Nullkostenzyklen würden beliebig viele Kantenfolgen zulassen, deshalb werden nur Pfade ohne Knotenwiederholung aufgezählt.",
    complexity:
      "O(n·m+n+m) für die Distanzen, danach im schlechtesten Fall exponentiell viele Erweiterungen. Das Schrittlimit begrenzt die Aufzeichnung.",
    pseudocode:
      "Distanzen ab Start mit Bellman–Ford berechnen\nfür das Ziel relevante negative Zyklen prüfen\nalle einfachen Start–Ziel-Pfade über Kanten mit dis[u]+w=dis[v] aufzählen",
  },
  {
    id: "maze",
    name: "Labyrinth · kürzester Weg",
    category: "Graphgrundlagen",
    run: bfs,
    introduction:
      "Jedes Feld ist ein Knoten. Zwischen zwei benachbarten Feldern gibt es nur dann eine Kante, wenn keine Wand dazwischen liegt.",
    prerequisites:
      "Erstelle das Raster und seine Wände im Graph Builder. Eine Bewegung über eine offene Kante kostet genau einen Schritt.",
    formulas: [
      "Kante ⇔ gemeinsame offene Seite",
      "dis(v)=minimale Anzahl der Schritte ab s",
      "pre(v) zeigt das vorangegangene Feld",
    ],
    explanation:
      "Die BFS untersucht zuerst Felder in geringer Entfernung. Die Knoten entlang der Vorgängerkette vom Ziel zur Quelle ergeben rückwärts den kürzesten Weg. Wände bleiben bei der Graphumwandlung vollständig ausgespart.",
    complexity:
      "O(n+m) Zeit und Speicher, bei einem Raster mit höchstens vier Nachbarn pro Feld also linear in der Zahl der Felder.",
    pseudocode:
      "für jedes Feld einen Knoten anlegen\noffene orthogonale Nachbarseiten als Kanten anlegen\nBFS ab dem Startfeld\nbei erreichbarem Ziel pre-Kette rückwärts verfolgen",
  },
  {
    id: "coloring",
    name: "Graphfärbung · mit k Farben",
    category: "Färbung & Hamilton",
    run: graph.coloring,
    introduction:
      "Nachbarn sollen unterschiedliche Farben erhalten. Die Suche versucht Farben und nimmt ungeeignete Entscheidungen zurück.",
    prerequisites:
      "Ungerichteter Graph. Wähle die Anzahl verfügbarer Farben. Eine Schlinge verhindert eine gültige Färbung.",
    formulas: ["f: V → {1,…,k}", "für jede Kante {u,v}: f(u) ≠ f(v)"],
    explanation:
      "Zuerst kommt ein Knoten mit möglichst vielen verschiedenen Farben in seiner Nachbarschaft an die Reihe. Jede zulässige Farbe wird versucht; gleichwertige neue Farben müssen nicht mehrfach ausprobiert werden. Ein vollständiger Erfolg zeigt eine Färbung, ein komplett ausgeschöpfter Suchbaum widerlegt die Färbbarkeit mit k Farben.",
    complexity:
      "Im schlechtesten Fall exponentiell in n; das Schrittlimit kann die Suche vor einer Entscheidung beenden.",
    pseudocode:
      "wähle einen noch ungefärbten Knoten mit vielen verschieden gefärbten Nachbarn\nversuche jede verfügbare Farbe\n  bei Erfolg fortfahren\n  bei Sackgasse Farbe zurücknehmen\nwenn alle Knoten gefärbt sind: Färbung ausgeben",
  },
  {
    id: "hamilton",
    name: "Hamiltonpfad und Hamiltonkreis",
    category: "Färbung & Hamilton",
    run: graph.hamilton,
    introduction:
      "Ein Hamiltonpfad besucht jeden Knoten genau einmal. Beim Hamiltonkreis muss es zusätzlich eine Kante zurück zum Anfang geben.",
    prerequisites:
      "Gerichteter oder ungerichteter Graph. Wähle Pfad oder Kreis. Schlingen werden ignoriert.",
    formulas: [
      "Pfad: n verschiedene Knoten, n−1 Kanten",
      "Kreis: Schlusskante vom letzten zum ersten Knoten",
    ],
    explanation:
      "Die Suche hängt einen unbenutzten Nachbarn an. Nach einer Sackgasse wird dieser Schritt rückgängig gemacht. Für einen Kreis genügt eine feste Startwahl, weil jeder Hamiltonkreis jeden Knoten enthält. Für einen Pfad können verschiedene Startknoten nötig sein. Im Petersen-Graphen kannst du beide Sucharten vergleichen.",
    complexity:
      "Bis zu O(n!) Pfadvarianten, O(n+m) Speicher. Ein abgebrochener Lauf ist kein Nichtexistenznachweis.",
    pseudocode:
      "Pfad ab einer Wurzel starten\nrekursiv jeden noch unbenutzten Nachbarn anhängen\nbei n Knoten: für einen Kreis auch die Schlusskante prüfen\nwenn nötig einen anderen Start probieren",
  },
  {
    id: "spanning-trees",
    name: "Spannbäume aufzählen",
    category: "Spannbäume",
    run: graph.spanningTrees,
    introduction:
      "Die Ansicht markiert nacheinander verschiedene Spannbäume eines kleinen Graphen und vergleicht ihre Anzahl mit einer oberen Schranke.",
    prerequisites:
      "Ungerichteter Graph mit höchstens 8 Knoten und 16 Kanten. Für K₅ eignen sich die vollständigen Graphvorlagen im Builder.",
    formulas: [
      "Ein Spannbaum hat n−1 Kanten",
      "Anzahl ≤ Binomialkoeffizient (m über n−1)",
    ],
    explanation:
      "Jeder Spannbaum ist eine Teilmenge aus n−1 Kanten. Die Suche entscheidet für jede Kante, ob sie aufgenommen wird. Verbindet eine Kante schon verbundene Knoten, würde sie einen Zyklus erzeugen. Ein Wald mit n Knoten und n−1 Kanten hat genau eine Komponente und ist damit ein Spannbaum.",
    complexity:
      "Exponentielle Teilmengensuche. Die Größen- und Aufzeichnungslimits halten die Demonstration überschaubar.",
    pseudocode:
      "Kanten in fester Reihenfolge prüfen\nfür jede Kante: überspringen oder aufnehmen, sofern sie keinen Zyklus schließt\nbei n−1 aufgenommenen Kanten Baum ausgeben",
  },
  {
    id: "anchor-match",
    name: "Naive Mustersuche · Ankerzeichen",
    kind: "string",
    category: "Mustersuche",
    run: anchorMatch,
    introduction:
      "Ein Zeichen innerhalb des Musters filtert mögliche Startstellen. Bei passendem Anker werden die Zeichen links und rechts geprüft.",
    prerequisites:
      "Erste Eingabe ist das Muster, zweite Eingabe der Text. Wähle die Ankerposition ab 0 oder lasse die App das im Text seltenste Musterzeichen wählen.",
    formulas: [
      "Start = Textposition des Ankers − Musterposition des Ankers",
      "Treffer ⇔ alle Musterzeichen an dieser Ausrichtung gleich sind",
    ],
    explanation:
      "Jeder Treffer muss auch am Anker übereinstimmen. Ein seltenes Ankerzeichen kann vollständige Kandidatenprüfungen sparen, besonders bei längeren Texten. Bei vielen gleichen Zeichen bleibt der schlechteste Fall quadratisch in Muster- und Textlänge zusammen.",
    complexity:
      "O(|t|+|p|+|t|·|p|) Zeit im schlechtesten Fall; Häufigkeiten benötigen Speicher für die verschiedenen Zeichen.",
    pseudocode:
      "Anker im Muster wählen\nfür passende Ankerpositionen im Text:\n  Start berechnen; Randgrenzen prüfen\n  linke und rechte Musterseite vergleichen\n  bei Übereinstimmung Start ausgeben",
  },
  {
    id: "edit-metric",
    name: "Levenshtein · Metrik und Schranken",
    kind: "string",
    category: "Editierdistanz",
    run: editMetric,
    introduction:
      "Drei frei gewählte Texte veranschaulichen die Dreiecksungleichung. Die Ansicht vergleicht außerdem Distanz und Längenschranken.",
    prerequisites:
      "Einfügen, Löschen und Ersetzen kosten jeweils 1. Gleiche Zeichen kosten 0.",
    formulas: [
      "d(s,t)=0 ⇔ s=t",
      "d(s,t)=d(t,s)",
      "d(r,t)≤d(r,s)+d(s,t)",
      "||s|−|t||≤d(s,t)≤max(|s|,|t|)",
    ],
    explanation:
      "Nur identische Texte brauchen null Schritte. Eine Umwandlung lässt sich rückwärts ausführen: Einfügen und Löschen sind Gegenoperationen und Ersetzungen sind umkehrbar. Zwei optimale Umwandlungen über s ergeben einen möglichen Weg von r nach t, dessen Aufwand eine obere Schranke ist. Die untere Längenschranke folgt aus der notwendigen Längenänderung. Für die obere Schranke kann man die gemeinsamen Positionen ersetzen und den Überhang einfügen oder löschen. Bei ausschließlich bekannten Längen sind beide Schranken scharf.",
    complexity:
      "Drei DP-Rechnungen mit zwei Zeilen. Für Texte a,b jeweils O((|a|+1)(|b|+1)) Zeit und O(|b|+1) Speicher.",
    pseudocode:
      "d(r,s), d(s,t) und d(r,t) per DP berechnen\nLängendifferenz und längere Länge als Schranken anzeigen\nd(r,t) mit der Summe über s vergleichen",
  },
];
