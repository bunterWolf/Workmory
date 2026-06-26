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
