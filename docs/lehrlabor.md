# Graph- und Zeichenkettenlabor

Das Lehrlabor ergänzt die Start-Ziel-Wegsuche. Seine Algorithmen berechnen zuerst ein begrenztes Replay im Worker. Die Wiedergabe lässt sich pausieren, schrittweise vorwärts und rückwärts bewegen oder über einen Schieberegler durchsuchen. Eingabeänderungen verwerfen das vorherige Replay. Ein Schritt bezeichnet ein fachliches Ereignis, etwa eine Kantenprüfung, eine Entdeckung oder eine geänderte Tabellenzelle; Schrittzahlen verschiedener Verfahren sind deshalb kein einheitliches Maß für deren Rechenaufwand.

Die Texte, Implementierungen, Grafiken und Beispiele wurden für AlgoFights verfasst. Es werden keine Vorlesungsfolien, Foliengrafiken oder übernommenen Quellcodes ausgeliefert. Mathematische Begriffe und Formeln dienen als gemeinsame Fachsprache.

## Graph Sim

Unter **Graph Sim → Graph-Verfahren** stehen alle Verfahren in einem nach Themen gruppierten Menü. **Berechnen** bereitet den Ablauf vor; die Live-Werte stehen direkt unter der Wiedergabe. Suchumfang, Schrittlimit und Kanteneigenschaften sind unter **Weitere Einstellungen** zu finden.

Die Ansicht umfasst diese Lernbereiche:

| Bereich         | Verfahren und Darstellung                                                                                                                                                                                                             |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Graphgrundlagen | Gerichtete/ungerichtete Graphen, Knoten-/Kantenmenge, Grade, Adjazenzlisten/-matrizen, Gewichtungsmatrix, Erreichbarkeit und Prüfung eingegebener Pfade. Aufzählung einfacher Start-Ziel-Pfade mit Rücknahme des aktuellen Suchpfads. |
| Traversierung   | Vollständige BFS mit Farben, Distanzen, Vorgängern und FIFO; DFS mit Aufrufstack, Beginn-/Endzeitpunkten und Kantenklassifikation; Zyklenprüfung und topologische Ordnung.                                                            |
| Kürzeste Pfade  | Dijkstra mit indiziertem binärem Heap und `decreaseKey`; Bellman–Ford mit negativen Gewichten und negativer Zyklenerkennung; Floyd–Warshall mit D/P und vorherigen Tabellen.                                                          |
| Komponenten     | Direkte Union-Find-Repräsentanten, schwache Komponenten durch DFS und starke Komponenten durch Kosaraju mit sichtbarer Transposition und zwei Suchphasen.                                                                             |
| Spannbäume      | Kruskal und Prim, ausgewählte/verworfene Kanten, Anschlussprioritäten, Vorgänger, Gesamtgewicht und Spannwald bei getrennten Eingaben.                                                                                                |
| Bäume und XML   | Eltern, Kinder, Geschwister, Blätter, Ebenen, Tiefe/Höhe, Pre-/Postorder, Vorfahrenintervalle und editierbarer XML-Elementbaum mit XPath-Auswahl.                                                                                     |

**Graph aus Matrix, Labyrinth oder Vorlage erzeugen** im Builder akzeptiert Adjazenz- und Gewichtungsmatrizen, erzeugt Kₙ, Qᵈ und den Petersen-Graphen und macht offene Labyrinthseiten zu ungerichteten Kanten. Bei Gewichtungsmatrizen steht `∞` für eine fehlende Kante, `0` außerhalb der Diagonale ist ein gültiges Gewicht. Der Import ordnet Kanten zeilenweise. Über **Nur Suchbaum / Suchwald** lassen sich die Vorgängerkanten während geeigneter Läufe einzeln betrachten.

Die zusätzlichen Experimente umfassen Quellenentfernung, BFS-Zyklenerkennung, das Zählen kürzester ungewichteter Wege, BFS ab jeder Quelle, Adjazenzmatrixpotenzen, längste DAG-Pfade mit negierten Gewichten, alle gleich kurzen einfachen Pfade, Graphfärbung und Hamiltonsuchen. Für exponentielle Suchen gilt das Aufzeichnungslimit. Ein abgebrochener Lauf entscheidet keine Nichtexistenz. Potenzen werden intern exakt mit `BigInt` berechnet. Ihre Einträge zählen Kantenfolgen, die Knoten wiederholen dürfen.

Kruskal zeigt die sortierten `gu/gv/gw`, die Repräsentanten `r` und die Baumkanten `tu/tv`. Prim zeichnet `dis/pre/tu/tv` und einen indizierten Min-Heap auf. **Spannbäume aufzählen** veranschaulicht die Schranke durch Kantenteilmengen an kleinen Graphen. Die Vorlage **Wegbaum und Spannbaum** eignet sich zum Vergleich von Dijkstra und Prim bei gleicher Quelle.

