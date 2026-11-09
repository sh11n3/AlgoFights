# Gestaltungsregeln für die Oberfläche

AlgoFights ist eine Simulation mit Werkzeugoberfläche. Arena, Bedienung und Messwerte bestimmen die Gestaltung.

- Teilnehmerfarben kennzeichnen Besitzer, Spuren, Legenden und tatsächliche Anteile. Sie färben keine Kartenränder, Überschriften oder Schmuckelemente ein.
- Oberflächen, Trennlinien, Navigation und Schaltflächen verwenden neutrale Farben. Aktive Auswahl, Tastaturfokus, Fehler und Bestätigungen müssen trotzdem eindeutig erkennbar bleiben.
- Keine dekorativen Verläufe, Glaseffekte, leuchtenden Rahmen oder Schatten. Die hellen Köpfe innerhalb der Arena bleiben Teil der Simulation. Die harten Farbstopps in Range-Reglern zeigen den Fortschritt und sind kein dekorativer Verlauf.
- Zusammengehörige Messwerte stehen in einer gemeinsamen Rangliste mit neutralen Trennlinien. Neue Informationen benötigen nicht automatisch eine weitere Karte.
- Systemschrift für die Oberfläche; Monospace für Code, Rasterkoordinaten und technische Werte. Keine zusätzlichen Schmuckschriften oder externen Schriftanfragen.
- Icons unterstützen Aktionen, wenn sie das Verständnis verbessern. Keine Icon-Kacheln vor beschrifteten Abschnitten, doppelten Pokale oder Badges für bereits offensichtliche Eigenschaften.
- Beschriftungen sind lesbar und sachlich. Keine Werbesätze, künstlichen Zahlenpräfixe oder ausschließlich dekorativen Großbuchstaben.
- Animationen zeigen Vorgänge oder Zustandswechsel an. Kein dauerhaftes dekoratives Pulsieren.
- In Graph, String und Algo Sim stehen die wichtigsten Eingaben und der Start im gleichen Bereich. Zusatzoptionen und Erklärungen werden bei Bedarf aufgeklappt. Die Schrittsteuerung und der Live-Zustand bleiben direkt an der Simulation.
- Auf schmalen Bildschirmen bricht die Hauptnavigation in Zeilen um. Die Arena und die PDF-Folie bleiben schnell erreichbar, auch wenn ihre Bearbeitung zusätzliche Felder benötigt.

Bei visuellen Änderungen Arena, Einstellungen, Teilnehmer, Rangliste, Editor samt Rückmeldungen sowie Vorbereitungs- und Regeldialog prüfen. Desktop und schmale Ansichten berücksichtigen. Vorhandene Farbzuordnungen, Fokusindikatoren und Fehlermeldungen erhalten.

## Hintergrund

Die Bezeichnung „KI-Stil“ ist eine subjektive Einordnung und kein verlässlicher Herkunftsnachweis. Die häufig kritisierte Kombination aus generischen Icons, Gradienten und wiederholten Kacheln beschreibt unter anderem [SYKES Marketing & Design](https://www.sykesmarketing.com/blog/this-looks-like-ai-does-it-matter/). Entscheidend für diese Anwendung ist die von [Nielsen Norman Group beschriebene Reduktion visueller Ablenkung](https://www.nngroup.com/articles/aesthetic-minimalist-design/): Darstellungselemente sollen die eigentliche Aufgabe unterstützen.
