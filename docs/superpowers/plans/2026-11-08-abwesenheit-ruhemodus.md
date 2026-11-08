# Abwesenheit und Ruhemodus Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Abwesenheiten ab 10 min werden zuverlässig inaktiv, auch wenn der PC zwischendurch in den Ruhemodus geht oder die Abwesenheit über Mitternacht und mehrere Tage reicht. Blöcke bekommen ihren Typ per Typ-Mehrheit nach Spec.

**Architecture:** Die heutige Rückschreibung (`handleMayBeInactive`, nur aktueller Tag) wandert in ein kleines Modul `src/store/AbsenceBackfill.ts` und läuft dort über alle Tage rückwärts bis zum letzten `active`-Heartbeat. `ActivityStore` merkt sich im Speicher den Zeitpunkt des letzten `suspend` (Electron `powerMonitor`). Beim ersten Heartbeat danach gilt: Liegt der letzte `active`-Heartbeat vor dem Ruhemodus mindestens 10 min zurück, wird zurückgeschrieben. Der Ruhemodus selbst erzeugt keine Heartbeats und bleibt eine Lücke; dafür ist kein Code nötig. Ein App-Neustart verliert die Markierung absichtlich, denn eine Lücke wegen beendeter App zählt nicht.

**Tech Stack:** Electron, TypeScript, Jest (ts-jest).

**Spec:** `docs/superpowers/specs/2026-11-08-abwesenheit-ruhemodus-design.md`

## Global Constraints

- Leitlinie des Nutzers: so wenig Code wie möglich. Keine Sonderbehandlung für Gleichstand, halb-wache Zustände, Versionierung oder Migration alter Tage.
- Schwelle Abwesenheit = 10 min (`600` s), genau eine Konstante im Code.
- Nur eine Lücke durch Ruhemodus zählt zur Abwesenheit, keine Lücke wegen beendeter oder abgestürzter App, Herunterfahren oder pausiertem Tracking.
- Local-first, keine Netzwerkzugriffe. Mock-Daten nur in Tests und mit `--mock-data`.
- Testgetrieben: zuerst ein fehlschlagender Test. Vor jedem Commit ist `npm test` grün.
- Conventional Commits, mit `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` am Ende jeder Commit-Message.
- Arbeiten auf einem eigenen Branch `fix/abwesenheit-ruhemodus` ab `redesign-figma-v2` (enthält die Spec). Nicht pushen, nicht releasen.
- Tests nutzen lokale Zeitstempel ohne `Z` (z. B. `new Date('2026-03-06T23:52:00')`). Tageschlüssel sind lokal, Mitternachtstests hängen sonst von der Zeitzone ab.

## Review Focus

1. **Tracking pausiert, dann Ruhemodus:** Ein `suspend` bei pausiertem Tracking darf nach dem Fortsetzen nichts zurückschreiben. Test in Task 4: `ignoriert suspend bei pausiertem Tracking`.
2. **Lücke ohne `suspend`** (App neu gestartet, Absturz): Die wache Zeit davor bleibt Arbeit. Test in Task 4: `Lücke ohne suspend zählt nicht`.
3. **Erster Heartbeat nach dem Aufwachen ist schon `inactive`,** weil die OS-Idle-Zeit den Ruhemodus mitzählt: Das Ergebnis muss dasselbe sein, ohne Doppelarbeit oder Fehler. Test in Task 4: `erster Heartbeat nach Aufwachen ist inactive`.
4. **Wochenende ohne Daten zwischen Freitag und Montag:** Die Rückschreibung muss über leere Tage hinweg den Freitag erreichen. Test in Task 4: `Freitag bis Montag`.
5. **Kein `active`-Heartbeat in der ganzen Historie** (frische Installation): kein Absturz. Regel 2 schreibt ab dem ersten Heartbeat zurück, wie heute. Regel 4 tut nichts. Tests in Task 3 (`ohne active in der Historie`) und Task 4 (`Ruhemodus ohne active in der Historie`).

---