Die bestehende Start-Ziel-Wegsuche bleibt als eigener Modus erhalten. Sie enthält weiterhin A*, Greedy Best-First und bidirektionalen Dijkstra sowie die bisherigen eigenen Wegsuchalgorithmen. Ihre `findRoute(graph)`-Schnittstelle bleibt unverändert. Graphvorlagen und Builder werden von beiden Modi genutzt, ihre eigenen Algorithmen getrennt gespeichert.

### Eingaben und Notation

Knoten werden im Graphen und in Tabellen mit denselben Buchstaben bezeichnet. Intern verwenden Programme IDs ab 0. Gerichtete Kanten stehen als `(u,v)`, ungerichtete als `{u,v}`. `n=|V|` zählt Knoten, `m=|E|` Kanten. `k` zählt die Kanten eines Pfads, `w(p)` summiert deren Gewichte. Eine BFS-Distanz zählt Kanten und ist bei verschiedenen Gewichten nicht das minimale Pfadgewicht `δ(s,t)`.

`col` verwendet 0 für unentdeckt, 1 für offen und 2 für abgeschlossen. `pre` enthält Eltern beziehungsweise Pfadvorgänger. `beg` und `end` sind Zählerstände bei Eintritt und Abschluss einer DFS, keine Uhrzeiten. Für einen echten Vorfahren u von v gilt `beg(u)<beg(v)<end(v)<end(u)`. `r` beziehungsweise `rep` beschreiben Mengenrepräsentanten. `ord` zeigt die jeweilige Ausgabereihenfolge.

Eine Knotenhöhe zählt den längsten Abstieg in Kanten; Blätter haben Höhe 0. Die Baumhöhe wird hier als Ebenenzahl angegeben, also Wurzelhöhe plus 1. Diese Konvention wird ausdrücklich angezeigt, da andere Lehrbücher die Baumhöhe ebenfalls in Kanten zählen.

Für BFS/DFS wählt man eine Quelle, eine Suche zum Ziel auf umgedrehten Kanten oder den gesamten Suchwald. Dijkstra/Bellman–Ford können ab einer Quelle, zum Ziel oder nacheinander für alle Quellen laufen. Floyd–Warshall arbeitet immer für alle Paare. Nach vollständigen kürzesten-Pfad-Läufen lassen sich Vorgängerketten für das gewählte Paar ablesen; Floyd zeigt dabei die Matrix P.

Der Builder erlaubt 32 Knoten, 96 Kanten und ganzzahlige Gewichte von −999 bis 999, einschließlich 0. Im gerichteten Modus sind Gegenkanten und Schlingen erlaubt. Erneuter Klick auf den ausgewählten Ausgangsknoten erzeugt eine Schlinge. Pro gerichtetem Paar gibt es höchstens eine Kante. Die ungerichtete Ansicht fasst Gegenkanten unter dem kleineren Gewicht zusammen und blendet Schlingen aus, ohne die gespeicherte gerichtete Vorlage zu verändern.

### Voraussetzungen und Grenzen

- Dijkstra benötigt nichtnegative Kantenkosten. Die ältere Start-Ziel-Ansicht verweist bei negativen Gewichten ins Lehrlabor.
- Bellman–Ford markiert nur von der Quelle erreichbare negative Zyklen und deren erreichbare Folgeknoten mit `−∞`. Unerreichbare Knoten bleiben `∞`.
- Floyd–Warshall markiert genau die Quell-Ziel-Paare mit `−∞`, die über einen negativen Zyklus verbunden werden können.
- Die vollständige DFS prüft im ungerichteten Fall nicht erneut die Elternkante. Das verhindert einen falschen Zyklusnachweis durch bloßes Zurücklaufen.
- Topologisches Sortieren erfordert einen DAG. Kruskal und Prim benötigen ungerichtete Eingaben; bei getrennten Komponenten wird ein minimaler Spannwald berechnet.
- Die Union-Find-Lernvariante speichert direkte Repräsentanten: `find` ist konstant, eine Vereinigung kann das gesamte Array ändern. Laufzeitangaben optimierter Elternbaumvarianten gelten dafür nicht.
- Bei Prim beschreibt `dis` die günstigste Anschlusskante. Bei Dijkstra beschreibt `dis` die aufsummierten Wegkosten ab der Quelle. Beide JavaScript-Läufe zeigen den tatsächlichen Min-Heap. Die Java-Referenzen können veraltete Queue-Einträge bei der Entnahme verwerfen.
- XML wird ausschließlich lokal mit `DOMParser` gelesen. DTDs/Entities sind ausgeschlossen, höchstens 32 Elemente und 12.000 Eingabezeichen. XPath muss Elemente auswählen. Es werden keine externen XML-Ressourcen geladen.

