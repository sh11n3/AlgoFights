# AlgoFights

Die Code-Editoren öffnen die Originalimplementierungen der eingebauten Verfahren als editierbare Kopie. Eigene Varianten lassen sich benennen, prüfen, lokal speichern, importieren und exportieren. Algo Sim und die Start-Ziel-Ansicht von Graph Sim verwenden `findRoute(graph)`. Das Graph-Lehrlabor und String Sim verwenden `run(input, api)` mit einer Aufzeichnung beliebiger Arrays und Matrizen. Eigener Code läuft im Worker unter isolierter Herkunft mit fünf Sekunden Zeitlimit. Die APIs stehen im [Editor-Handbuch](public/docs/editor-handbuch.html), die Themen und Implementierungsdetails im [Lehrlabor-Handbuch](docs/lehrlabor.md).

Browser-Labor für Algorithmusexperimente mit deterministischer Raster-Arena, Wegsuche auf echten Straßen, Graphanalysen und Zeichenkettenverfahren. Vue 3, Composition API, TypeScript, Vite, Canvas 2D, SVG und Web Worker. Eigene Strategien werden im integrierten JavaScript-Editor entwickelt.

## Entwicklung

Node.js 22.12+ oder 24 und npm:

```sh
npm ci
npm run dev
```

```sh
npm run build   # TypeScript-Prüfung und statischer Produktionsbuild
npm run preview # Vorschau des fertigen Builds
```

`dist/` enthält ausschließlich statische Dateien. Relative Assetpfade erlauben ein Unterverzeichnis. Die Anwendung benötigt HTTP(S), JavaScript, Web Worker und sandboxed Iframes; kein Backend und kein serverseitiges Routing. Kartendaten liegen lokal im Build, ohne externe Karten- oder Routing-Anfragen während einer Vorführung.

## Arena und Spielregeln

- Jeder Teilnehmer steuert einen bewegten Punkt. Die Startzelle und jede neu eroberte Zelle geben jeweils einen Punkt.
- Reguläre Züge bewegen den Punkt genau eine Zelle nach oben, rechts, unten oder links. Grenzen, Hindernisse und belegte Zellen einschließlich der eigenen Spur sind gesperrt.
- Alle Teilnehmer entscheiden anhand desselben Zustands vor dem Schritt. Bei identischem freien Ziel gewinnt genau einer durch Seed-Zufall. Die anderen warten diesen Schritt.
- Ohne freien Nachbarn plant der Kern sofort für diesen Punkt einen BFS-Rückweg zur nächsten freien Zelle. Alle anderen Teilnehmer ziehen gleichzeitig weiter. Die Punkte gehen ihre Rückwege sichtbar, ausschließlich über benachbarte bespielbare Zellen. **Kein Teleportieren und keine zufälligen Neustarts.** Nur ein verlorener Konflikt um eine freie Zelle lässt einen Punkt für diesen Schritt warten.
- Nur diese automatischen Rückläufe dürfen belegte, auch gegnerische Zellen überqueren. Besitzer und Farben bleiben unverändert; Rücklaufschritte geben keine Punkte. Rücklaufende Punkte dürfen sich begegnen und kreuzen. Danach übernimmt die eigene Strategie wieder.
- Alle eingebauten Arenen sind zusammenhängend und enden bei **100 % Belegung**. Nicht zusammenhängende eigene Masken können unerreichbare Bereiche enthalten; der Kern meldet dies, statt zu teleportieren oder endlos zu rechnen.
- Fehlerhafter eigener Code wird mit Ursache angezeigt und deaktiviert; die Ersatzstrategie „Geradeaus“ übernimmt diesen Teilnehmer. Die Punktezahl entspricht weiterhin exakt der Zahl eigener Zellen.
- Die meisten Punkte gewinnen; Gleichstände sind möglich. Die Summe aller Endpunktestände entspricht der Zahl bespielbarer Zellen. Es gibt keine automatische Flächeneroberung.

