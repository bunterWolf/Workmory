# Abwesenheit und Ruhemodus: Design-Spec

**Datum:** 2026-11-08 · **Branch:** `redesign-figma-v2` (Umsetzung auf eigenem Branch) · **Status:** Entwurf zur Freigabe

## 1. Ziel und Warum

Workmory-Daten fließen in Zeiterfassung und Rechnungen. Pausen müssen deshalb zuverlässig als
inaktiv erkannt werden, ohne dass kurze Unterbrechungen Arbeitszeit kosten. Ein Audit (Stand
2026-11-07, echte Daten 3.–6.11. und simulierte Szenarien mit dem echten `ActivityStore` und
`TimelineGenerator`) hat gezeigt:

- Lange, gesperrte Pausen werden heute korrekt erkannt und rückwirkend inaktiv.
- Die Rückschreibung (`handleMayBeInactive`) läuft **nur**, wenn ein Heartbeat den Status
  `inactive` (10 min ohne Eingabe) erreicht. Geht der PC vorher in den Ruhemodus, bleibt die
  Zeit davor Arbeit. Beispiel: 5 min ohne Eingabe, dann 60 min Ruhemodus ergibt 5 min zu viel Arbeit.
- Die Rückschreibung erreicht nur den aktuellen Tag. Eine Pause über Mitternacht lässt die
  Minuten vor Mitternacht als Arbeit stehen.
- Der dominante Typ eines Blocks wird pro Fenster statt pro Typ bestimmt. Das widerspricht
  Engineering Design Dokument §2.2.3 und kann eine Pause als Arbeit zeigen oder umgekehrt.

Der Nutzer kann nicht alle Situationen am Arbeitstag beschreiben (Pause, persönliche Besprechung,
Meeting ohne Maus). Gesucht ist deshalb **eine allgemeine Regel**, keine Fallunterscheidung.

## 2. Die Regel (vom Nutzer bestätigt)

**Eine Abwesenheit dauert von der letzten Eingabe bis zur nächsten Eingabe.** Eingabe heißt
Maus oder Tastatur, so wie `powerMonitor.getSystemIdleTime()` sie misst.

1. **Kürzer als 10 Minuten:** zählt als Arbeit. Das gilt für versehentliches Sperren, kurzes
   Wegdrehen und ein Meeting ohne Maus.
2. **10 Minuten oder länger:** ist eine Pause. Die **wache** Zeit ohne Eingabe wird rückwirkend
   `inactive`, ab dem ersten Heartbeat ohne Eingabe (heute `may_be_inactive`, ab 60 s Idle).
3. **Ruhemodus wird nicht getrackt.** Die Zeit im Ruhemodus erscheint als Lücke in der Timeline,
   nicht als inaktiv und nicht als „Ruhemodus“-Abschnitt. Sie zählt nicht zu Aktiv, Inaktiv oder
   Getrackt.
4. **Der Ruhemodus zählt aber zur Dauer der Abwesenheit.** Er beweist, dass der Nutzer nicht da
   war. Beispiel: 8 min ohne Eingabe, dann 10 min Ruhemodus = 18 min Abwesenheit, also eine Pause.
   Ergebnis: 8 min inaktiv, danach 10 min Lücke.
5. **Sperren löst nichts sofort aus.** Sperrbildschirm und Ruhemodus beenden keine Abwesenheit
   und starten keine Pause. Nur die Dauer bis zur nächsten Eingabe entscheidet.
6. **Wer den Ruhemodus ausgelöst hat, muss die App nicht wissen.** Startet das System ihn wegen
   Inaktivität, gibt es davor wache Zeit ohne Eingabe; die wird nach Regel 2 und 4 inaktiv.
   Startet der Nutzer ihn selbst (Deckel zu), gibt es davor keine solche Zeit; dann entsteht nur
   die Lücke.
7. **Abwesenheiten können über Mitternacht und mehrere Tage gehen.** Die Rückschreibung reicht
   in jeden betroffenen Tag. Beispiel: ab 23:52 keine Eingabe, 00:02 Ruhemodus, 07:30 erste
   Eingabe: 23:52–00:02 inaktiv (auf beide Tage verteilt), die Nacht ist eine Lücke, der neue
   Tag beginnt mit der Eingabe um 07:30.

Die Schwelle von 10 Minuten (heute `INACTIVE_THRESHOLD = 600` in `InactivityWatcher.ts`) bleibt.

### Beispiele (Soll)

| Ablauf | Arbeit | Inaktiv | Lücke |
|---|---|---|---|
| 60 min Mittag, PC gesperrt und wach | übrige Zeit | 60 min | – |
| 9 min weg, PC wach | inkl. 9 min | – | – |
| 9 min weg, sofort gesperrt | inkl. 9 min | – | – |
| 8 min weg, dann 10 min Ruhemodus | übrige Zeit | 8 min | 10 min |
| 2 min weg, dann 3 min Ruhemodus | inkl. 2 min | – | 3 min |
| Deckel sofort zu, 60 min | übrige Zeit | – | 60 min |
| 12 min weg, Maus nach 9 min kurz angestoßen | inkl. 12 min* | – | – |

\* Ein Anstoßen ist eine Eingabe und beendet die Abwesenheit. Daraus werden zwei Abwesenheiten
unter 10 min. Das ist eine bewusste Folge der allgemeinen Regel, kein Sonderfall.

Die Minutenangaben sind die Heartbeat-Wahrheit. Was die Timeline zeigt, folgt weiter den
bestehenden Blockregeln (feste Grenzen, mindestens die Hälfte der Heartbeats, Merge). Durch die
Lücke im Ruhemodus kann ein Block am Pausenrand wegfallen oder als inaktiv gerundet werden. Das
bleibt so.