## String Sim

| Verfahren                         | Sichtbarer Ablauf                                                                                                                               |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Levenshtein, naive Rekursion      | Aufrufstack, Präfixlängen, Zahl der Aufrufe und wiederkehrende Teilprobleme.                                                                    |
| Levenshtein, DP                   | Randwerte, drei Nachbarzellen, Indikator für Ersetzen/Beibehalten und Rückweg mit Editieroperationen.                                           |
| Gemeinsame Teilzeichenkette, naiv | Vergleich gleich langer zusammenhängender Abschnitte, lange Kandidaten zuerst.                                                                  |
| Gemeinsame Teilzeichenkette, DP   | Gemeinsame Suffixlängen, Rücksetzen bei ungleichen Zeichen und Maximum über die ganze Tabelle.                                                  |
| Gemeinsame Teilfolge, DP          | Auslassen von Zeichen, diagonale Übereinstimmungen und Rekonstruktion einer optimalen Folge.                                                    |
| Naive Mustersuche                 | Muster an jeder zulässigen Startposition; einzelne Zeichenvergleiche.                                                                           |
| Knuth–Morris–Pratt                | Selbstvergleich zum Aufbau der Verschiebungstabelle, anschließend sichere Rücksprünge und Musterverschiebungen ohne zurücklaufenden Textzeiger. |
| Naive Mustersuche mit Anker       | Vorgegebene Position oder im Text seltenstes Musterzeichen. Kandidaten werden links und rechts des Ankers geprüft. |
| Levenshtein-Metrik und Schranken  | Drei Texte, paarweise Editierdistanzen, Längenschranken und Dreiecksungleichung mit Begründung. |

`s[i:j]` enthält die Zeichen von i bis j−1. `s[:i]` ist ein Präfix, `s[i:]` ein Suffix, `ε` die leere Zeichenkette. Bei Mustersuche ist die erste Eingabe das Muster p, die zweite der Text t. Die Verschiebungstabelle heißt dort s; das ist eine eigene Variable und keine dritte Texteingabe.

Alle Texte dürfen leer sein. Das leere Muster passt an Position 0. Eingaben sind auf 48 UTF-16-Codeeinheiten begrenzt. Die JavaScript-Verfahren arbeiten mit `Array.from`, also Unicode-Codepoints. Graphemverbünde können mehrere Einträge besitzen. Die Java-Referenzen benutzen `charAt` und zählen UTF-16-Codeeinheiten; für Zeichen außerhalb der BMP können ihre Indizes und Distanzen deshalb abweichen. Naive Levenshtein-Rekursion ist auf insgesamt 12 Codepoints begrenzt; schon darunter kann das Schrittlimit erreicht werden.

Die DP-Ansichten färben die aktuelle Zelle und deren benötigte Vorgänger unterschiedlich. Die resultierende Teilzeichenkette muss zusammenhängend sein; eine Teilfolge darf Lücken enthalten. Bei mehreren Optima wird eine gültige Lösung angezeigt.

## Eigener Code

Jedes der 34 eingebauten Lehrverfahren lässt sich im Code-Editor als eigene Variante öffnen. Es erscheint ausschließlich seine `run`-Funktion. „Eigenen Algorithmus bauen“ startet mit leerem Code. JavaScript, Java und Pseudocode können unabhängig bearbeitet, mit Namen und eigener mathematischer Erklärung lokal gespeichert sowie als JSON importiert/exportiert werden. Java und Pseudocode sind Referenzen und werden nicht im Browser ausgeführt oder automatisch aus Änderungen am JavaScript erzeugt.

```js
function run(input, api) {
  const zahlen = [0, 0, 0];
  api.emit("Initialzustand", {
    arrays: [{ name: "zahlen", values: zahlen }],
  });
  zahlen[1] = 5;
  api.emit("Zweiter Eintrag geändert", {
    arrays: [{ name: "zahlen", values: zahlen }],
  });
  return "Experiment beendet";
}
```

`input` ist eine unveränderliche Kopie. Graphdaten: `nodes` mit `{id,label,x,y}`, `edges` mit `{from,to,weight}`, `directed`, `start`, `target`, `mode`. Eine ungerichtete Kante steht nur einmal in `edges`; eigener Code muss beide Nachbarrichtungen berücksichtigen. Textdaten: `s` und `t`. `api.label(id)` übersetzt interne IDs in die sichtbare Beschriftung.

