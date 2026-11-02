# OpenStreetMap-Datenausschnitte

Die Dateien `berlin.json` und `mannheim.json` enthalten echte OpenStreetMap-Daten von © OpenStreetMap-Mitwirkenden. Diese Kartendaten stehen unter der **Open Database License 1.0 (ODbL)**:

- https://www.openstreetmap.org/copyright
- https://opendatacommons.org/licenses/odbl/1-0/

Die Datenlizenz betrifft die Karten-Datenbank; sie bestimmt nicht automatisch die Lizenz des Anwendungsquellcodes.

Herkunft: einmaliger, begrenzter Overpass-Export über den auf der OSM-Wiki gelisteten Europa-Server `https://ovp.dresel.systems/api/interpreter`. Quelle, OSM-Zeitstempel, Downloadzeit, Mittelpunkt und Bounding Box stehen in jeder Datei. Die Daten sind ein Schnappschuss, kein Live-Dienst. Ein Refresh ist bewusst nur mit `node scripts/fetch-city-maps.mjs` möglich und gehört nicht zum normalen Build oder Deployment.

Die Dateien stehen unverändert als Download in Algo Sim bereit. Für den abgeleiteten gerichteten Routing-Graphen werden befahrbare Straßen ausgewählt, Koordinaten projiziert, positive Segmentlängen berechnet und Einbahnrichtungen ausgewertet. Punkte außerhalb des angegebenen Ausschnitts werden aus dem Routing ausgeschlossen. Wasser- und Park-Ways dienen als vereinfachte Orientierung; komplexe Multipolygon-Geometrien, Gebäude und weitere kartografische Details sind nicht vollständig dargestellt.

Das Modell berücksichtigt keine Abbiegerelationen, aktuellen Baustellen, Ampelwartezeiten oder Live-Verkehrsdaten. Es ist für Algorithmusvergleiche und Unterricht gedacht.