Sieben Arenen stehen mit 256², 512² und 1.024² zur Auswahl: Kreis, Quadrat, Ring, verbundene Kammern, achtzackiger Stern, Labyrinth mit drei Ringwänden und versetzten Durchgängen sowie vier kreisförmige Bereiche mit schmalen Brücken. Alle Masken sind zusammenhängend; die drei neuen Formen sind außerdem um jeweils 90° rotationssymmetrisch. Die Vorschaubilder werden aus den tatsächlichen Rastermasken erzeugt. Standard: 512², vier Teilnehmer und zwölf Sekunden Wiedergabe. Startpositionen liegen auf Seed-rotierten Winkeln und werden auf gültige Zellen projiziert. Geometrie und Raster können Vor- und Nachteile erzeugen; für Vergleiche mehrere Seeds und vertauschte Startplätze verwenden.

Eingebaute Strategien: Rechtsorientiert, Linksorientiert, Lookahead, Zufall, Geradeaus, Zickzack, Zeilenläufer, Spirale, Kantenläufer und Invasion. Jede darf mehrfach teilnehmen. Lookahead untersucht höchstens 40 lokale Zellen pro Zugoption; normale Entscheidungen benötigen keine vollständige Flutfüllung.

## Spielkern und Replay

`src/core/` ist unabhängig von Vue und DOM. Masken verwenden `Uint8Array`, Besitzer `Int8Array`. Automatische Rücklauf-BFS verwendet wiederverwendete Suchpuffer. Seed-Zufallsströme für Entscheidungen und Konflikte sind getrennt; Rücklaufplanung ist deterministisch.

Das Replay speichert **jede Kopfbewegung** als 32-Bit-Ereignis mit Zellindex, Teilnehmer und Markierungen für Rücklauf, Rücklaufbeginn und -ende. Nur Eroberungen verändern Besitzerkarte und Punktestand; Rücklaufereignisse verändern ausschließlich Position und Bewegungsstatistik. Schrittoffsets und Fehlerzeitpunkte erlauben korrektes Spulen.

Die Runde wird vorab im Worker berechnet und über zehn bis fünfzehn Sekunden abgespielt. Pause, Spulen und Wiederholen beeinflussen das Ergebnis nicht. Änderungen gelten ab dem nächsten Kampf. Der Wechsel in einen anderen Browser-Tab pausiert die Wiedergabe.

Canvas zeichnet unabhängig von Vue in jedem Display-Frame. Punktestände und Zeitleiste aktualisieren höchstens 20-mal pro Sekunde. Rasteränderungen werden in 64-Zellen-Kacheln übertragen; vorberechnete Farbabstufungen erzeugen den dezenten Spur-Glow ohne Blur über die gesamte Arena. Der Glow der bewegten Punkte verwendet vorberechnete Sprites.

Der Canvas trennt logische Auflösung und Anzeigegröße, berücksichtigt Display-Pixeldichte und zeichnet keine Gitterlinien. Ein dezenter Saum verbessert die Lesbarkeit feiner Spuren, erzeugt aber keine Punkte. Köpfe verwenden vorberechnete Glow-Sprites; ein gestrichelter Ring zeigt den automatischen Rücklauf.

## Eigene Strategien und Editor