### Task 1: Typ-Mehrheit für den dominanten Block-Typ

**Files:**
- Modify: `src/store/TimelineGenerator.ts:224-281` (`determineDominantActivity`)
- Test: `src/store/TimelineGenerator.test.ts` (in `describe('Aktivitätserkennung')`)
- Modify: `docs/Engineering Design Dokument.md` §2.2.3, Abschnitt „Activity Aggregation“

**Interfaces:**
- Consumes: nichts.
- Produces: unveränderte Signatur `determineDominantActivity(heartbeats: Heartbeat[]): { type: string; data: any } | null`.

- [ ] **Step 1: Write the failing tests**

```ts
test('Typ-Mehrheit: viele Fenster schlagen inactive (Spec 2.2.3)', () => {
  // 6 inactive, 9 appWindow verteilt auf 3 Fenster (je 3) in einem 15-min-Block
  generator.setAggregationInterval(15);
  const base = new Date('2024-03-20T10:00:00Z').getTime();
  const hb = (i: number, data: any) => ({ timestamp: base + i * 30000, data });
  const heartbeats: any[] = [
    ...Array.from({ length: 6 }, (_, i) => hb(i, { userActivity: 'inactive' })),
    ...['Mail', 'Excel', 'Chrome'].flatMap((app, a) =>
      Array.from({ length: 3 }, (_, i) => hb(6 + a * 3 + i, { userActivity: 'active', appWindow: { app, title: 'x' } }))),
  ];
  const [event] = generator.generateTimelineEvents(heartbeats);
  expect(event.type).toBe('appWindow');
  expect(event.data.app).toBe('Mail'); // häufigstes Fenster; bei Gleichstand das zuerst vorkommende
});

test('Typ-Mehrheit: inactive gewinnt nur mit echter Mehrheit, Gleichstand ergibt appWindow', () => {
  const base = new Date('2024-03-20T10:00:00Z').getTime();
  const heartbeats: any[] = Array.from({ length: 10 }, (_, i) => ({
    timestamp: base + i * 30000,
    data: i < 5 ? { userActivity: 'inactive' } : { userActivity: 'active', appWindow: { app: 'VS Code', title: 'a.ts' } },
  }));
  expect(generator.generateTimelineEvents(heartbeats)[0].type).toBe('appWindow');
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest src/store/TimelineGenerator.test.ts -t "Typ-Mehrheit"`
Expected: Beide Tests schlagen fehl (`Expected: "appWindow"`, `Received: "inactive"`). Heute gewinnt bei Gleichstand die zuerst eingefügte Gruppe, hier `inactive`.

- [ ] **Step 3: Implement**

`determineDominantActivity` zählt `inactive`-Heartbeats gegen alle `appWindow`-Heartbeats (gleiche Erkennung wie heute: `userActivity === 'inactive'` bzw. `appWindow.app` und `appWindow.title` vorhanden). Gibt es von beiden keine, wird `null` zurückgegeben. Ist `inactiveCount > appWindowCount`, ergibt das `{ type: 'inactive', data: { reason: 'User inactive' } }`. Sonst wird das häufigste Fenster genommen, mit der bestehenden Gruppierung `app:<app>:<title>` und strikt `>`, damit bei Gleichstand das zuerst vorkommende Fenster gewinnt. Kein weiterer Gleichstands-Code.

- [ ] **Step 4: Update the spec doc**

In `docs/Engineering Design Dokument.md` §2.2.3 wird die Zeile „Sets the activity type to the type that occurs most frequently…“ ergänzt: Zuerst entscheidet `inactive` gegen `appWindow` (alle Fenster zusammen). `inactive` braucht dafür eine echte Mehrheit, bei Gleichstand gilt `appWindow`. Innerhalb von `appWindow` zeigt der Block das häufigste Fenster. In der Spec
`docs/superpowers/specs/2026-11-08-abwesenheit-ruhemodus-design.md` §3 wird der Satz „heute ist das
der Typ, der im Block zuerst vorkommt“ ersetzt durch „bei Gleichstand gilt `appWindow`“.

