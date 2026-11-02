# AlgoFights

Deterministische Raster-Simulation für zwei bis vier konkurrierende Algorithmen. Implementiert mit Vue 3, Composition API, TypeScript, Vite, Canvas 2D und Web Workern. Eigene Strategien lassen sich im integrierten JavaScript-Editor entwickeln.

## Entwicklung

Voraussetzung: Node.js 22.12+ oder 24 und npm.

```sh
npm ci
npm run dev
```

```sh
npm run build   # TypeScript-Prüfung und Produktionsbuild
npm run preview # Lokale Vorschau des Builds
```

Der Build in `dist/` besteht ausschließlich aus statischen Dateien. Relative Assetpfade erlauben auch ein Unterverzeichnis. Die Anwendung benötigt HTTP(S), JavaScript, Web Worker und sandboxed Iframes. Es gibt kein Backend und kein serverseitiges Routing.

## Spielregeln

- Jeder Teilnehmer besitzt einen bewegten Punkt. Startzellen und jede neu eroberte Zelle geben jeweils einen Punkt.
- Reguläre Züge erfolgen eine Rasterzelle nach oben, rechts, unten oder links. Grenzen, Hindernisse und belegte Zellen sind gesperrt, einschließlich der eigenen Spur.
- Alle Teilnehmer entscheiden anhand desselben Zustands vor dem Schritt. Wählen mehrere dieselbe freie Zelle, gewinnt genau einer durch Seed-Zufall. Die anderen warten diesen Schritt.
- Hat ein Punkt keinen freien Nachbarn, wartet er. Erst wenn alle Punkte blockiert sind, beginnt ein neuer Durchlauf: Jeder setzt an einer freien Zelle am Rand des eigenen Gebiets fort. Ist dort keine verfügbar, wählt der Kern Seed-basiert eine freie Zelle in einem Restbereich. Die Fortsetzung ist ein eigener Schritt und erobert genau eine Zelle. Es wird keine Fläche pauschal eingefärbt. Leistungsfähigere Strategien können so länger punkten, während eingeschlossene Gegner warten.
- Auch getrennte, zuvor eingeschlossene Restbereiche werden so besucht. Die Runde endet ausschließlich bei **100 % Belegung aller bespielbaren Zellen**.
- Ungültige Züge, Laufzeitfehler oder Zeitüberschreitungen eigener Strategien werden angezeigt. Für diesen Teilnehmer übernimmt die eingebaute Ersatzstrategie „Geradeaus“. Dadurch beendet auch ein Kampf mit ausschließlich fehlerhaften Teilnehmern die Arena vollständig.
- Die meisten Punkte gewinnen; Gleichstände sind möglich. Jedes Ergebnis enthält genau so viele Punkte wie bespielbare Zellen.

Kreis, Quadrat, Ring und verbundene Kammern sind als Masken verfügbar. Rasterauflösungen: 256², 512² und 1.024², Standard 512². Startpositionen liegen auf Seed-rotierten, gleichmäßig verteilten Winkeln und werden auf die nächste gültige Zelle projiziert. Geometrie und diskretes Raster können weiterhin Vor- und Nachteile erzeugen.

## Eingebaute Strategien

| Strategie        | Entscheidung                                                               |
| ---------------- | -------------------------------------------------------------------------- |
| Rechtsorientiert | Rechts, geradeaus, links, zurück relativ zur Bewegungsrichtung             |
| Linksorientiert  | Links, geradeaus, rechts, zurück                                           |
| Lookahead        | Begrenzte lokale Erreichbarkeit, höchstens 40 untersuchte Zellen je Option |
| Zufall           | Seed-basierte Wahl aus erlaubten Zügen                                     |
| Geradeaus        | Hält die Richtung bis zu einem Hindernis                                   |
| Zickzack         | Wechselt zwischen horizontalen und vertikalen Zügen                        |
| Zeilenläufer     | Wechselnde horizontale Bahnen nach Zeilenparität                           |
| Spirale          | Nach außen wachsende rechtwinklige Spirale, angepasst an Hindernisse       |
| Kantenläufer     | Bevorzugt Zellen entlang belegter Bereiche und Arenagrenzen                |
| Invasion         | Sucht gegnerische Spuren über begrenzte Sichtlinien                        |

Jede Strategie darf mehrfach teilnehmen. Zufallsströme für Entscheidungen, Zellkonflikte und Fortsetzungen sind voneinander getrennt. Identische Einstellungen und deterministische Strategien erzeugen dasselbe Ergebnis.

## Spielkern und Replay

`src/core/` verwendet keine Vue- oder DOM-APIs. Die Arenamaske ist ein `Uint8Array`, die Besitzerkarte ein `Int8Array`. Ein dichter Pool freier Zellen ermöglicht Zugriffe und Entfernen in O(1). Teilnehmer sammeln freie Randkandidaten beim Erobern; belegte Kandidaten werden bei Bedarf verworfen. Weder Fortsetzungen noch gewöhnliche Strategien benötigen eine vollständige Flutfüllung pro Zug.

Die Simulation läuft vorab in einem Worker. Das Replay speichert pro eroberter Zelle ein 32-Bit-Ereignis mit Zellindex, Teilnehmer und einem Bit für Fortsetzungen, dazu Schrittoffsets und Fehlerzeitpunkte. Es enthält jede einzelne Eroberung und keine künstliche Abschlussfüllung.

Die Wiedergabe dauert unabhängig von der Berechnungszeit zehn bis fünfzehn Sekunden, standardmäßig zwölf. Zwischen Bildern werden alle fälligen Ereignisse angewendet. Pause, Fortsetzen, Spulen und Wiederholen ändern das Ergebnis nicht. Einstellungen gelten erst für die nächste Runde. Ein Wechsel in einen anderen Browser-Tab pausiert das Replay.