## 3. Weitere Korrektur: dominanter Typ nach Spec

`TimelineGenerator.determineDominantActivity` zählt heute pro Schlüssel `inactive` gegen
`app:<app>:<title>`. Laut Engineering Design Dokument §2.2.3 gilt der **Typ**, der am häufigsten
vorkommt: erst `inactive` gegen `appWindow` (alle Fenster zusammen), danach innerhalb von
`appWindow` das häufigste Fenster für die Anzeige. Beispiel: 6 Heartbeats inaktiv, 9 Heartbeats
verteilt auf 3 Fenster ergibt heute „inaktiv“, richtig ist „Arbeit“.

**Gleichstand** (z. B. 15 gegen 15 Heartbeats am Pausenrand): keine Sonderbehandlung, kein
zusätzlicher Code (Entscheidung des Nutzers). Es gewinnt, was die einfachste Umsetzung ergibt; heute
ist das der Typ, der im Block zuerst vorkommt.

## 4. Nicht-Ziele

- Keine Unterscheidung zwischen Pause, persönlicher Besprechung und stillem Meeting.
- Kein sichtbarer „Ruhemodus“-Abschnitt in der Timeline (Variante C aus dem Brainstorming wurde
  verworfen zugunsten einer Lücke).
- Keine Obergrenze für lange Abwesenheiten bei wachem, gesperrtem PC. Der Nutzer hält einen PC,
  der nachts nie schläft, für unrealistisch; das Testgerät ist eine Ausnahme.
- Keine Änderung an der Schwelle von 10 Minuten oder an der Blockgröße.
- Keine Anzeige von „LockApp.exe“ abändern. Kurzes Sperren bleibt Arbeit und wird mit dem Fenster
  angezeigt, das die Heartbeats melden.
- Teams-Meetings (werden nicht mehr verfolgt).
- Keine Sonderbehandlung für halb-wache Zustände (Wartungs-Aufwachen, Modern Standby). Der Nutzer
  sieht darin aktuell kein Problem und will dafür keinen zusätzlichen Code.
- Keine Versionierung oder Migration alter Tage (siehe §7).

**Leitlinie des Nutzers:** so wenig Code wie möglich. Im Zweifel die einfachste Umsetzung wählen,
die die Regeln aus §2 und §3 erfüllt.

## 5. Rahmenbedingungen

- Local-first: Keine Daten verlassen den Rechner.
- Testgetrieben: Jede Regel aus §2 und §3 bekommt zuerst einen fehlschlagenden Test in
  `src/store/ActivityStore.test.ts` bzw. `src/store/TimelineGenerator.test.ts`. Die Szenarien
  aus der Tabelle in §2 sind die Mindestabdeckung, dazu Mitternacht und mehrere Tage.
- Dokumente nachziehen: Engineering Design Dokument §2.2.3 (Regeln aus §2, dominanter Typ) und
  §2.4.2 (Schwellen 60 s / 600 s statt „fünf Heartbeats“), außerdem der veraltete Kommentar in
  `InactivityWatcher.ts`.
- Alle drei Umgebungen bedenken: dev, test, prod und `--mock-data`.

## 6. Dem Builder überlassen

- **Wie die App weiß, dass eine Lücke Ruhemodus war.** Naheliegend sind die Electron-Ereignisse
  `powerMonitor` `suspend`/`resume`, die heute ungenutzt sind. Meine Entscheidung (Claude):
  Nur eine Lücke durch Ruhemodus oder Ruhezustand zählt nach Regel 4 zur Abwesenheit. Eine Lücke,
  weil Workmory beendet war, abgestürzt ist oder der PC heruntergefahren wurde, zählt **nicht**,
  denn der Nutzer kann in der Zeit am PC gearbeitet haben. Wie der Ruhemodus erkannt und ggf.
  gespeichert wird (auch über einen App-Neustart hinweg), entscheidet der Builder.
- **Wo die Regel greift:** beim Schreiben der Heartbeats (wie die heutige Rückschreibung) oder
  beim Aggregieren, je nachdem, was einfacher ist (siehe §7).
- **Verhalten nach dem Aufwachen prüfen:** Ob `getSystemIdleTime()` nach `resume` ohne Eingabe
  zurückgesetzt wird und ob Wartungs-Aufwachen (ohne Nutzer) Heartbeats mit Status `active`
  erzeugt, muss auf echter Hardware geprüft werden. Solche Heartbeats dürfen eine Abwesenheit
  nicht beenden.
- **Cache und Datumsschlüssel:** `AggregationManager` cached nur heute und bildet seinen
  Schlüssel in UTC (`toISOString`), `ActivityStore` dagegen lokal. Wenn die Rückschreibung den
  Vortag ändert, muss dessen Aggregation neu berechnet werden; die UTC/lokal-Abweichung ist dabei
  zu beheben oder als unschädlich nachzuweisen.
- Aufteilung in Commits und Reihenfolge der Umsetzung.

## 7. Alte Tage

Dem Nutzer ist egal, ob bereits erfasste Tage sich ändern; es gilt, was einfacher ist. Daraus folgt:

- Vergangene Tage werden wie heute bei jedem Öffnen aus den Heartbeats neu berechnet. Die Korrektur
  aus §3 wirkt deshalb automatisch auch auf alte Tage. Keine Versionierung, kein Einfrieren.
- Regel 4 (Ruhemodus zählt zur Abwesenheit) greift nur für Daten, die nach dem Update entstehen.
  Alte Heartbeats werden nicht migriert.
- Regel 7 darf den Vortag nachträglich ändern, auch erst Tage später (z. B. Freitagabend am Montag).
