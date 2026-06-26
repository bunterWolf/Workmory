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
