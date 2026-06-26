# Mock-Daten-Visualisierungs-Check (MVP) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Claude soll wiederholbar verifizieren können, dass die bestehenden Mock-Daten korrekt als Timeline visualisiert werden — via eine handabgeleitete Ground-Truth-Referenz, ein computer-use-Runbook und eine CLAUDE.md-Anweisung.

**Architecture:** Drei Dokumente, kein neues Test-Tooling und kein Produktionscode. (1) Eine Ground-Truth-Markdown-Datei mit den erwarteten Timeline-Blöcken für `public/mock-data.json`, von Hand aus den Aggregationsregeln abgeleitet und einmalig gegen die echte Pipeline verifiziert. (2) Ein Runbook, das Claude per `npm run dev:mock` + computer-use abarbeitet. (3) Eine CLAUDE.md-Ergänzung, die den Check in den Wrapping-up/Vor-Release-Workflow einbindet.

**Tech Stack:** Markdown-Dokumentation; bestehende Skripte (`npm run dev:mock`, `npm run generate:mock`); computer-use MCP (on-demand, kein CI).

## Global Constraints

- Mock-Daten existieren NUR für Entwicklung/Tests via `--mock-data` — niemals Fake-Daten in echte Tracking-Pfade einspeisen.
- Lokal-first / Privacy-first: keine Netzwerkübertragung, keine Telemetrie hinzufügen.
- Conventional Commits (`docs:` für diese reinen Dokumentationsänderungen).
- Aggregationsregeln sind autoritativ in `docs/Engineering Design Dokument.md` §2.2 — nicht aus dem Code neu erfinden.
- Ground Truth wird unabhängig aus den Regeln abgeleitet (kein Generator aus derselben Pipeline — Zirkularität vermeiden) und einmalig gegen die Pipeline-Ausgabe abgeglichen.
- Mock-Daten liegen auf dem Kalendertag **2024-01-01**, Intervall **5 Minuten**.

## Verifizierte Ground-Truth-Werte (bereits gegen die echte Pipeline abgeglichen)

`public/mock-data.json` → `TimelineGenerator` (5-Min-Intervall, 90 Heartbeats) ergibt exakt:

| # | Start (UTC) | Start (lokal, CET = UTC+1) | Dauer | Typ | Titel |
|---|-------------|----------------------------|-------|-----|-------|
| 1 | 08:00 | 09:00 | 5 min | appWindow | Google Chrome — „Aggregate to visible" |
| 2 | 08:05 | 09:05 | 5 min | appWindow | Explorer — „Aggregate to visible only for 5 min" |
| 3 | 08:10 | 09:10 | 5 min | appWindow | Google Chrome — „Aggregate to visible" |
| 4 | 08:15 | 09:15 | 10 min | inactive | Inaktiv |
| 5 | 08:25 | 09:25 | 5 min | appWindow | Excel — „File A: Aggregate to visible" |
| 6 | 08:30 | 09:30 | 5 min | appWindow | Excel — „File B: Aggregate to visible" |
| 7 | 08:35 | 09:35 | 10 min | appWindow | Excel — „File A: Aggregate to visible" |