- [ ] **Step 5: Run all tests**

Run: `npm test`
Expected: PASS. Prüfen, dass der bestehende Test „sollte die häufigste spezifische Aktivität in einem Intervall erkennen“ weiter grün ist.

- [ ] **Step 6: Commit**

```bash
git add src/store/TimelineGenerator.ts src/store/TimelineGenerator.test.ts "docs/Engineering Design Dokument.md" docs/superpowers/specs/2026-11-08-abwesenheit-ruhemodus-design.md
git commit -m "fix: pick block type by type majority as specified"
```

---

### Task 2: Lokaler Tag überall im Hauptprozess (Cache und Aufräumen)

Entscheidung des Nutzers (2026-11-08), nach einer Bewertung der Zeitbehandlung: Das Zeitmodell
(UTC-Zeitpunkte, lokale Tage, Anzeige in lokaler Zeit mit dem damals gültigen Sommer-/Winterzeit-Versatz)
bleibt. Es gibt nur kleine Korrekturen: Kein Code im Hauptprozess rechnet Tage noch in UTC. Es wird kein
UTC-Versatz pro Heartbeat gespeichert. Uhrumstellung während des Trackings und Zeitzonenwechsel bleiben
ungelöst (Nicht-Ziel).

**Files:**
- Create: `src/store/dateKey.ts`
- Modify: `src/store/AggregationManager.ts:156-159` (`getDateKey`)
- Modify: `src/store/ActivityStore.ts` (`getDateKey`, Body ersetzt durch Aufruf; `getDatesOlderThan` rechnet mit lokaler Mitternacht)
- Test: `src/store/dateKey.test.ts`, `src/store/ActivityStore.test.ts`

**Interfaces:**
- Produces: `export function toLocalDateKey(timestamp: number): string` (Format `YYYY-MM-DD`, lokale Datumsbestandteile; derselbe Code wie heute in `ActivityStore.getDateKey`).

- [ ] **Step 1: Write the failing test**

```ts
import { toLocalDateKey } from './dateKey';
import { AggregationManager } from './AggregationManager';
import TimelineGenerator from './TimelineGenerator';
import { ActivityState } from './ActivityState';

test('toLocalDateKey nutzt das lokale Datum', () => {
  expect(toLocalDateKey(new Date('2026-03-05T00:30:00').getTime())).toBe('2026-03-05');
  expect(toLocalDateKey(new Date('2026-03-04T23:59:59').getTime())).toBe('2026-03-04');
});

test('AggregationManager behandelt den lokalen Tag kurz nach Mitternacht als heute', () => {
  const realNow = Date.now;
  const now = new Date('2026-03-05T00:30:00').getTime();
  Date.now = () => now;
  try {
    const state = new ActivityState();
    const manager = new AggregationManager(new TimelineGenerator(5), state); // Cache für heute: null
    // 10 Heartbeats im abgeschlossenen Intervall 00:10–00:15 ergeben einen Block
    const base = new Date('2026-03-05T00:10:15').getTime();
    state.setHeartbeats('2026-03-05', Array.from({ length: 10 }, (_, i) => (
      { timestamp: base + i * 30000, data: { userActivity: 'active', appWindow: { app: 'VS Code', title: 'a.ts' } } } as any)));
    expect(manager.aggregateAndCacheDay('2026-03-05')).toBe(true); // heute: Cache wird aktualisiert (mit UTC-Schlüssel: false)
  } finally {
    Date.now = realNow;
  }
});
```

Dazu kommt in `src/store/ActivityStore.test.ts` ein Test `Aufräumen nach 30 Tagen rechnet in lokalen Tagen`. Store aufbauen wie in `describe('ActivityStore Integration')`, Daten per `activityStore.activityState.setData({ version: 1, startTime: 0, lastCleanup: 0, aggregationInterval: 15, days: { '2026-02-03': { heartbeats: [] }, '2026-02-04': { heartbeats: [] } } })`. `Date.now` liefert lokal `2026-03-05T00:30:00`, dann `cleanupOldData()`. Erwartung: `getAvailableDates()` ergibt `['2026-02-04']`. Die Grenze liegt bei lokal 2026-02-03 00:30; die lokale Mitternacht des 3. liegt davor, UTC-Mitternacht (01:00 lokal) danach.