Das [Editor-Handbuch](public/docs/editor-handbuch.html) ist in allen Editoren verlinkt und [direkt online lesbar](https://algofights.de/docs/editor-handbuch.html). Es erklärt die APIs, Ein- und Rückgaben, Beispiele, Speichern und Fehlersuche. Algo Sim und Graph Sim öffnen nur den Quellcode des ausgewählten Verfahrens. „Eigenen Algorithmus bauen“ beginnt mit einem leeren Codefeld. Vier zusätzliche Arena-Beispiele lassen sich direkt laden.

Zu jedem eingebauten Algorithmus und Arena-Beispiel gibt es neben dem ausführbaren JavaScript eine kopierbare Java-17-Referenz und Pseudocode. Die Java-Varianten verwenden Java-Datenstrukturen und passende Eingabetypen. Bei gleichen Prioritäten kann sich die Besuchsreihenfolge von JavaScript unterscheiden. Eigene Strategien werden in JavaScript geschrieben und ausgeführt.

```js
function nextMove(state, memory) {
  const choices = state.availableMoves;
  return {
    direction: choices[Math.floor(state.random() * choices.length)],
    memory: { decisions: (memory.decisions || 0) + 1 },
  };
}
```

`state` liefert Position, Richtung, Score, Simulationsschritt, Rastergröße, Nachbarn, erlaubte Züge, `cell(x,y)` und Seed-Zufall. `returnTrips`, `afterReturn` und `returnSteps` beschreiben automatische Rückläufe; `restarts`/`restarted` bleiben kompatible ältere Namen. Während Rückläufen wird eigener Code nicht aufgerufen. Die Rasterkopie wird beim nächsten Aufruf mit allen seitdem entstandenen Eroberungen aktualisiert. Speicher bleibt erhalten.

CodeMirror bietet Syntaxhervorhebung. Eigene Hilfsfunktionen, Klassen und Datenstrukturen sind erlaubt. Strategien und Einstellungen liegen lokal im Browser; JSON-Import/-Export dient zum Sichern und Teilen eigenen Codes. Grenzen: 30 Strategien, je 50.000 Zeichen Code, 512 Zellabfragen pro Aufruf und 64 KiB UTF-8-JSON-Speicher. `nextMove` ist synchron und muss eine erlaubte Richtung zurückgeben.

Jede eigene Strategie läuft in einem separaten Blob-Worker innerhalb eines Iframes mit `sandbox="allow-scripts"`, ohne `allow-same-origin`. Die CSP blockiert Netzwerk und externe Ressourcen. Der echte Spielkern liegt in einem anderen Worker und validiert alle Entscheidungen. Private MessagePorts übertragen das Raster einmal und danach nur Änderungen und kompakte Zustände.

Budgets: 250 ms pro Zug, 45 Sekunden Vorbereitung mit eigenem Code und eine Sekunde für die drei Editor-Probezüge. Überschreitungen beenden den Worker; Abbrechen beendet alle Ausführungsumgebungen der Runde. Die Sandbox ist für eigenen, geprüften lokalen Code gedacht, keine vollständige Garantie gegen Browserfehler oder absichtliche extreme Speichernutzung. DOM, Netzwerk, Browser-Speicher und externe Module stehen nicht zur Verfügung.

## Algo Sim: Wegsuche auf realen Straßen

Der Reiter simuliert **Dijkstra, A\*, bidirektionalen Dijkstra, BFS, DFS und Greedy Best-First** auf realen OpenStreetMap-Ausschnitten von Mannheim mit den Quadraten, Berlin-Mitte, Barcelona-Eixample, Amsterdams Grachten und New York rund um den Central Park in Manhattan. Start und Ziel werden per Kartenklick auf einen nahegelegenen Straßenknoten gesetzt oder über Straßennamen gewählt. Verschieben, Zoomen, Pause, Einzelschritte, Spulen, Vergleich aller Verfahren und JSON-Ergebnisexport sind integriert.

Ein Worker lädt den lokalen Datenschnappschuss, erzeugt den gerichteten Graphen und berechnet Suchspur und Route. Canvas zeichnet die reale Segmentgeometrie: Grundnetz dunkel, expandierte Suchbaum-Kanten blau, rekonstruierte Route grün. Die anschließende Fahrt entlang der Route ist proportional zur zurückgelegten Strecke.

Am Ende von Algo Sim vergleicht eine dauerhaft sichtbare Tabelle alle sechs eingebauten und alle lokal gespeicherten Routenalgorithmen automatisch mit identischen Endpunkten. Sie zeigt Rechenzeit, Strecke, Mehrweg gegenüber Dijkstra, tatsächlich erreichte kürzeste Strecke, Expansionen und Status. Die allgemeine Optimalitätsgarantie steht getrennt unter dem Namen. Änderungen an Karte, Punkten oder Code verwerfen alte Werte. Eigener Code läuft nacheinander isoliert mit fünf Sekunden Zeitlimit; der Vergleich ist abbrechbar und als JSON exportierbar. Einzellaufzeiten sind Richtwerte, keine belastbaren Benchmarks.

- Kostenfunktion: geografische Segmentlänge in Metern. Gemeinsame OSM-Knoten definieren Verbindungen; reine Bildkreuzungen erzeugen keine künstlichen Kreuzungen.
- Vereinfachtes Pkw-Modell: Einbahnrichtungen, Kreisverkehre und gesperrte/private Straßen werden ausgewertet. Keine Abbiegerelationen, Ampelzeiten, Baustellen oder Live-Verkehrsdaten. Keine Navigationsanwendung.
- Dijkstra und A* verwenden einen binären Min-Heap. A* nutzt die konsistente Luftlinie als zulässige Heuristik. Bidirektionaler Dijkstra sucht auf eingehenden Kanten rückwärts und stoppt erst bei einer abgesicherten besten Verbindung.
- BFS minimiert Kanten statt Meter; DFS und Greedy besitzen keine Kürzestweggarantie. Die Vergleichstabelle zeigt Distanz, Expansionen und einzelne Rechenzeiten ohne daraus belastbare Benchmarks abzuleiten.
- Es sind reale Stadt-Ausschnitte, nicht die kompletten Städte. Wasser-/Parkkonturen sind vereinfachte Orientierung. Ausschnittsgrenzen können Verbindungen abschneiden.
- Datenschnappschüsse stehen unter `public/maps/` mit Bounding Box und Zeitstempeln. Copyright und ODbL: [public/maps/LICENSE.md](public/maps/LICENSE.md). Die Rohdaten sind direkt herunterladbar. `src/routing/cities.json` definiert Namen, Ausschnitte und gültige Standard-Endpunkte gemeinsam für Oberfläche und Downloadskript. `node scripts/fetch-city-maps.mjs` aktualisiert alle Städte bewusst manuell; angehängte Stadt-IDs wählen einzelne Downloads aus. Normale Builds laden keine externen Kartendaten.

## Graph Sim: Wegsuche auf Lehrgraphen

Elf Vorlagen reichen von der **Abkürzung** mit fünf Knoten über Baum, Leiternetz, Zyklus, Stern, bipartite und vollständige Graphen bis zum **Clusternetz** mit 32 Knoten. Ein gerichteter Schichtgraph und getrennte Komponenten zeigen, wie Kantenrichtungen und Erreichbarkeit zusammenhängen. Gewichte und Richtungen sind unabhängig schaltbar. Ungerichtete Kanten gelten in beide Richtungen. Ohne Gewichte kostet jede Kante 1. Start und Ziel sind frei wählbar.

Der **Graph Builder** legt eigene Graphen an oder öffnet eine Kopie der gewählten Vorlage. Die Zeichenfläche unterstützt Knotenplatzierung, Verschieben und das Verbinden zweier Knoten. Kosten und Richtung lassen sich nachträglich ändern. Pro Graph sind bis zu 32 Knoten, 96 Kanten und ganzzahlige Kosten von −999 bis 999 möglich. Pro gerichtetem Knotenpaar gibt es höchstens eine Kante; Gegenkanten und gerichtete Schlingen sind erlaubt. Start, Ziel und Kanteneinstellungen werden mit bis zu 30 eigenen Graphen im Browser gespeichert. Eigene Graphen nutzen dieselbe Wiedergabe und dieselben Algorithmen wie die Vorlagen.

Unter **Notation** erscheinen Knoten- und Kantenmenge, Kantengewichte, Grade, Adjazenzliste und Matrizen für den aktuell eingestellten Graphen. Die Auswertung trennt Pfadlänge `k`, Pfadgewicht `w(p)` und den durch eine unabhängige Dijkstra-Suche berechneten Referenzwert `δ(s,t)`. Eingebaute Algorithmen zeigen ihre Auswahl- und Aktualisierungsregeln. Eigene Algorithmen können eine optionale mathematische Beschreibung im Editor hinterlegen. Sie wird lokal gespeichert und mit dem JSON-Codeexport übertragen.

Direkt unter dem Graphen zeigt der **Suchverlauf als Arrays** den Initialzustand und nach jedem Suchschritt die aufgezeichneten Werte von `dis` und `pre`. Hervorgehobene Einträge haben sich gegenüber dem vorherigen Schritt geändert. Eigener Code kann seine Live-Arrays mit `graph.track(dis, previous)` registrieren. Die Vorgängerkanten-IDs werden für die Anzeige in Knotenbeschriftungen übersetzt.

Die sechs Suchverfahren verwenden dieselben Implementierungen wie Algo Sim. Die Start-Ziel-Wegsuche setzt nichtnegative Kantenkosten voraus; negative Kosten werden im Lehrlabor mit Bellman–Ford und Floyd–Warshall untersucht. A* verwendet den geradlinigen Modellabstand, skaliert mit dem kleinsten Verhältnis aus Kantenkosten und geometrischer Kantenlänge. Die Wiedergabe markiert Knoten und Suchkanten, spielt den gefundenen Weg animiert ein und trennt Suchschritte, Wegkanten und Gesamtkosten. Ein Schritt entspricht einem `trace`-Aufruf. Nach 1 bis 500 protokollierten Schritten beendet ein weiterer Aufruf die Suche mit der bis dahin erzeugten Spur. Die Wiedergabe ist unabhängig vom Suchlimit und lässt sich pausieren, spulen und schrittweise steuern.

Der Graph-Editor nutzt `findRoute(graph)` und speichert eigene Varianten getrennt von Algo Sim. Für eigene Algorithmen gelten das Schrittlimit für `graph.trace()` und zusätzlich fünf Sekunden Laufzeit im isolierten Worker. Details und Beispielcode stehen im [Editor-Handbuch](public/docs/editor-handbuch.html#graph-sim).

## Graph-Lehrlabor und String Sim

Das Graph-Lehrlabor enthält vollständige BFS/DFS mit Farben und Zeitstempeln, Kantenklassen und Zyklenerkennung, topologisches Sortieren, Pfadaufzählung, Dijkstra mit indiziertem Heap, Bellman–Ford, Floyd–Warshall, Union-Find, Komponenten-DFS, Kosaraju, Kruskal, Prim und Baum-/XML-Analysen mit XPath. Die zentralen Zustände lassen sich Schritt für Schritt verfolgen; negative Zyklen und getrennte Komponenten werden ausdrücklich behandelt.

String Sim ergänzt naive und dynamische Levenshtein-Distanz, naive und dynamische längste gemeinsame Teilzeichenketten, längste gemeinsame Teilfolgen, naive Mustersuche und KMP samt Verschiebungstabelle. DP-Tabellen zeigen aktuelle Zellen, benötigte Nachbarn und Rekonstruktionswege.

Für 21 Lehrverfahren stehen einzeln editierbare JavaScript-Funktionen sowie Java-17- und Pseudocode-Referenzen bereit. Eine gemeinsame Replay-Schnittstelle erlaubt eigenen Algorithmen beliebige Arrays und Matrizen. Der statische Build enthält alle Daten und Ressourcen. Details, API, Voraussetzungen und Begrenzungen: [Lehrlabor-Handbuch](docs/lehrlabor.md).

## Quellstruktur

Die UI verwendet Systemschriften und neutrale Bedienelemente. Farben kennzeichnen Daten und Zustände; Regeln: [docs/ui-guidelines.md](docs/ui-guidelines.md).

```text
src/core/        Arenaregeln, Strategien, Masken, Seed-Zufall und Replay-Typen
src/routing/     OSM-Graph, Entfernungen und sechs echte Suchalgorithmen
src/graph/       Lehrgraphen, Builder, Heuristik und SVG-Stile
src/lab/         Lehrverfahren, Notation, Java-Referenzen und allgemeine Replays
src/workers/     Simulation, Wegsuche und Ausführungsbudgets
src/render/      Arena- und Straßenkarten-Renderer
src/content/     Ladbare Beispiele und unveränderte Originalquellen für die Editoren
src/services/    Worker-Lebenszyklus, Sandbox und lokale Speicherung
src/components/ Arena, Code-Editor, Algo Sim und Graph Sim
public/docs/    Editor-Handbuch mit Funktionsreferenz und Beispielen
public/maps/    Reale OSM-Datenschnappschüsse und Lizenznachweis
```

Neue Arenaformen werden als Maskenfunktionen ergänzt. Routing-Algorithmen verwenden dieselben Graphen und dieselbe Kostenfunktion, damit Vergleiche fachlich nachvollziehbar bleiben. Die Arena verwendet `builtin-arena.js`; die sechs Routing-Verfahren liegen einzeln in `src/routing/algorithms/`. Worker und Editor nutzen dieselben Originaldateien. Die Editoransicht lädt genau das gewählte Verfahren als Rohtext, ohne Importzeile. `graph.createQueue()` stellt einen binären Min-Heap bereit; eigene Datenstrukturen sind ebenfalls möglich. TypeScript-Deklarationen typisieren die Schnittstellen.