Der Renderer trennt logische Rastergröße und Canvas-Anzeigegröße, berücksichtigt die Display-Pixeldichte und verwendet keine sichtbaren Rasterlinien. Ein dezenter farbiger Saum macht schmale Spuren besser erkennbar. Er ist ausschließlich eine Darstellungshilfe, erzeugt keine Punkte und übermalt keine belegten Zellen anderer Teilnehmer. Aktive Köpfe verwenden vorberechnete Glow-Sprites.

## Eigene Algorithmen

Der CodeMirror-Editor unterstützt JavaScript-Syntaxhervorhebung, eigene Hilfsfunktionen, Klassen und Datenstrukturen. Strategien und Einstellungen werden lokal im Browser gespeichert. Benennen, Prüfen, Speichern, Löschen, Zurücksetzen und JSON-Import/-Export sind integriert. Grenzen: 30 Strategien mit jeweils 50.000 Zeichen Code.

```js
function nextMove(state, memory) {
  const moves = state.availableMoves;
  const direction = moves[Math.floor(state.random() * moves.length)];
  return {
    direction,
    memory: { turns: (memory.turns || 0) + 1 },
  };
}
```

| Wert                                   | Bedeutung                                                                                    |
| -------------------------------------- | -------------------------------------------------------------------------------------------- |
| `state.x`, `state.y`, `state.position` | Eigene Position; `position` ist `{ x, y }`, Koordinaten ab 0                                 |
| `state.width`, `state.height`          | Logische Rastergröße                                                                         |
| `state.direction`                      | `up`, `right`, `down` oder `left`                                                            |
| `state.score`, `state.step`            | Eigene Punkte und Simulationsschritt                                                         |
| `state.neighbors[direction]`           | `{ x, y, type, free }` je Richtung                                                           |
| `state.availableMoves`                 | Erlaubte Richtungen als Array                                                                |
| `state.cell(x, y)`                     | `free`, `wall`, `self` oder `opponent`; maximal 512 Abfragen je Zug; außerhalb ergibt `wall` |
| `state.random()`                       | Reproduzierbarer Zufall in `[0, 1)`                                                          |
| `state.restarts`                       | Anzahl bisheriger Fortsetzungen an einer anderen Position                                    |
| `state.restarted`                      | Ob im vorherigen Schritt eine solche Fortsetzung stattfand                                   |
| `memory`                               | JSON-kompatibler Speicher, anfangs `{}`, maximal 64 KiB UTF-8-JSON; getrennt pro Teilnehmer  |

`nextMove` ist synchron. Die Rückgabe muss ein Objekt mit gültiger `direction` sein. `memory` ist optional; ohne Rückgabe bleibt der bisherige Speicher bestehen. Er bleibt auch nach verlorenen Konflikten und Fortsetzungen erhalten. Einen Neustart der gesamten Runde beginnt jeder Teilnehmer mit frischem Speicher.

Eigener Code entscheidet nur reguläre Züge. Fortsetzungen übernimmt der Kern; dafür wird `nextMove` nicht aufgerufen. Beim nächsten Aufruf wird die Rasterkopie mit allen seit dem letzten Aufruf entstandenen Belegungen synchronisiert. `restarts` ermöglicht es, eigene Planungsdaten bei Bedarf zurückzusetzen.

Drei Probeaufrufe prüfen Syntax und grundlegende Rückgaben vor dem Speichern. Im Kampf validiert der Spielkern jeden Zug erneut. Für Reproduzierbarkeit ausschließlich `state.random()` nutzen; `Math.random()`, Uhrzeit und ähnliche Quellen sind nicht deterministisch.

### Isolation und Ausführungsgrenzen

Jede eigene Strategie läuft in einem separaten Blob-Worker innerhalb eines Iframes mit `sandbox="allow-scripts"`, ohne `allow-same-origin`. Eine CSP blockiert Netzwerkzugriffe und externe Ressourcen. Der vertrauenswürdige Spielkern läuft in einem anderen Worker und besitzt das echte Raster.

Private MessagePorts übertragen den Raster-Startzustand einmal und anschließend ausschließlich kompakte Zustände und alle neu belegten Zellen seit dem letzten Aufruf. Benutzercode kann den echten Spielzustand nicht direkt verändern.

Budgets: 250 ms je Zug, 45 Sekunden Vorbereitung für eigenen Code, eine Sekunde für Editor-Probezüge. Bei einer Überschreitung wird der betreffende Worker beendet und die Ersatzstrategie übernimmt. Abbrechen beendet alle Worker der Runde; Neustart erstellt neue Ausführungsumgebungen.

Die Sandbox ist für eigenen, vertrauten lokalen Code gedacht. Browser-Sicherheitslücken oder absichtliche extreme Speichernutzung lassen sich damit nicht vollständig ausschließen. Externe Module, DOM-Zugriffe, Netzwerk und Browser-Speicher sind innerhalb der Strategie nicht verfügbar.

## Quellstruktur

```text
src/core/        Spielregeln, Strategien, Arenamasken, Seed-Zufall und Replay-Typen
src/workers/     Hintergrundsimulation und Zeitlimits
src/render/      Canvas-Renderer und Glow-Sprites
src/services/    Worker-Lebenszyklus, Sandbox und lokale Speicherung
src/components/ Arena-Canvas und bei Bedarf geladener Code-Editor
public/         Isolierter Strategie-Runner und statische Ressourcen
```

Neue Arenen lassen sich als normalisierte Maskenfunktion in `src/core/arena.ts` ergänzen. Eingebaute Strategien werden über `src/core/strategies.ts` und die Beschreibungen in `src/core/types.ts` erweitert.