Hinweis: Der Cache-Test und der Aufräum-Test schlagen nur in einer Zeitzone östlich von UTC fehl. Auf dem Entwicklungsrechner ist das Europe/Berlin. Unter UTC besteht er auch ohne Fix.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/store/dateKey.test.ts`
Expected: FAIL. `toLocalDateKey` existiert nicht (Modul nicht gefunden).

- [ ] **Step 3: Implement**

`src/store/dateKey.ts` enthält `toLocalDateKey` mit dem heutigen Body aus `ActivityStore.getDateKey`. `ActivityStore.getDateKey` und `AggregationManager.getDateKey` geben nur noch `toLocalDateKey(timestamp)` zurück. Den doppelten Body in `ActivityStore` entfernen. In `getDatesOlderThan` wird `Date.parse(dateKey + 'T00:00:00Z')` zu `new Date(dateKey + 'T00:00:00').getTime()` (lokale Mitternacht). Der Kommentar über UTC-Tage darüber wird angepasst.

- [ ] **Step 4: Run all tests**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/store/dateKey.ts src/store/dateKey.test.ts src/store/AggregationManager.ts src/store/ActivityStore.ts src/store/ActivityStore.test.ts
git commit -m "fix: use local days for the aggregation cache and cleanup"
```

---

### Task 3: Rückschreibung über Tagesgrenzen (Regel 7)

**Files:**
- Create: `src/store/AbsenceBackfill.ts`
- Modify: `src/store/ActivityStore.ts:80-145` (`handleMayBeInactive` herausnehmen, re-exportieren), `src/store/ActivityStore.ts:417-423` (`updateHeartbeats`)
- Test: `src/store/AbsenceBackfill.test.ts`
- Modify: `CLAUDE.md` (Modul-Tabelle: eine Zeile für `AbsenceBackfill.ts`)

**Interfaces:**
- Consumes: `ActivityState.getAvailableDates(): string[]` (sortiert aufsteigend), `getHeartbeats(dateKey)`, `setHeartbeats(dateKey, heartbeats)`.
- Produces:
  - `export const ABSENCE_THRESHOLD_MS = 10 * 60 * 1000;`
  - `export function handleMayBeInactive(...)`: unveränderte Signatur und unverändertes Verhalten, nur verschoben. `ActivityStore.ts` macht `export { handleMayBeInactive } from './AbsenceBackfill';`, damit `ActivityStore.test.ts` unverändert bleibt.
  - `export function backfillAbsence(state: ActivityState, untilTs: number): void`. Geht die Tage absteigend durch und wendet pro Tag `handleMayBeInactive(heartbeats, untilTs, { userActivity: 'inactive' })` an. Hört nach dem ersten Tag auf, der einen `active`-Heartbeat mit `timestamp < untilTs` enthält.
  - `export function findLastActiveTimestamp(state: ActivityState, beforeTs: number): number | null`. Liefert den Zeitstempel des letzten `active`-Heartbeats mit `timestamp < beforeTs`, über alle Tage, oder `null`.
  - Typen nur per `import type` aus `./ActivityStore`, damit keine Laufzeit-Zirkularität entsteht.

- [ ] **Step 1: Write the failing tests** (reine Unit-Tests auf `ActivityState`, ohne Electron)

