# AlgoFIghts

Eine deutsche Browser-Arena, in der zwei bis vier Algorithmen freie Rasterzellen erobern. Vue 3, Composition API, TypeScript, Vite und Canvas 2D. Vollständig statisch, ohne Backend oder Accounts.

## Lokal starten

Node.js 22.12+ oder 24 und npm:

```sh
npm ci
npm run dev
```

Produktionsbuild und lokale Vorschau:

```sh
npm run build
npm run preview
```

`dist/` enthält die komplette Website. Vite verwendet relative Assetpfade; auch Hosting in einem Unterverzeichnis ist möglich. JavaScript, Web Worker und Iframe-Sandbox müssen im Browser erlaubt sein. Dateien über HTTP(S) bereitstellen, nicht mit `file://` öffnen.

## Spielregeln

- Zwei bis vier Teilnehmer, jede Strategie darf mehrfach vorkommen. Startzellen zählen je einen Punkt.
- Ein Zug bewegt den Punkt genau eine Zelle nach oben, rechts, unten oder links. Nur freie Zellen sind erlaubt.
- Jede eroberte Zelle bleibt dauerhaft belegt, auch für ihren Besitzer. Kein Backtracking und keine automatische Flächeneroberung.
- Alle aktiven Teilnehmer entscheiden anhand desselben Zustands vor dem Schritt. Bei identischem Ziel entscheidet ein separater Seed-Zufallsstrom. Verlierer bleiben stehen und dürfen im nächsten Schritt erneut entscheiden.
- Ohne freien Nachbarn stoppt ein Teilnehmer dauerhaft. Fehlerhafte eigene Strategien stoppen mit Fehlermeldung; bisherige Punkte bleiben erhalten.
- Ende: alle Zellen belegt oder alle Teilnehmer gestoppt. Unerreichbare Zellen bleiben frei. Die meisten Punkte gewinnen, Gleichstand ist möglich.

Kreis, Quadrat, Ring und vier verbundene Kammern stehen mit 256², 512² und 1.024² zur Auswahl. Standard: Kreis, 512², vier unterschiedliche Strategien, zwölf Sekunden Wiedergabe. Startpositionen werden mit einer Seed-Rotation auf gleichmäßig verteilte Winkel gelegt und auf die nächste gültige, unterschiedliche Zelle projiziert. Das ist eine geometrische Annäherung an Fairness, keine Garantie gleicher erreichbarer Flächen.

Eingebaut: rechtsorientiert, linksorientiert, Lookahead und Seed-Zufall. Lookahead untersucht höchstens 40 lokale Zellen je Zugoption. Es findet keine vollständige Flutfüllung pro Zug statt.

## Simulation und Replay

Die Simulation läuft in einem dedizierten Worker vor der Wiedergabe. Das Replay enthält pro Eroberung eine 32-Bit-Zahl (Zellindex + Teilnehmer) und Schrittoffsets. Startzellen, Wartezüge, Endpositionen und Fehlerzeitpunkte bleiben nachvollziehbar. Zwischen Bildern werden alle Ereignisse des übersprungenen Zeitabschnitts angewendet; keine Zelle geht verloren.

Wiedergabe: zehn bis fünfzehn Sekunden, Pause/Fortsetzen, Spulen, erneute Wiedergabe desselben Kampfs und neuer Kampf. Ein Wechsel in einen anderen Browser-Tab pausiert die Wiedergabe. Einstellungen werden erst beim nächsten Kampf übernommen. Die Dauer gilt für das Replay, nicht die Berechnungszeit. Der Canvas nutzt die logische Rasterauflösung unabhängig von seiner Anzeigegröße und berücksichtigt die Display-Pixeldichte.

Interne Entwicklungsprüfung auf dem Entwicklungsrechner: Standardkampf bei 512² etwa 0,4 s, bei 1.024² etwa 0,5 s reine Berechnung; tatsächliche Zeiten hängen von Browser, Rechner, Arena, Seed und Strategien ab. Es werden keine Tests beim Deployment ausgeführt.

## Eigene Strategien

Im Code-Labor steht ein CodeMirror-Editor mit JavaScript-Syntaxhervorhebung bereit. Strategien und Einstellungen werden lokal im Browser gespeichert. Benennen, Prüfen, Speichern, Löschen, Zurücksetzen sowie JSON-Import/-Export sind integriert. Die Bibliothek ist auf 30 Strategien mit je 50.000 Zeichen begrenzt.

```js
function nextMove(state, memory) {
  const moves = state.availableMoves;
  return {
    direction: moves[Math.floor(state.random() * moves.length)],
    memory: { turns: (memory.turns || 0) + 1 }
  };
}
```

| Wert | Bedeutung |
| --- | --- |
| `state.x`, `state.y`, `state.position` | Position, ganzzahlige Koordinaten ab 0; position ist `{ x, y }` |
| `state.width`, `state.height` | Logische Rastergröße |
| `state.direction` | `up`, `right`, `down` oder `left` |
| `state.score`, `state.step` | Eigene Punkte und aktueller Simulationsschritt |
| `state.neighbors[direction]` | `{ x, y, type, free }` für jede der vier Richtungen |
| `state.availableMoves` | Array der erlaubten Richtungen |
| `state.cell(x, y)` | `free`, `wall`, `self` oder `opponent`; maximal 128 Abfragen pro Zug; außerhalb ergibt `wall` |
| `state.random()` | Reproduzierbarer Zufall in `[0, 1)`; separater Strom je Teilnehmer |
| `memory` | Eigener Speicher, anfangs `{}`; über `return.memory` aktualisieren; JSON-kompatibel, maximal 16 KB |

