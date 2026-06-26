# Mock-Daten-Visualisierungs-Check (MVP) — Design

**Datum:** 2026-06-26
**Status:** Entwurf zur Review

## Problem

Die Daten-Pipeline von Workmory (`Heartbeats → Aggregation → IPC → gerenderte Timeline`)
speist echtes Time-Tracking und damit reale Rechnungen. Heute ist nur die **Logik** abgesichert:

- `TimelineGenerator` / `ActivityStore` sind unit-getestet (Rundung, Halb-Intervall-Regel,
  dominante Aktivität, Merging, Summary).
- Die **Render-Schicht** (`src/components/DayOverview.js`) — Block-Geometrie (`top`/`height`),
  Stunden-Range, Titel/Dauer/Reihenfolge der Blöcke — ist **ungetestet**.
- Niemand (auch Claude nicht) prüft den **gesamten Weg bis zum tatsächlich gerenderten UI**.

Ziel dieses ersten Schnitts: Claude soll **selbst und wiederholbar** verifizieren können, dass die
bestehenden Mock-Daten **korrekt als Timeline visualisiert** werden.

## Scope

**Im Scope (MVP):**

- Eine bekannte Soll-Vorgabe („Ground Truth") für die existierende `public/mock-data.json`.
- Ein wiederholbares Runbook, mit dem Claude die echte App mit `--mock-data` startet, die
  gerenderte Timeline per `computer-use` abliest, gegen die Ground Truth vergleicht und das
  Ergebnis (bestanden/abweichend + konkrete Differenz) meldet.
- Eine Anweisung in `CLAUDE.md`, diesen Check als Teil des Wrapping-up/Vor-Release-Workflows
  durchzuführen.

**Bewusst NICHT im Scope (spätere Iterationen):**

- Automatisierte Jest-Render-Tests (jsdom / Testing Library).
- Playwright-for-Electron oder anderes E2E-Automatisierungs-Tooling.
- Ein CI-Gate für den Visual-Check.
- Eine Edge-Case-Szenario-Bibliothek (Halb-Intervall-Schwelle, Merging, `inactive`-Priorität,
  Mehr-Tage, leerer Tag) — jeweils mit eigener Ground Truth.

Die Architektur ist so gewählt, dass die Ground-Truth-Datei später direkt von Jest-Golden-Tests
und/oder einer Szenario-Bibliothek wiederverwendet werden kann.

## Designentscheidungen

### Ground Truth als reine Markdown-Referenz, von Hand abgeleitet

Die erwartete Timeline wird **unabhängig von der Implementierung** aus den Aggregationsregeln
(`docs/Engineering Design Dokument.md` §2.2) und den selbst-dokumentierenden Mock-Daten-Labels
abgeleitet und als Markdown abgelegt.

**Warum nicht aus der Pipeline generieren:** Ein Generator, der die Soll-Timeline aus *derselben*
Pipeline zieht, die geprüft werden soll, ist zirkulär — bei einem Aggregationsfehler wäre auch die
„richtige Antwort" falsch und der Check würde fälschlich bestehen. Die handabgeleitete Referenz
fängt damit sowohl Aggregations- als auch Visualisierungs-Drift.

**Verifikation der Referenz:** Die handgeschriebene Soll-Timeline wird **einmalig bei der
Erstellung** gegen die tatsächliche Pipeline-Ausgabe abgeglichen (Heartbeats aus
`public/mock-data.json` durch `TimelineGenerator` laufen lassen), um Tippfehler in der Referenz
auszuschließen. Bei einer Abweichung wird zuerst von Hand entschieden, welche Seite richtig ist
(Regel-Interpretation vs. Code), bevor irgendetwas angepasst wird.

Die Mock-Daten sind klein und stabil → Pflege von Hand ist trivial. Ein Generator kommt erst,
wenn die Daten/Szenarien wachsen (YAGNI).

## Komponenten

### 1. `docs/testing/mock-data-expected.md` — Ground Truth

Menschenlesbare, geordnete Liste der erwarteten Timeline-Blöcke, die `public/mock-data.json` beim
konfigurierten Intervall (aktuell **5 Minuten**, siehe `aggregationInterval` in der Mock-Datei)
erzeugen muss. Pro Block:

- **Startzeit** (lokale Anzeige; Hinweis auf die UTC-Intervall-Ausrichtung, siehe
  `roundToNearestInterval`)
- **Dauer**
- **Typ** (`appWindow` / `inactive`)
- **Titel / App** (bzw. „Inaktiv")

Zusätzlich:

- Eine kurze Erläuterung **pro nicht-offensichtlichem Block**, *warum* er so aussieht (z. B.
  „08:05–08:10 Explorer erscheint als eigener 5-Min-Block, weil es genau ein volles Intervall mit
  ausreichend Heartbeats füllt", „identische aufeinanderfolgende Excel-Blöcke desselben Titels
  werden zusammengeführt").
- Ein knapper Hinweis, welche der mock-Labels welche Regel demonstrieren (die Titel sind bereits
  als Test-Labels formuliert, z. B. „Aggregate to visible only for 5 min").
- Ein optionaler Verweis auf die erwartete Tages-Summary (aktive/inaktive Gesamtdauer), falls die
  UI sie anzeigt.

### 2. `docs/testing/visual-verification.md` — Runbook

Kurze, deterministische Schritt-für-Schritt-Anleitung, die Claude jedes Mal gleich abarbeitet:

1. App mit Mock-Daten starten: `npm run dev:mock` (lädt `public/mock-data.json`, kein echtes
   Tracking, kein Speichern).
2. Sicherstellen, dass der korrekte Tag angezeigt wird (die Mock-Daten liegen auf `2024-01-01` —
   ggf. im UI auf dieses Datum navigieren).
3. `computer-use`-Zugriff für die Workmory-App anfordern (Tier „full"), Fenster nach vorn,
   Screenshot der Timeline.
4. Die sichtbaren Blöcke ablesen: Titel/App, Dauer, Reihenfolge, Inaktiv-Phasen, ungefähre
   Startzeiten.
5. Gegen `docs/testing/mock-data-expected.md` abgleichen.
6. Ergebnis berichten:
   - **Bestanden:** alle erwarteten Blöcke in richtiger Reihenfolge/Dauer sichtbar.
   - **Abweichend:** konkrete Differenz (fehlender/zusätzlicher/falsch platzierter/falsch
     beschrifteter Block) mit Soll vs. Ist.

Das Runbook nennt außerdem die bekannten Stolpersteine: richtiges Datum (`2024-01-01`),
UTC-vs-lokale-Intervall-Ausrichtung, und dass Icons je nach OS evtl. neutral dargestellt werden
(kein Fehler).

### 3. Anweisung in `CLAUDE.md`

Ergänzung im Abschnitt „Working with Claude" / Wrapping-up: Wenn Änderungen die
Tracking-→-Aggregation-→-Timeline-Pipeline **oder die Timeline-Darstellung** berühren, soll Claude
nach den Unit-Tests zusätzlich den Visual-Check aus `docs/testing/visual-verification.md`
durchführen und das Ergebnis berichten, bevor die Arbeit als erledigt gilt.

## Datenfluss

```
public/mock-data.json
  → npm run dev:mock (--mock-data)
  → ActivityStore lädt Mock-Daten
  → Aggregation (TimelineGenerator, 5-Min-Intervall)
  → IPC → DayOverview.js (echtes Rendering)
  → echtes Electron-Fenster
  → computer-use Screenshot
  → Vergleich gegen docs/testing/mock-data-expected.md
  → Bericht: bestanden / abweichend (+ Differenz)
```

## Verifikation dieses Features

- `mock-data-expected.md` wird bei Erstellung einmalig gegen die echte Pipeline-Ausgabe
  abgeglichen (siehe Designentscheidung).
- Ein erster vollständiger Durchlauf des Runbooks durch Claude auf der echten App dient als
  Abnahme: erwartetes Ergebnis = **bestanden** für den aktuellen Stand.

## Risiken / Grenzen

- `computer-use` ist nicht-deterministisch, langsam, token-intensiv und läuft nur on-demand auf dem
  echten Desktop des Nutzers — bewusst **kein** automatischer/CI-Test, sondern eine assistierte
  Verifikation.
- Ablesefehler beim Screenshot sind möglich; das Runbook reduziert sie durch klare Soll-Vorgaben
  und Fokus auf Reihenfolge/Dauer/Titel statt Pixel-genaue Geometrie.
- Wenn sich `public/mock-data.json` ändert, muss `mock-data-expected.md` mitgepflegt werden (im
  Runbook/CLAUDE.md als Invariante vermerkt).