```ts
const at = (iso: string) => new Date(iso).getTime(); // lokale Zeit, ohne Z
const hb = (iso: string, userActivity: string) => ({ timestamp: at(iso), data: { userActivity } }) as any;
const statuses = (state: ActivityState, key: string) => state.getHeartbeats(key)!.map((h) => h.data.userActivity);

test('backfillAbsence erreicht den Vortag über Mitternacht', () => {
  const state = new ActivityState();
  state.setHeartbeats('2026-03-04', [hb('2026-03-04T23:55:00', 'active'), hb('2026-03-04T23:57:00', 'may_be_inactive'), hb('2026-03-04T23:59:30', 'may_be_inactive')]);
  state.setHeartbeats('2026-03-05', [hb('2026-03-05T00:01:00', 'may_be_inactive')]);
  backfillAbsence(state, at('2026-03-05T00:06:00'));
  expect(statuses(state, '2026-03-04')).toEqual(['active', 'inactive', 'inactive']);
  expect(statuses(state, '2026-03-05')).toEqual(['inactive']);
});

test('backfillAbsence überspringt leere Tage und hält beim letzten active an', () => {
  const state = new ActivityState();
  state.setHeartbeats('2026-03-05', [hb('2026-03-05T16:00:00', 'may_be_inactive'), hb('2026-03-05T17:00:00', 'active'), hb('2026-03-05T17:02:00', 'may_be_inactive')]);
  state.setHeartbeats('2026-03-09', [hb('2026-03-09T08:00:00', 'may_be_inactive')]);
  backfillAbsence(state, at('2026-03-09T08:10:00'));
  expect(statuses(state, '2026-03-05')).toEqual(['may_be_inactive', 'active', 'inactive']); // 16:00 gehört zu einer früheren Abwesenheit
  expect(statuses(state, '2026-03-09')).toEqual(['inactive']);
});

test('backfillAbsence ohne active in der Historie wandelt alles davor um und wirft nicht', () => {
  const state = new ActivityState();
  state.setHeartbeats('2026-03-04', [hb('2026-03-04T10:00:00', 'may_be_inactive')]);
  expect(() => backfillAbsence(state, at('2026-03-04T10:10:00'))).not.toThrow();
  expect(statuses(state, '2026-03-04')).toEqual(['inactive']);
});

test('findLastActiveTimestamp sucht über Tage', () => {
  const state = new ActivityState();
  state.setHeartbeats('2026-03-04', [hb('2026-03-04T23:52:00', 'active')]);
  state.setHeartbeats('2026-03-05', [hb('2026-03-05T00:01:00', 'may_be_inactive')]);
  expect(findLastActiveTimestamp(state, at('2026-03-05T07:30:00'))).toBe(at('2026-03-04T23:52:00'));
  expect(findLastActiveTimestamp(state, at('2026-03-04T23:00:00'))).toBeNull();
});
```