Begründungen der nicht-offensichtlichen Fälle:
- **Block 1 und 3 (Chrome) werden NICHT zusammengeführt**, obwohl identischer Titel — Block 2 (Explorer) liegt dazwischen, sie sind also nicht aufeinanderfolgend.
- **Block 4 (inactive)** entsteht aus zwei 5-Min-Intervallen (08:15 + 08:20), die als gleicher Typ `inactive` zu 10 min gemerged werden. `inactive` hat Priorität, obwohl die Heartbeats ein `appWindow` („Inactive App") tragen.
- **Block 5 und 7 (Excel File A) werden NICHT zusammengeführt** — Block 6 (Excel File B, anderer Titel) liegt dazwischen.
- **Block 7** entsteht aus 08:35 + 08:40 (beide „File A"), gemerged zu 10 min.

Erwartete Tages-Summary: aktiv 35 min (Chrome 10, Explorer 5, Excel 20), inaktiv 10 min, gesamt getrackt 45 min.

Hinweis zur Zeitanzeige: `roundToNearestInterval` aggregiert in UTC, die Render-Schicht (`DayOverview.js`) positioniert per lokaler `getHours()`. In Deutschland (CET, Winter) erscheinen die Blöcke daher ab **09:00** lokal. Bei Sommerzeit (CEST) wäre es 10:00 — 2024-01-01 ist Winter, also CET/+1.

---

### Task 1: Ground-Truth-Referenz `docs/testing/mock-data-expected.md`

**Files:**
- Create: `docs/testing/mock-data-expected.md`

**Interfaces:**
- Consumes: die verifizierten Ground-Truth-Werte aus dem Plan-Header oben.
- Produces: die Soll-Vorgabe, gegen die das Runbook (Task 2) vergleicht; referenziert per Pfad `docs/testing/mock-data-expected.md`.

- [ ] **Step 1: Verzeichnis und Datei anlegen**

Erstelle `docs/testing/mock-data-expected.md` mit folgendem Inhalt:

```markdown
# Erwartete Timeline für die Mock-Daten

Ground Truth für den Visual-Check (siehe `docs/testing/visual-verification.md`).
Quelle: `public/mock-data.json` (generiert von `scripts/generate-mock-data.ts`),
aggregiert mit **5-Minuten-Intervall** am Kalendertag **2024-01-01**.

Diese Datei ist von Hand aus den Aggregationsregeln
(`docs/Engineering Design Dokument.md` §2.2) abgeleitet und einmalig gegen die echte
Pipeline-Ausgabe (`TimelineGenerator`) abgeglichen. Wenn sich `public/mock-data.json`
ändert, MUSS diese Datei mitgepflegt werden.

## Zeitanzeige: UTC vs. lokal

Die Aggregation rundet Intervalle in **UTC** (`roundToNearestInterval`), die Timeline-Anzeige
(`src/components/DayOverview.js`) positioniert Blöcke per **lokaler** `getHours()`. In Deutschland
(CET, Winterzeit, UTC+1) erscheinen die Blöcke daher **eine Stunde später** als die UTC-Startzeit.
2024-01-01 liegt in der Winterzeit → lokale Startzeiten = UTC + 1 h.

## Erwartete Blöcke (in Reihenfolge)

| # | Start UTC | Start lokal (CET) | Dauer | Typ | App / Titel |
|---|-----------|-------------------|-------|-----|-------------|
| 1 | 08:00 | 09:00 | 5 min | appWindow | Google Chrome — „Aggregate to visible" |
| 2 | 08:05 | 09:05 | 5 min | appWindow | Explorer — „Aggregate to visible only for 5 min" |
| 3 | 08:10 | 09:10 | 5 min | appWindow | Google Chrome — „Aggregate to visible" |
| 4 | 08:15 | 09:15 | 10 min | inactive | Inaktiv |
| 5 | 08:25 | 09:25 | 5 min | appWindow | Excel — „File A: Aggregate to visible" |
| 6 | 08:30 | 09:30 | 5 min | appWindow | Excel — „File B: Aggregate to visible" |
| 7 | 08:35 | 09:35 | 10 min | appWindow | Excel — „File A: Aggregate to visible" |

## Warum die Blöcke so aussehen (die Regeln, die hier demonstriert werden)

- **Block 1 + 3 (Chrome) NICHT zusammengeführt**, obwohl identischer Titel: Block 2 (Explorer)
  liegt dazwischen → nicht aufeinanderfolgend, kein Merge.
- **Block 2 (Explorer)** erscheint als eigener Block, weil er genau ein volles 5-Min-Intervall
  mit ausreichend Heartbeats füllt (≥ 5 von 10). Das Label sagt es selbst: „...only for 5 min".
- **Block 4 (Inaktiv, 10 min)**: zwei Intervalle (08:15 + 08:20) gleichen Typs `inactive`,
  gemerged. `inactive` hat Vorrang vor `appWindow`, obwohl die Heartbeats ein Fenster („Inactive
  App") tragen.
- **Block 5 + 7 (Excel File A) NICHT zusammengeführt**: Block 6 (Excel File B, anderer Titel)
  liegt dazwischen.
- **Block 7 (10 min)**: 08:35 + 08:40, beide „File A" → gemerged.

## Erwartete Tages-Summary

- Aktiv gesamt: **35 min** (Google Chrome 10, Explorer 5, Excel 20)
- Inaktiv gesamt: **10 min**
- Getrackt gesamt: **45 min**
```

- [ ] **Step 2: Ground Truth gegen die echte Pipeline gegenprüfen**

Generiere die Mock-Daten neu und lasse sie durch die echte Pipeline laufen, um die Tabelle zu bestätigen:

Run:
```bash
npm run generate:mock
cat > _tmp_groundtruth.ts <<'EOF'
import fs from 'fs';
import path from 'path';
import TimelineGenerator from './src/store/TimelineGenerator';
const data = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'public/mock-data.json'), 'utf-8'));
const gen = new TimelineGenerator(data.aggregationInterval);
const events = gen.generateTimelineEvents(data.days['2024-01-01'].heartbeats);
const fmt = (ms: number) => new Date(ms).toISOString().substr(11, 8);
events.forEach(e => console.log(`${fmt(e.timestamp)} dur=${e.duration/60000}min ${e.type} ${e.type==='inactive'?'':e.data.app+' | '+e.data.title}`));
EOF
npx ts-node _tmp_groundtruth.ts; rm -f _tmp_groundtruth.ts
```

Expected (muss exakt zur Tabelle in `mock-data-expected.md` passen):
```
08:00:00 dur=5min appWindow Google Chrome | Aggregate to visible
08:05:00 dur=5min appWindow Explorer | Aggregate to visible only for 5 min
08:10:00 dur=5min appWindow Google Chrome | Aggregate to visible
08:15:00 dur=10min inactive
08:25:00 dur=5min appWindow Excel | File A: Aggregate to visible
08:30:00 dur=5min appWindow Excel | File B: Aggregate to visible
08:35:00 dur=10min appWindow Excel | File A: Aggregate to visible
```

Bei Abweichung: zuerst entscheiden, welche Seite richtig ist (Regel-Interpretation vs. Code), bevor irgendetwas geändert wird — nicht blind die Doku an den Code anpassen.

- [ ] **Step 3: Commit**

```bash
git add docs/testing/mock-data-expected.md
git commit -m "docs: add ground-truth timeline for mock-data visual check"
```

---

### Task 2: Verifikations-Runbook `docs/testing/visual-verification.md`

**Files:**
- Create: `docs/testing/visual-verification.md`

**Interfaces:**
- Consumes: `docs/testing/mock-data-expected.md` (Task 1) als Soll-Vorgabe.
- Produces: das Runbook, das CLAUDE.md (Task 3) referenziert per Pfad `docs/testing/visual-verification.md`.

- [ ] **Step 1: Datei anlegen**

Erstelle `docs/testing/visual-verification.md` mit folgendem Inhalt:

```markdown
# Visual-Verification-Runbook: Mock-Daten-Timeline

Zweck: Verifizieren, dass die Mock-Daten korrekt als Timeline gerendert werden — der gesamte Weg
`Heartbeats → Aggregation → IPC → gerendertes UI`. Wird von Claude on-demand per computer-use
ausgeführt (kein CI, kein automatischer Test).

Soll-Vorgabe: `docs/testing/mock-data-expected.md`.

## Schritte

1. **App mit Mock-Daten starten:**
   `npm run dev:mock`
   (lädt `public/mock-data.json`, kein echtes Tracking, kein Speichern. Generiert die Mock-Daten
   vorher neu.)

2. **Richtigen Tag sicherstellen:** Die Mock-Daten liegen auf **2024-01-01**. Falls die App einen
   anderen Tag anzeigt, im UI auf 2024-01-01 navigieren.

3. **computer-use-Zugriff anfordern** für die Workmory-App (Desktop-App, Tier „full"), Fenster nach
   vorn bringen, **Screenshot** der Timeline aufnehmen.

4. **Sichtbare Blöcke ablesen:** App/Titel, Dauer, Reihenfolge, Inaktiv-Phasen und ungefähre
   Startzeiten. Fokus auf Reihenfolge/Dauer/Titel — nicht auf pixelgenaue Geometrie.

5. **Gegen `docs/testing/mock-data-expected.md` abgleichen.** Erwartet werden 7 Blöcke in dieser
   Reihenfolge; lokale Startzeiten in Deutschland ab **09:00** (CET = UTC+1, Winterzeit).

6. **Ergebnis berichten:**
   - **Bestanden:** alle 7 Blöcke in richtiger Reihenfolge, Dauer und Beschriftung sichtbar.
   - **Abweichend:** konkrete Differenz auflisten (fehlender / zusätzlicher / falsch platzierter /
     falsch beschrifteter Block) als Soll vs. Ist.

## Bekannte Stolpersteine (kein Fehler)

- **Zeitversatz UTC↔lokal:** Blöcke erscheinen lokal eine Stunde nach der UTC-Startzeit (CET).
  Erwartete lokale Starts: 09:00, 09:05, 09:10, 09:15 (Inaktiv), 09:25, 09:30, 09:35.
- **Neutrale Icons:** App-Icons werden über das echte OS aufgelöst. Für Mock-Apps („Excel",
  „Explorer", „Google Chrome") gibt es evtl. kein passendes Icon → neutrale/graue Darstellung ist
  korrekt, kein Fehler.
- **Stunden-Range:** Die Timeline zeigt einen Puffer um die Events (ca. eine Stunde davor/danach),
  das ist beabsichtigt.

## Wenn der Check fehlschlägt

Eine Abweichung deutet auf einen Fehler in der Render-Schicht (`src/components/DayOverview.js`),
in der Aggregation (`src/store/TimelineGenerator.ts`) oder im IPC-/Lade-Pfad hin. Erst die Ursache
diagnostizieren (Unit-Tests prüfen: `npm test`), nicht die Ground Truth an ein falsches Bild
anpassen.
```

- [ ] **Step 2: Commit**

```bash
git add docs/testing/visual-verification.md
git commit -m "docs: add computer-use runbook for mock-data visual check"
```

---

### Task 3: CLAUDE.md-Anweisung ergänzen

**Files:**
- Modify: `CLAUDE.md` (Abschnitt „Working with Claude (recommended workflow)")

**Interfaces:**
- Consumes: `docs/testing/visual-verification.md` (Task 2) per Pfad-Referenz.
- Produces: keine — Endpunkt für nachgelagerte Tasks.

- [ ] **Step 1: Bullet im Workflow-Abschnitt ergänzen**

Füge in `CLAUDE.md` im Abschnitt „Working with Claude (recommended workflow)" nach dem
„Touching the aggregation pipeline"-Bullet folgendes neues Bullet hinzu:

```markdown
- **Touching the aggregation pipeline _or_ the timeline rendering:** after the unit tests pass,
  also run the visual check in `docs/testing/visual-verification.md` — launch the app with
  `npm run dev:mock` and verify (via computer-use) that the mock data renders as the timeline
  described in `docs/testing/mock-data-expected.md`. Report pass/deviation before considering the
  work done.
```

- [ ] **Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: instruct visual mock-data check on timeline changes"
```

---

### Task 4: Abnahme — erster vollständiger Runbook-Durchlauf

**Files:**
- (keine — reine Verifikation auf der echten App)

**Interfaces:**
- Consumes: alle drei Dokumente aus Task 1–3.

- [ ] **Step 1: Runbook end-to-end ausführen**

Folge `docs/testing/visual-verification.md` Schritt für Schritt auf der echten App:
`npm run dev:mock` starten, computer-use-Zugriff anfordern, Screenshot, Blöcke ablesen.

- [ ] **Step 2: Gegen Ground Truth vergleichen und Ergebnis berichten**

Erwartetes Ergebnis für den aktuellen Stand: **bestanden** — 7 Blöcke in der Reihenfolge aus
`mock-data-expected.md`, lokale Starts ab 09:00. Falls abweichend: Differenz melden und als
echten Fund behandeln (nicht die Doku „glätten").

---

## Self-Review

**Spec coverage:**
- Spec-Komponente 1 (`mock-data-expected.md`) → Task 1. ✓
- Spec-Komponente 2 (`visual-verification.md` Runbook) → Task 2. ✓
- Spec-Komponente 3 (CLAUDE.md-Anweisung) → Task 3. ✓
- Spec „Verifikation dieses Features" (Pipeline-Abgleich + erster Runbook-Durchlauf) → Task 1 Step 2 + Task 4. ✓
- Spec-Risiken (UTC-vs-lokal, neutrale Icons, Mitpflege bei Datenänderung) → in den Dokumentinhalten von Task 1/2 abgedeckt. ✓

**Placeholder scan:** Keine TBD/TODO/„handle edge cases". Alle Dateiinhalte vollständig ausformuliert. ✓

**Type consistency:** Pfade konsistent (`docs/testing/mock-data-expected.md`, `docs/testing/visual-verification.md`) über alle Tasks; Ground-Truth-Werte in Plan-Header, Task 1 und Task 2 identisch (7 Blöcke, lokale Starts 09:00–09:35, Summary 35/10/45 min). ✓
