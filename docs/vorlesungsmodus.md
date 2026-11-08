# Vorlesungsmodus

Der Browser zeigt lokale PDF-Folien und legt bedienbare Simulationen darüber. Die PDF wird weder geändert noch hochgeladen; die interaktiven Bereiche funktionieren innerhalb von AlgoFights.

## Eine Vorlesung vorbereiten

1. **Vorlesung → PDF öffnen** und eine lokale PDF auswählen.
2. Die gewünschte Folie öffnen. **Vorhandenes Beispiel auswählen** bietet 39 vorbereitete Beispiele aus allen Simulationsbereichen. Alternativ einen selbst erzeugten Beispiel-Link einsetzen.
3. **Auf Folie einsetzen** fügt einen Simulationsbereich hinzu. Die Kopfzeile verschiebt ihn, die rechte untere Ecke verändert seine Größe. Position und Größe können auch in Prozent eingegeben werden.
4. **Berechnen** bereitet den Ablauf vor. Mit den üblichen Wiedergabesteuerungen abspielen, pausieren, spulen oder Einzelschritte untersuchen. **Einstellungen** öffnet die Eingaben des jeweiligen Simulators.
5. Über das Speichersymbol in der Bereichskopfzeile die aktuellen Eingaben für diese Folie **übernehmen**. Dabei bleibt der laufende Ablauf erhalten. Das Vergrößerungssymbol öffnet denselben Bereich groß; erneutes Betätigen oder Escape führt zurück.
6. **Projekt exportieren** sichert eine JSON-Datei. Das Projekt wird zusätzlich im lokalen Browser-Speicher gehalten. Zum Wiederöffnen dieselbe PDF auswählen, gegebenenfalls vorher das Projekt importieren.

**Präsentieren** blendet die Vorbereitung aus und fordert Vollbild an. Ist Vollbild nicht verfügbar, bleibt eine Ansicht über die gesamte Browserfläche. Pfeile und Bild auf/ab wechseln Folien, wenn kein Bedienelement der Simulation den Fokus hat. Beim Folienwechsel beginnt deren Simulation beim nächsten Öffnen wieder am Anfang. Escape beendet die Präsentationsansicht.

Zum Weitergeben PDF und JSON-Projekt gemeinsam bereitstellen. Eine SHA-256-Prüfsumme verhindert, dass Zuordnungen versehentlich auf einer anderen PDF erscheinen. Bei einer geänderten PDF kann bewusst eine neue Vorlesung begonnen werden; die bisherigen Zuordnungen werden erst nach Bestätigung ersetzt.

## Feste und eigene Beispiele

Unter **Beispiele** sind alle vorbereiteten Verfahren über kurze Links erreichbar:

| Beispiel                    | Link                                                                |
| --------------------------- | ------------------------------------------------------------------- |
| Dijkstra mit Live-Zuständen | [Graph Dijkstra](https://algofights.de/#beispiel/graph-dijkstra)    |
| Floyd–Warshall              | [Graph Floyd–Warshall](https://algofights.de/#beispiel/graph-floyd) |
| Knuth–Morris–Pratt          | [String KMP](https://algofights.de/#beispiel/string-kmp)            |
| Straßenkarte Berlin         | [Berlin](https://algofights.de/#beispiel/stadt-berlin)              |
| Ringarena                   | [Arena Ring](https://algofights.de/#beispiel/arena-ring)            |

In Arena, Algo Sim, Graph Sim und String Sim erstellt **Beispiel-Link** einen Link aus den aktuellen Eingaben. **Kopieren** dient etwa zum Verlinken in einem Foliensatz, **In Vorlesung verwenden** wählt das Beispiel für die aktuelle Vorlesung aus. Berechnete Replays werden nicht mitgespeichert; sie werden mit denselben Eingaben neu berechnet.

Für eigene Graphen im **Graph Builder** bauen, Gewichte und Richtung festlegen und Start/Ziel auswählen. Unter **Verfahren für Beispiel-Link** das gewünschte eingebaute Verfahren wählen, danach den Link erzeugen. Die Geometrie und sämtliche Kanten stehen im Link, unabhängig von lokal gespeicherten Graphen. Ein vorheriges Speichern ist nicht erforderlich.

Eigene Zeichenketten, Schrittlimits, Suchumfang, Tempo, Arena-Seeds und Kartenendpunkte können ebenfalls geteilt werden. Kartenziele sind Koordinaten, die beim Laden auf Straßenknoten gesetzt werden. Ein später aktualisierter Kartenschnappschuss kann Ergebnisse ändern; bei abweichendem gespeicherten OSM-Stand zeigt die Anwendung einen Hinweis.

## Technische Umsetzung und Grenzen

- Hash-Routen (`#vorlesung`, `#beispiele`, `#beispiel/<id>`, `#beispiel=<daten>`) funktionieren ohne serverseitige Weiterleitungsregeln. Der Snapshot verwendet versionsmarkiertes JSON in UTF-8/Base64url. Er ist lesbar, nicht verschlüsselt. Das URL-Fragment wird bei HTTP-Anfragen nicht an den Server übertragen.
- Alle eingehenden Daten werden validiert: bekannte Verfahren, begrenzte Graphen, gültige Indizes, endliche Koordinaten und Zahlen, begrenzte Eingaben. Unbekannte Zusatzfelder werden verworfen. Links und Projekte führen keinen mitgelieferten Programmcode aus. Eigene Editorvarianten können vor Ort ausprobiert werden, werden aber nicht als ausführbarer Code im Link oder Vorlesungsprojekt gespeichert.
- PDF.js wird bei Bedarf lokal aus dem statischen Build geladen. Ein eigener Worker verarbeitet PDF-Daten; die Ansicht rendert ausschließlich Seiten als Canvas, keine PDF-Skripte, Formulare oder aktiven Annotationen. Fonts, CMaps und WASM stammen aus derselben Installation, ohne CDN. Die PDF.js-Lizenz liegt im Build unter `pdf-assets/LICENSE` (Apache-2.0).
- Grenzen: 100 MiB und 2.000 Seiten pro PDF, 2 MiB pro Projektimport, 200 Simulationsbereiche insgesamt und sechs pro Folie. Graphen behalten ihre Grenzen von 32 Knoten und 96 Kanten. Große Bereiche lassen sich innerhalb der Folie bedienen oder vergrößern.
- Projektdateien enthalten Titel, PDF-Dateinamen, Größe, Seitenzahl, Prüfsumme, Positionen und Simulations-Snapshots. Die eigentlichen PDF-Daten und PDF-Passwörter werden nicht gespeichert. Die Originaldatei muss nach Verlassen oder Neuladen des Vorlesungsmodus erneut gewählt werden.
- Ein Beispiel-Link umgeht keine Website-Anmeldung. Die Anwendung verwendet keine Cloud-Synchronisierung. Browser-Speicher kann gelöscht oder begrenzt sein; Projektdateien daher vor einer Vorlesung exportieren.

`npm run dev` und `npm run build` kopieren die benötigten PDF.js-Ressourcen automatisch nach `public/pdf-assets/`. Diese generierten Dateien werden nicht im Repository verwaltet. Der Produktionsbuild bleibt vollständig statisch.