Einzelne Verfahren erhalten zusätzliche Eingaben unter `input.options`: `power` (Matrixexponent), `colorCount`, `hamiltonCycle`, `anchor` (Musterindex) oder `third` (Text r). Bei fehlenden Feldern gelten die im Simulator angezeigten Standards. Geteilte Beispiele speichern diese Eingaben zusammen mit dem Graphen oder den Texten.

`api.emit(text, state)` zeichnet eine Kopie des aktuellen Zustands auf:

| Feld                      | Bedeutung                                                                                                                                                                                               |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `arrays`                  | `[{name, values, kind?}]`; `kind: "nodes"` zeigt Werte als Knotenbuchstaben, `"colors"` als Zustandsnummern.                                                                                            |
| `matrices`                | `[{name, values, active?, sources?}]`; Zeilenarrays, aktuelle Zelle `[i,j]` und erklärende Quellzellen `[[i,j],…]`. `kind: "nodes"` übersetzt Einträge in Knotenbuchstaben, etwa für Vorgängermatrizen. |
| `current`, `edge`         | Aktueller Knoten beziehungsweise Index einer geprüften Kante.                                                                                                                                           |
| `colors`, `groups`        | Zustandsnummern beziehungsweise Komponentenrepräsentanten pro Knoten. −1 bedeutet keine Gruppe.                                                                                                         |
| `selected`, `rejected`    | Kantenindizes für aufgenommene oder verworfene Verbindungen.                                                                                                                                            |
| `queue`, `stack`, `order` | Sichtbare Knotenfolgen.                                                                                                                                                                                 |
| `heap`                    | Paare `[Knoten, Priorität]` in der vom Algorithmus gewählten Reihenfolge.                                                                                                                               |
| `transpose`               | Dreht die Anzeige für den aktuellen Schritt um.                                                                                                                                                         |
| `string`                  | Zeichenpositionen `i`/`j`, Musterversatz `offset`, `result`, Positionspaare `marks` und Operationsliste `edits`; `phase: "pattern"` zeigt den Muster-Selbstvergleich.                                   |

Pro Lauf gelten 5 Sekunden, maximal 5.000 Ereignisse nach dem Initialzustand und ungefähr 24 MiB Aufzeichnung. Große Tabellen können das Speicherbudget früher erreichen; dann kleinere Eingaben verwenden. Arrays enthalten höchstens 128 Werte, Matrizen höchstens 65×65 Zellen. Pro Codeansicht maximal 50.000 Zeichen, pro Labor höchstens 30 eigene Varianten.

Eingebaute Verfahren laufen in einem eigenen Worker. Eigener Code läuft in einem Blob-Worker innerhalb eines Iframes mit opaker Herkunft, `sandbox="allow-scripts"` und einer CSP ohne Netzwerkzugriff. Es gibt keine Nachrichtenübertragung für jeden Einzelschritt: Die Eingabe wird einmal übertragen und das Replay gebündelt zurückgegeben. Abbruch, Zeitüberschreitung und Verlassen des Labors beseitigen die Ausführungsumgebung. Die lokale Sandbox ist für eigenen geprüften Code gedacht und bietet keine vollständige Garantie gegen absichtliche extreme Speichernutzung oder Browserfehler.

Die Funktion „Code prüfen“ führt mit der aktuellen Eingabe höchstens 100 aufgezeichnete Schritte aus. Sie prüft Syntax, Ausführung und Darstellungsformat, beweist aber keine mathematische Korrektheit. Ungültige Rückgaben werden als Fehler angezeigt. Eine eigene Funktion muss synchron einen Ergebnistext zurückgeben.

## Technische Struktur

- `src/lab/graph-algorithms.js` und `string-algorithms.js`: unabhängig von Vue ausführbare, einzeln im Editor ladbare Funktionen.
- `src/lab/catalog.ts`: eigenständige Erklärungen, Formeln, Voraussetzungen und zur jeweiligen Implementierung passende Laufzeitangaben.
- `src/lab/references.ts`: Java-17-Referenzen ohne Replay-Hooks; Pseudocode steht im Katalog.
- `src/lab/runtime.js`: unveränderliche Eingabe, Snapshot-Validierung und Aufzeichnungsbudgets.
- `src/workers/lessons.ts`, `src/services/lesson-runner.ts`, `public/lesson-runner.js`: Worker und isolierte Ausführung.
- Vue-Komponenten stellen nur gespeicherte Zustände dar. Wiedergabegeschwindigkeit verändert kein Berechnungsergebnis.

Alle Funktionen bleiben Bestandteil eines statisch hostbaren Vite-Builds. Es gibt keinen Backenddienst und keine externen Ressourcen für die Lehrabläufe.