Dazu ein Store-Test in `src/store/ActivityStore.test.ts`, `describe('ActivityStore Integration')`: Lokal 23:55 letzte Eingabe, Heartbeats im 30-s-Takt (:15/:45) bis 00:40, mit den Statusregeln <60 s `active`, <600 s `may_be_inactive`, sonst `inactive`. Erwartet wird, dass am 2026-03-04 nach 23:56 kein `may_be_inactive` mehr übrig ist. Der Test fährt über `Date.now`-Mock und `addHeartbeat`, wie die bestehenden Integrationstests. Name: `Abwesenheit über Mitternacht wird im Vortag inaktiv`.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest src/store/AbsenceBackfill.test.ts src/store/ActivityStore.test.ts`
Expected: FAIL. `AbsenceBackfill` wird nicht gefunden, und der Mitternachtstest findet noch `may_be_inactive` am Vortag.

- [ ] **Step 3: Implement**

`handleMayBeInactive` unverändert nach `AbsenceBackfill.ts` verschieben und in `ActivityStore.ts` re-exportieren. `backfillAbsence` und `findLastActiveTimestamp` wie unter Interfaces beschrieben bauen. `updateHeartbeats` ruft bei `heartbeatData.userActivity === 'inactive'` die Funktion `backfillAbsence(this.activityState, timestamp)` auf, statt `handleMayBeInactive` nur auf den aktuellen Tag anzuwenden. Danach wird wie bisher der neue Heartbeat an den aktuellen Tag angehängt. Den alten Aufruf entfernen, damit keine doppelte Logik bleibt.

- [ ] **Step 4: Run all tests**

Run: `npm test`
Expected: PASS, inklusive der bestehenden `handleMayBeInactive`-Tests.

- [ ] **Step 5: Commit**

```bash
git add src/store/AbsenceBackfill.ts src/store/AbsenceBackfill.test.ts src/store/ActivityStore.ts src/store/ActivityStore.test.ts CLAUDE.md
git commit -m "fix: backfill absences across midnight and multiple days"
```

---

### Task 4: Ruhemodus zählt zur Abwesenheit (Regeln 3, 4, 6)

**Files:**
- Modify: `src/store/ActivityStore.ts` (Feld `suspendedAt`, Methode `markSuspend`, `addHeartbeat`, `startTracking`, `pauseTracking`)
- Modify: `src/main/main.ts` (Import `powerMonitor`; Handler im Block `if (!useMockData && activityStore && heartbeatManager)` bei Zeile ~232)
- Modify: `src/watchers/InactivityWatcher.ts` (Konstante aus `ABSENCE_THRESHOLD_MS`, veralteter Kommentar „fünf Heartbeats“)
- Create: `src/store/ActivityStore.absence.test.ts` (Electron-Mock wie in `ActivityStore.test.ts`)
- Modify: `docs/Engineering Design Dokument.md` §2.2.3 (neuer Absatz „Absences“) und §2.4.2

**Interfaces:**
- Consumes: `ABSENCE_THRESHOLD_MS`, `backfillAbsence`, `findLastActiveTimestamp` aus Task 3.
- Produces: `ActivityStore.markSuspend(timestamp: number = Date.now()): void`. Merkt `timestamp` nur bei `isTracking`. `startTracking` und `pauseTracking` setzen `suspendedAt = null`.

- [ ] **Step 1: Write the failing tests**

Store-Aufbau und Aufräumen wie in `describe('ActivityStore Integration')` (`useMockData: false`, `storagePath` unter `/tmp/nonexistent`, `cleanup()` in `afterEach`, `Date.now` wiederherstellen). Ein Test-Helper `simulate(store, baseIso, phases)` in der Testdatei bekommt Phasen `{ from, to, input?, sleep? }` in Minuten ab `baseIso` (lokal). Er erzeugt Heartbeats bei :15/:45 über `Date.now`-Mock und `store.addHeartbeat({ userActivity })`. Der Status kommt aus der Wandzeit seit der letzten Eingabe: <60 s `active`, <600 s `may_be_inactive`, sonst `inactive`. Zu Beginn einer `sleep`-Phase ruft er `store.markSuspend(start)` auf und überspringt die Heartbeats dieser Phase. Ein zweiter Helper `statusCounts(store, fromIso, toIso)` zählt die Status in einem Zeitfenster.

Tests (Beginn jeweils 08:00, 60 min Arbeit vorneweg):

| Name | Phasen nach der Arbeit | Erwartung |
|---|---|---|
| `8 min weg, dann 10 min Ruhemodus` | 8 weg, 10 sleep, Arbeit | zwischen letzter Eingabe +1 min und Ruhemodus nur `inactive`, kein `may_be_inactive` |
| `2 min weg, dann 3 min Ruhemodus` | 2 weg, 3 sleep, Arbeit | `may_be_inactive` bleibt, kein `inactive` |
| `Deckel sofort zu, 60 min` | 60 sleep, Arbeit | kein `inactive`, kein Heartbeat in der Lücke |
| `9 min weg ohne Ruhemodus` | 9 weg, Arbeit | `may_be_inactive` bleibt (Regression) |
| `Lücke ohne suspend zählt nicht` | 8 weg, 10 Lücke **ohne** `markSuspend`, Arbeit | `may_be_inactive` bleibt |
| `ignoriert suspend bei pausiertem Tracking` | 8 weg, `pauseTracking()`, `markSuspend`, 10 min später `startTracking()`, Arbeit | `may_be_inactive` bleibt |
| `erster Heartbeat nach Aufwachen ist inactive` | 8 weg, 10 sleep, dann 1 Heartbeat ohne Eingabe (Status `inactive`), dann Arbeit | wie Zeile 1, kein Fehler |
| `Ruhemodus ohne active in der Historie` | frischer Store: nur 3 `may_be_inactive`, `markSuspend`, 20 min später Heartbeat | wirft nicht, `may_be_inactive` bleibt |
| `über Mitternacht mit Ruhemodus` | Basis 2026-03-06T23:00, letzte Eingabe 23:52, sleep 00:02–07:30, Arbeit | 2026-03-06 nach 23:53 nur `inactive`; 2026-03-07 00:00–00:02 nur `inactive`; keine Heartbeats 00:02–07:30 |
| `Freitag bis Montag` | Fr 2026-03-06 letzte Eingabe 17:00, sleep ab 17:08, Mo 2026-03-09 08:00 Arbeit | Fr nach 17:01 nur `inactive`; Sa und So ohne Heartbeats |

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest src/store/ActivityStore.absence.test.ts`
Expected: FAIL. `markSuspend` ist keine Funktion. Danach scheitern `8 min weg, dann 10 min Ruhemodus`, `über Mitternacht mit Ruhemodus` und `Freitag bis Montag` mit verbleibenden `may_be_inactive`.