`nextMove` ist synchron. Promises, fehlende/ungültige Richtungen, unerlaubte Züge und Exceptions führen zu einem Strategiefehler. Ohne zurückgegebenes `memory` bleibt der vorherige Speicher erhalten. Drei Probeaufrufe prüfen Syntax und Rückgabe vor dem Speichern; die tatsächliche Legalität prüft der Kern in jedem Spielzug erneut. Ein bestandener Probelauf ist keine Garantie für alle Spielsituationen.

Für reproduzierbares Verhalten ausschließlich `state.random()` verwenden, keine Uhrzeit, `Math.random()` oder andere äußere Quellen. Nach einem verlorenen Konflikt ändern sich weder Position noch Richtung; der eigene Speicher eines bereits ausgeführten Aufrufs bleibt erhalten.

### Isolation und Budgets

Jede eigene Strategie erhält einen separaten Blob-Worker in einem Iframe mit `sandbox="allow-scripts"`, **ohne** `allow-same-origin`. Eine restriktive CSP unterbindet Netzwerkzugriffe, weitere Frames, Formulare und externe Ressourcen. Kommunikation mit dem vertrauenswürdigen Simulations-Worker erfolgt direkt über private MessagePorts. Raster und Startzustand werden einmal kopiert, danach ausschließlich neue Zellbelegungen und kompakte Zugzustände übertragen. Der Spielkern besitzt das echte Raster und validiert alle Entscheidungen.

250 ms Zeitbudget pro Zug, 45 Sekunden Gesamtvorbereitung mit eigenen Strategien. Nach einem Timeout wird der betroffene Worker beendet; eingebaute Strategien und andere Teilnehmer können weiterlaufen. Abbrechen beendet alle zur Runde gehörenden Worker und entfernt das Iframe. Ein Neustart erstellt eine neue Umgebung. Im Editor gilt ein separates einsekündiges Zeitlimit für die Probezüge.

Dies ist eine lokale Entwicklungsfunktion für **eigenen, vertrauten Code**, keine öffentliche Plattform für fremde Programme und keine vollständige Sicherheitsgarantie. Browser-Sicherheitslücken, absichtliche Speicherauslastung und Ressourcenmissbrauch lassen sich damit nicht vollständig verhindern. Es gibt keinen Zugriff auf UI, Browser-Speicher oder das echte Spielraster. Unvertrauenswürdigen Code nicht importieren oder ausführen.

## Struktur

```text
src/core/        Typen, Seed-Zufall, Arenamasken, Strategien, Spielkern
src/workers/     Vertrauenswürdige Hintergrundsimulation und Zeitlimits
src/render/      Canvas-Renderer, Zellpuffer und vorberechnete Glow-Sprites
src/services/    Worker-Lebenszyklus, Sandbox und lokale Speicherung
src/components/ Arena-Canvas und nachgeladener CodeMirror-Editor
public/         Isolierter Strategie-Runner, Favicon und Apache-Konfiguration
scripts/        SFTP-Deployment und administrative Secret-Konfiguration
```

Neue Arenen über eine normalisierte Maskenfunktion in `src/core/arena.ts` ergänzen. Kern und Replay verwenden keine Vue- oder DOM-APIs.

## Hosting und automatisches Deployment

Alle Inhalte von `dist/` auf gewöhnlichen statischen Webspace hochladen. Für Apache setzt die mitgelieferte `.htaccess` `index.html` vor `index.htm`; die alte Provider-Startseite wird nicht gelöscht. Bei anderen Webservern die Startdatei entsprechend konfigurieren. HTTPS ist empfohlen. Es ist kein SPA-Routing und kein Backend erforderlich. Schriften werden aktuell von Google Fonts geladen, mit lokalen Systemschriften als Fallback; die Spielausführung benötigt keine externe API.

Der Workflow `.github/workflows/deploy.yml` veröffentlicht jeden Push auf `main` sowie manuell ausgelöste Runs:

1. `npm ci --no-audit --no-fund`
2. `npm run build` (TypeScript-Prüfung und Vite-Build)
3. `node scripts/deploy.mjs` (SFTP-Upload)

**Keine Tests im Deployment.** Secrets im GitHub-Repository unter Settings → Secrets and variables → Actions:

| Secret | Inhalt |
| --- | --- |
| `SFTP_HOST` | SFTP-Server |
| `SFTP_PORT` | Port, normalerweise 22 |
| `SFTP_USER` | Benutzername |
| `SFTP_PASSWORD` | Passwort |
| `SFTP_PATH` | Absoluter Webroot im SFTP-Konto, hier `/public_html` |
| `SFTP_FINGERPRINT` | Gepinnter SSH-Hostschlüssel als `SHA256:…` |

`scripts/configure-hosting.mjs` ist ein optionaler Administrationshelfer mit verdeckter stdin-Eingabe. Er prüft den GitHub-Account `sh11n3` und verschlüsselt Secret-Werte mit dem Repository-Public-Key vor der Übertragung. Beim ersten autorisierten SFTP-Verbindungsaufbau wird der Hostschlüssel erfasst und danach fest gepinnt (Trust on first use). Änderungen am Server-Hostschlüssel erfordern eine bewusste Aktualisierung des Fingerprints.

Upload-Reihenfolge: Ressourcen zuerst, `index.html` zuletzt per atomarem SFTP-Rename. Bestehende Dateien und ältere gehashte Assets werden nicht gelöscht, damit bereits geöffnete Browserseiten weiter funktionieren. Alte Assets bei Bedarf separat aufräumen. Zugangsdaten gehören ausschließlich in Secrets, niemals in Git, Frontend oder `.env`-Dateien im Build. Repository-Administratoren und autorisierte Workflows können Deployment-Secrets verwenden.