- [ ] **Step 3: Implement**

In `addHeartbeat` wird nach der Tageswechsel-Behandlung und vor `updateHeartbeats` geprüft: Ist `suspendedAt !== null`, dann `last = findLastActiveTimestamp(this.activityState, this.suspendedAt)`. Ist `last !== null && timestamp - last >= ABSENCE_THRESHOLD_MS`, folgt `backfillAbsence(this.activityState, timestamp)`. Danach in jedem Fall `suspendedAt = null`. Gemessen wird ab dem letzten `active`-Heartbeat. Das unterschätzt die Abwesenheit um höchstens ~60 s, also im Zweifel zugunsten von Arbeit. In `main.ts` kommt `powerMonitor.on('suspend', () => activityStore?.markSuspend())` in den Block, der das Tracking startet. Damit ist es im Mock-Modus nicht verdrahtet. `InactivityWatcher` nimmt `INACTIVE_THRESHOLD = ABSENCE_THRESHOLD_MS / 1000`, und der Kommentar „fünf Heartbeats“ wird auf 60 s / 10 min korrigiert.

- [ ] **Step 4: Update the spec doc**

In `docs/Engineering Design Dokument.md` §2.2.3 einen kurzen Absatz „Absences“ mit den Regeln 1–7 aus der Spec §2 ergänzen (Englisch, wie das Dokument). In §2.4.2 die Schwellen korrigieren: `active` unter 60 s Idle, `may-be-inactive` ab 60 s, `inactive` ab 600 s.

- [ ] **Step 5: Run full verification**

Run: `npm test`
Expected: PASS, alle Suites.

Run: `npm run build`
Expected: Erfolgreich (Test-Gate, `tsc`, webpack ohne Fehler).

- [ ] **Step 6: Commit**

```bash
git add src/store/ActivityStore.ts src/store/ActivityStore.absence.test.ts src/main/main.ts src/watchers/InactivityWatcher.ts "docs/Engineering Design Dokument.md"
git commit -m "fix: count system sleep toward absences without tracking it"
```

- [ ] **Step 7: Manueller Check auf echter Hardware (nicht automatisierbar, dem Nutzer melden)**

App mit `npm run dev` starten, 8 min nichts tun, PC manuell in den Ruhemodus schicken, nach 10 min aufwachen und weiterarbeiten. Erwartung: Die 8 min vor dem Ruhemodus sind inaktiv, und der Ruhemodus ist eine Lücke. Das Ergebnis meldet der Ausführende dem Nutzer, als bestanden oder nicht geprüft.
