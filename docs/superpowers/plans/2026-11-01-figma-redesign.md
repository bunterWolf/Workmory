# Figma-Redesign v2: Implementierungsplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Die Renderer-Oberfläche wird auf das Figma-Design umgestellt (kompaktes Fenster, Day View mit
Timeline, Settings-Ansicht, Light/Dark). Grundlage ist eine Token-Struktur, die Figma 1:1 spiegelt.

**Architecture:**
- `tokens.css` spiegelt die Figma-Variablen; Komponenten-CSS nutzt nur Tokens und benannte
  Figma-Konstanten.
- Die Timeline-Berechnung wandert in reine, getestete Funktionen (`timelineGeometry.js`). JS rechnet
  Zeit → Pixel, CSS übernimmt das Layout.
- Der einzige Eingriff im Main-Prozess ist lesend: ein Getter für den letzten Heartbeat und eine
  Benachrichtigung `heartbeat-added`.

**Tech Stack:** Electron 42, React 18 (plain JS), plain CSS, webpack 5, Jest 30 (ts-jest + babel-jest),
`@fontsource/inter`.

**Spec:** `docs/superpowers/specs/2026-11-01-figma-redesign-design.md` (immer zusammen mit diesem Plan
lesen).

**Figma:** Datei `BYAYmyZwAVg1mkrBqS2esP`. Lesen nur über den claude.ai-Figma-Connector
(`mcp__c1a9fc63-…__get_design_context` / `get_variable_defs` / `get_screenshot`). Der
`plugin:figma:figma`-Login hat keinen Zugriff. Der Connector bricht oft ab, deshalb Aufrufe einzeln
wiederholen und bei großen Nodes `excludeScreenshot: true` setzen.

## Global Constraints

- Farben, Größen und Radien in Komponenten-CSS **nur** als `var(--…)` aus `tokens.css`. Feste
  Figma-Maße, die keine Variablen sind, werden benannte Custom Properties oben in der
  Komponenten-CSS, mit Figma-Node-ID im Kommentar.
- Token-Namen: Figma-Name in kebab-case (`Ink 3` → `--ink-3`, `size/M` → `--size-m`,
  `Line Tracking` → `--line-tracking`). Farbwerte in `tokens.css` immer als Hex (`#rrggbb` oder
  `#rrggbbaa`), weil `eventColors.js` sie per `getComputedStyle` liest und parst.
- Jede Komponentendatei beginnt mit `// Figma: <Node-Name> <Node-ID>`.
- Schrift: Inter 500/600 lokal über `@fontsource/inter`, kein CDN. Alle Text-Klassen nutzen
  `text-box: trim-both cap alphabetic`.
- Tracking-, Aggregations- und Persistenz-Logik bleiben unverändert. Einzige erlaubte Store-Änderung:
  `getLatestAppWindow()` (nur lesend) und ein Notify-Aufruf am Ende von `addHeartbeat`.
- `npm test` muss nach jedem Task vollständig grün sein.
- Commits als Conventional Commits, jeweils mit dem Trailer
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- **Texte (i18n, de/en):**
  - `autoLaunchDescription`: „Automatisch starten, wenn du den Computer einschaltest.“ /
    „Start automatically when you turn on your computer.“
  - `betaReleases`: „Auf Beta-Versionen aktualisieren“ / „Update to beta releases“
  - `betaDescription`: „Frühzeitig auf neue Funktionen zugreifen. Gelegentliche Fehler sind möglich.“ /
    „Get early access to new features. Occasional bugs are possible.“
  - Neu: `summaryActive` Aktiv/Active, `summaryInactive` Inaktiv/Inactive, `summaryTracked`
    Erfasst/Tracked, `back` Zurück/Back, `minimize` Minimieren/Minimize, `appTitle` Workmory/Workmory,
    `placeholderLink` „www.appname.io“ (beide Sprachen)

## Review Focus

1. **Theme-Wechsel bei laufender App:** Event-Textfarben und Fallback-Farbe müssen sofort umspringen,
   nicht erst nach dem nächsten Daten-Update. Die Blend-Werte beider Themes sind in Task 5 getestet;
   das Umspringen selbst braucht DOM und `matchMedia` und wird in Task 6, Step 7 ohne Neustart
   geprüft.
2. **Rechter Abstand mit Scrollbar:** Events enden 24 px vor dem Fensterrand, egal ob die Timeline
   scrollt oder nicht (→ Task 6, `scrollbar-gutter: stable` + Messung in beiden Fällen).
3. **Einzelner 5m-Block (24 px):** Die Kopfzeile schrumpft, der Text bleibt zentriert und wird nicht
   abgeschnitten (→ Task 2, Test 5m-Block = 24 px; Task 6, Sichtprüfung).
4. **Auto-Scroll feuert genau einmal pro Tag-Anzeige:** nicht erneut beim Minuten-Update oder beim
   Intervallwechsel, aber wieder nach Wechsel auf einen anderen Tag und zurück zu „Heute“ (→ Task 7,
   Tests für `getScrollTarget` inkl. Inhalt kleiner als Viewport; Hook-Verhalten manuell geprüft).
5. **Fehlende Daten im laufenden Block:** Mock-Modus, letzter Heartbeat ohne `appWindow`, leerer
   Fenstertitel. Dann erscheint Standardtext bzw. nur der App-Name, keine leeren Trenner (→ Task 8,
   Store-Tests + `formatActivityTitle`-Tests).

---

### Task 1: Jest für JS-Tests + Timeline-Geometrie (Charakterisierung)

Die Logik aus `DayOverview.js` wird **unverändert** in reine Funktionen verschoben. Tests halten das
heutige Verhalten fest.

**Files:**
- Modify: `jest.config.js` (Transform für `.js`)
- Create: `src/components/timeline/timelineGeometry.js`
- Create: `src/components/timeline/timelineGeometry.test.js`
- Modify: `src/components/DayOverview.js` (nutzt die neuen Funktionen)

**Interfaces:**
- Produces:
  - `MIN_BLOCK_HEIGHT = 24`
  - `getHourHeight(intervalMin: 5|10|15): number`
  - `getHourRange({ events: TimelineEvent[], trackingBlock: {timestamp, duration}|null, isToday: boolean }): { minHour: number, maxHour: number }`
  - `getEventGeometry(event: {timestamp, duration}, minHour: number, pxPerMin: number): { top: number, height: number }`

- [ ] **Step 1: Jest erweitern.** In `jest.config.js` `transform: {}` ersetzen durch
  `{ '^.+\\.tsx?$': 'ts-jest', '^.+\\.jsx?$': ['babel-jest', { presets: [['@babel/preset-env', { targets: { node: 'current' } }], '@babel/preset-react'] }] }`.
  `roots` und die relative `testMatch` bleiben **unverändert**.
- [ ] **Step 2: Charakterisierungstests schreiben** in `timelineGeometry.test.js`. Alle Zeitstempel
  lokal bauen (`new Date(2026, 0, 5, h, m).getTime()`), damit die Tests unabhängig von der Zeitzone
  sind.
  - `getHourHeight`: 5 → 288, 10 → 144, 15 → 96
  - `getHourRange`, keine Events, kein Block → `{8, 12}`
  - keine Events, Block um 14:10, `isToday` → `{13, 16}`
  - Events 09:00–10:00 und 11:00–11:30 → minHour 8, maxHour 12 (Ende 11:30 → 12, Mindestspanne 3 h)
  - Event 09:00 mit 6 h Dauer → maxHour = min(23, 16 + 3) = 19
  - Event um 00:10 → minHour 0; Event bis 23:50 → maxHour 23
  - Events 09:00–10:00 plus Block 15:00, `isToday` → `{8, 17}`
  - Block wird bei `isToday: false` ignoriert
  - `getEventGeometry` (**altes** Verhalten): Start 09:30, 15 min, minHour 8, pxPerMin 1.6 →
    `{ top: 144, height: 22 }`; 1 min Dauer → `height: 14`
- [ ] **Step 3: Tests laufen lassen.** `npx jest src/components/timeline` → FAIL (Modul fehlt).
- [ ] **Step 4: Implementieren.** Code 1:1 aus `DayOverview.js:93-153` übernehmen (inkl.
  `longestEventHours > 4`-Regel und den Clamp-Reihenfolgen).
- [ ] **Step 5: `DayOverview.js` umstellen.** Es importiert die drei Funktionen; die lokalen Kopien
  werden gelöscht.
- [ ] **Step 6: Volle Suite.** `npm test` → alles PASS.
- [ ] **Step 7: Commit.** `refactor: extract timeline geometry into tested pure functions`

### Task 2: Geometrie, neue Regeln (TDD)

**Files:**
- Modify: `src/components/timeline/timelineGeometry.js`
- Modify: `src/components/timeline/timelineGeometry.test.js`

**Interfaces:**
- Produces:
  - `EVENT_OFFSET_Y = 1`
  - `MIN_EVENT_HEIGHT = 14`
  - `getHalfHourOffset(hourHeight: number): number`
  - `getEventGeometry` liefert `top = (Start − minHour·60)·pxPerMin + EVENT_OFFSET_Y` und
    `height = max(MIN_EVENT_HEIGHT, Dauer·pxPerMin)`

- [ ] **Step 1: Tests anpassen bzw. ergänzen (rot).**
  - Geometrie 09:30, 15 min, minHour 8, pxPerMin 1.6 → `{ top: 145, height: 24 }`
  - 5m-Block bei 5m-Intervall (pxPerMin 4.8) → `height: 24`
  - 1 min → `height: 14`
  - `getHalfHourOffset`: 144 → 72, 143 → 72, 288 → 144, 96 → 48
- [ ] **Step 2:** `npx jest src/components/timeline` → FAIL bei den neuen Erwartungen.
- [ ] **Step 3: Implementieren** (Konstanten exportieren, `−2` entfernen, Offset addieren).
- [ ] **Step 4:** `npm test` → PASS.
- [ ] **Step 5: Commit.** `feat: timeline geometry per Figma (1px offset, border gap, half-hour marker)`

### Task 3: Fundament: Tokens, Typografie, Inter

**Files:**
- Create: `src/styles/tokens.css`, `src/styles/typography.css`, `src/styles/base.css`
- Modify: `package.json` (`@fontsource/inter`, exakt auf die aktuelle Version pinnen), `webpack.config.js`
  (Regel `/\.(woff2?)$/` → `asset/resource`, Ausgabe `assets/fonts/[name][ext]`)
- Modify: `src/components/App.js` (Imports in der Reihenfolge `tokens.css`, `typography.css`,
  `base.css` **nach** den alten Styles)
- Modify: `src/components/App.css` (body- und Reset-Regeln entfernen, die jetzt in `base.css` stehen)

**Interfaces:**
- Produces:
  - alle Custom Properties aus Spec §4.2
  - Klassen `.text-m-primary`, `.text-m-default`, `.text-xl-default`

- [ ] **Step 1: `tokens.css` schreiben.**
  - Werte exakt aus Spec §4.2
  - Light in `:root`, Dark in `@media (prefers-color-scheme: dark) { :root { … } }`
  - Kopfkommentar je Gruppe: „Figma-Collection <Name>, Mode Light/Dark“, Dateikopf mit Verweis auf
    `docs/design/figma-map.md`
  - Vorher per `get_variable_defs` auf `84653:1076` und `84653:1077` gegenprüfen, ob sich Werte
    geändert haben. Bei Abweichung gelten die Figma-Werte; die Spec-Tabelle wird mitgezogen.
- [ ] **Step 2: `typography.css`** nach Spec §4.3.
  - `font-family: "Inter", system-ui, sans-serif`
  - `font-feature-settings` nur für Ziffern: `.text-*.tnum { font-variant-numeric: tabular-nums }`
- [ ] **Step 3: `base.css`.**
  - `@import '@fontsource/inter/500.css'; @import '@fontsource/inter/600.css';`
  - Reset (`box-sizing`, `margin`/`padding` 0)
  - `html, body, #app { height: 100% }`
  - `body { background: var(--surface-2); color: var(--ink); font-family: "Inter", system-ui, sans-serif; -webkit-font-smoothing: antialiased; overflow: hidden }`
- [ ] **Step 4: Prüfen.** `npm install`, dann `npx webpack --config webpack.config.js` → Build ohne
  Fehler, in `dist/assets/fonts/` liegen woff2-Dateien.
- [ ] **Step 5: Sichtprüfung.** `npm run dev:mock` → App startet, die Schrift ist Inter (DevTools →
  Computed → Rendered Fonts zeigt „Inter“).
- [ ] **Step 6: Commit.** `feat: add Figma design tokens, typography and bundled Inter`

### Task 4: UI-Bausteine: Icon, Button, Toggle, TrackingDot

**Files:**
- Create: `src/assets/icons/arrow_back.svg`, `arrow_forward.svg`, `arrow_drop_down.svg`,
  `more_horiz_20.svg`, `pause_circle.svg`
- Create: `src/components/ui/Icon.js`, `Icon.css`, `Button.js`, `Button.css`, `Toggle.js`,
  `Toggle.css`, `TrackingDot.js`, `TrackingDot.css`

**Interfaces:**
- Produces:
  - `<Icon name="arrow_back"|"arrow_forward"|"arrow_drop_down"|"more_horiz_20"|"pause_circle" size={20|24} />`
    Rendert ein `span` mit `mask-image: url(svg)` und `background-color: currentColor`, damit das Icon
    der Textfarbe folgt.
  - `<Button icon? label? onClick disabled ariaLabel title className />`
    Figma `84658:1616`: Padding `--size-s`, Radius 100px, Icon 20, Label-Wrapper `min-height: 20px`,
    Padding `0 var(--size-xs)`, `.text-m-primary`, Farbe `--ink`. Disabled per `disabled`-Attribut.
  - `<Toggle on onChange ariaLabel />`
    Figma `84699:3534`: 35 × 20, Padding 3 px, Radius `--size-xxl`, Knopf 14 px in `--surface`. An:
    Hintergrund `--ink`, `padding-left: 18px`. Aus: Hintergrund `--ink-4`, `padding-right: 18px`.
    `role="switch"`, `aria-checked`.
  - `<TrackingDot />`: Box 16 × 20, zwei zentrierte 5-px-Kreise in `--tracking`. Der vordere wird nach
    Spec §6.5 animiert (`@keyframes tracking-pulse`, 2 s, linear, infinite: 0 % → 5 px, Opacity 0.5;
    50.5 % → 16 px, Opacity 0; 100 % → 16 px, Opacity 0).

- [ ] **Step 1: SVGs holen.** `get_design_context` auf die Icon-Komponenten:
  - `84658:1621` (arrow_back), `84664:1382` (arrow_forward), `84672:1583` (arrow_drop_down),
    `84686:535` (more_horiz_20), `84678:1461` (pause_circle)
  - Die gelieferten Asset-URLs per `curl -L` speichern.
  - Die Dateien **nicht** verändern; die Farbe kommt über die Maske.
  - Root-`width`/`height` mit `ls`/`head -c 300` prüfen: 20 bzw. 24 px.
- [ ] **Step 2: Button-Zustände aus Figma lesen.** `get_design_context` auf `84658:1622`, sonst
  einzeln `84658:1623` (Hover), `84734:3006` (Pressed), `84734:2997` (Disabled).
  - Die Werte als `:hover`, `:active` und `:disabled` in `Button.css` übernehmen. Overlays als
    `::before` mit Token-Farbe und Opacity; Opacity-Werte als benannte Konstanten mit Node-ID.
  - **Liefert Figma die Zustände nicht, nicht raten:** Task anhalten und nachfragen.
- [ ] **Step 3: Komponenten umsetzen** nach den Interfaces oben.
- [ ] **Step 4: Build.** `npx webpack --config webpack.config.js` → keine Fehler.
- [ ] **Step 5: Commit.** `feat: add Figma UI primitives (Icon, Button, Toggle, TrackingDot)`

### Task 5: Event-Farben (TDD)

**Files:**
- Create: `src/components/timeline/eventColors.js`, `eventColors.test.js`,
  `src/components/timeline/useColorScheme.js`

**Interfaces:**
- Produces:
  - `parseHexColor(hex: string): { r, g, b, a }` (a ∈ 0..1; akzeptiert `#rrggbb` und `#rrggbbaa`,
    sonst Error)
  - `blendOver(baseHex: string, overlayHex: string): string`: Normal-Blend, Kanäle gerundet, Ergebnis
    `#rrggbb` in Kleinbuchstaben
  - `readCssColorVar(name: string): string`: `getComputedStyle(document.documentElement).getPropertyValue(name).trim()`
  - `useColorScheme(): 'light'|'dark'`: `matchMedia('(prefers-color-scheme: dark)')` mit
    `change`-Listener

- [ ] **Step 1: Tests (rot).**
  - `blendOver('#4750cb', '#00000066') === '#2b307a'`
  - `blendOver('#4750cb', '#ffffff66') === '#9196e0'`
  - `blendOver('#1a73e8', '#00000066') === '#10458b'`
  - `blendOver('#1a73e8', '#ffffff66') === '#76abf1'`
  - `blendOver('#d77655', '#00000066') === '#814733'`
  - `blendOver('#0f773d', '#ffffff66') === '#6fad8b'`
  - `parseHexColor('#ff57571a')` → `{ r: 255, g: 87, b: 87, a: 26/255 }`
  - `parseHexColor('red')` wirft
- [ ] **Step 2:** `npx jest src/components/timeline/eventColors` → FAIL.
- [ ] **Step 3: Implementieren.**
- [ ] **Step 4:** `npm test` → PASS.
- [ ] **Step 5: Commit.** `feat: event text color blend from EventInkMix token`

### Task 6: Timeline-UI (ersetzt DayOverview)

**Files:**
- Create: `src/components/timeline/Timeline.js`, `Timeline.css`, `TimelineHourGrid.js`,
  `TimelineEvent.js`, `TimelineEvent.css`, `useAppIcon.js` (aus `DayOverview.js` verschoben)
- Modify: `src/components/App.js` (rendert `<Timeline>` statt `<DayOverview>`, gleiche Props)
- Delete: `src/components/DayOverview.js`, `src/components/DayOverview.css`

**Interfaces:**
- Consumes:
  - Task 1/2: Geometrie-Funktionen
  - Task 4: `TrackingDot`
  - Task 5: `blendOver`, `readCssColorVar`, `useColorScheme`
- Produces:
  - `<Timeline activityData isLoading formatDuration aggregationInterval isTracking displayedDate currentActivityTitle />`
    (`currentActivityTitle` ist bis Task 8 `null`)
  - `Timeline` stellt den Scroll-Container per `scrollRef` und die Block-Geometrie für Task 7 bereit

- [ ] **Step 1: `Timeline.css`, Konstanten** exakt nach Spec §5.3, mit Node-IDs.
  - `.timeline`: `flex: 1; min-height: 0; overflow-y: auto; overflow-x: hidden; scrollbar-gutter: stable; background: var(--surface); padding: var(--tl-pad-y) 0`
  - `.timeline-content`: `position: relative; height: <Stunden · hourHeight>px`
- [ ] **Step 2: Scrollbar** über `::-webkit-scrollbar` nach Spec §5.6.
  - Breite `--tl-scrollbar-width`, Spur transparent, `margin-block: var(--tl-scrollbar-inset)`
  - Daumen mit `border: var(--tl-scrollbar-inset) solid transparent`, `background-clip: padding-box`,
    Farbe `color-mix(in srgb, var(--ink-4) calc(var(--tl-scrollbar-opacity) * 100%), transparent)`,
    Radius `--size-xxl`
- [ ] **Step 3: Event-Spalte.** `left: var(--tl-lane-left); right: calc(var(--tl-lane-right) - var(--tl-scrollbar-width))`
  (Figma misst 24 px ab Fensterrand; die Scrollbar-Spur liegt außerhalb der Content-Box).
- [ ] **Step 4: `TimelineHourGrid`.** Pro Stunde ein absolutes Element bei `top: i·hourHeight`.
  - Label-Box: `border-top: 1px solid var(--line-3)`, Padding `var(--tl-label-gap) 0 var(--tl-label-gap) var(--tl-label-inset)`,
    `.text-m-default`, Farbe `--ink-3`, Text über `formatHour` wie bisher (`timeFormats.time`)
  - Halbstunden-Marker bei `top: i·hourHeight + getHalfHourOffset(hourHeight)`,
    `left: var(--tl-half-marker-left)`, Breite `var(--tl-half-marker-width)`,
    `border-top: 1px solid var(--line-3)`
- [ ] **Step 5: `TimelineEvent`** nach Spec §6.1/6.2.
  - **Außen:** `border: 1px solid var(--surface); border-radius: var(--size-m); overflow: clip; isolation: isolate`
  - **Innen:** `border: 1px solid var(--event-background)` und Overlay-Ebene
    `background: var(--app-color); mix-blend-mode: overlay`
  - **Kopfzeile:** `max-height: 32px; padding: var(--size-m) var(--size-l); gap: var(--size-m); align-items: center`;
    Titelgruppe mit `gap: 6px`, Icon `--app-icon-size`, `.text-m-primary`, Ellipse
  - **App-Farbe:** `iconData.color`, sonst `readCssColorVar('--ink-3')`
  - **Textfarbe:** `blendOver(appColor, readCssColorVar('--event-ink-mix'))`, neu berechnet bei
    Änderung von `useColorScheme()`
  - **Inaktiv:** Hintergrund `--surface`, Text `--ink-2`, vorerst ohne Schraffur (Task 13)
  - **Laufend:** Hintergrund `--surface`, innen `border: 2px solid var(--line-tracking)`, `TrackingDot`,
    Titel `currentActivityTitle ?? t('trackingActivities')` in `--ink-3`, **keine** Dauer
  - Teams-Typ wie App-Fenster behandeln (Altdaten)
- [ ] **Step 6: Leer- und Ladezustand** übernehmen.
  - Rabe-Logo plus `noActivity`/`noActivitySub`, jetzt mit `.text-xl-default`/`.text-m-default` und
    `--ink`/`--ink-3`
  - Laden: Text `--ink-3` zentriert
- [ ] **Step 7: Verifikation** mit `npm run dev:mock`, Light und Dark (OS-Theme umschalten, **ohne**
  Neustart).
  - DevTools-Messungen:
    - Event links 76 px ab Fensterrand, rechts 24 px ab Fensterrand, und zwar **mit und ohne**
      Scroll-Überlauf (Fenster hoch ziehen, bis nichts mehr scrollt)
    - Abstand Event zur Stundenlinie 1 px
    - Label-Abstände 23/6 px
    - Marker 49/11 px
    - Scrollbar-Daumen 4 px breit, 5 px vom Rand
  - Teams-artige Events zeigen die Textfarbe aus Task 5.
  - Theme-Wechsel ändert Event-Textfarben sofort.
  - Intervalle 5/10/15 durchschalten → Stundenabstand 288/144/96 px.
- [ ] **Step 8:** `npm test` → PASS.
- [ ] **Step 9: Commit.** `feat: Figma timeline (hour grid, events, scrollbar) replaces DayOverview`

### Task 7: Auto-Scroll zum laufenden Block (TDD)

**Files:**
- Modify: `src/components/timeline/timelineGeometry.js`, `.test.js`, `Timeline.js`

**Interfaces:**
- Produces: `getScrollTarget({ blockTop: number, blockHeight: number, viewportHeight: number, padY: number }): number`.
  Rechnung: `max(0, padY + blockTop + blockHeight + padY − viewportHeight)`; die Blockunterkante liegt
  danach `padY` über dem unteren Rand.

- [ ] **Step 1: Tests (rot).**
  - `{500, 24, 300, 30}` → 284
  - `{10, 24, 300, 30}` → 0
  - Inhalt kleiner als Viewport `{50, 24, 800, 30}` → 0
- [ ] **Step 2:** `npx jest src/components/timeline` → FAIL.
- [ ] **Step 3: Implementieren.**
- [ ] **Step 4: Hook in `Timeline.js`.**
  - `useRef` merkt sich das Datum, für das schon gescrollt wurde.
  - Auslöser: Laufender Block vorhanden, Datum = heute, und für dieses Datum noch nicht gescrollt.
    Dann `scrollRef.current.scrollTop = getScrollTarget(...)` mit `padY = 30` (Konstante aus
    `Timeline.css` als JS-Konstante `TL_PAD_Y = 30` mit Kommentar-Verweis spiegeln).
  - Wechselt das Datum weg von heute, wird der Merker zurückgesetzt.
  - Minuten-Update und Intervallwechsel lösen **kein** erneutes Scrollen aus.
- [ ] **Step 5: Verifikation** mit `npm run dev`, echtes Tracking, Fenster 499 hoch, Tag mit
  Aktivität über mehr als 3 h:
  - Beim Start ist der laufende Block sichtbar.
  - Nach manuellem Hochscrollen bleibt die Position über einen Minutenwechsel stehen.
  - ← dann → scrollt wieder zum Block.
- [ ] **Step 6:** `npm test` → PASS.
- [ ] **Step 7: Commit.** `feat: auto-scroll timeline to running block once per day view`

### Task 8: Tracking-Titel „App · Fenstertitel“ (TDD, Main nur lesend)

**Files:**
- Modify: `src/store/ActivityStore.ts`, `src/store/ActivityStore.test.ts`, `src/store/ActivityIpc.ts`
- Create: `src/components/timeline/useCurrentActivity.js`,
  `src/components/timeline/formatActivityTitle.js`, `formatActivityTitle.test.js`
- Modify: `src/components/App.js` (Hook aufrufen, Titel an `Timeline` geben)

**Interfaces:**
- Produces:
  - `ActivityStore.getLatestAppWindow(): AppWindowData | null`: heutige Heartbeats
    (`getDateKey(Date.now())`) von hinten durchsuchen, erstes vorhandenes `data.appWindow` liefern,
    sonst `null`. **Kein** Schreibzugriff.
  - `ActivityIpc.notifyHeartbeatAdded(): void`: sendet `heartbeat-added` ohne Payload an alle Fenster
    (Muster wie `notifyTrackingStatusChange`)
  - IPC `get-current-activity` → `getLatestAppWindow()`; in `cleanup()` entfernen
  - `addHeartbeat`: nach `updateHeartbeats(...)` ruft es `this.ipcHandler?.notifyHeartbeatAdded()` auf.
    Sonst ändert sich nichts.
  - `formatActivityTitle(appWindow: {app, title}|null): string|null`:
    - `null` → `null`
    - leerer oder fehlender Titel → `app`
    - sonst `` `${app} · ${title}` `` (genau ein Leerzeichen um den Punkt)
  - `useCurrentActivity(enabled: boolean): string|null`: Bei `enabled` ruft es
    `invoke('get-current-activity')` beim Mount und bei jedem `heartbeat-added` auf und liefert
    `formatActivityTitle(result)`; Listener-Cleanup beim Unmount; bei `!enabled` liefert es `null`.
    `enabled = isTracking && displayedDate === heute`.

- [ ] **Step 1: Store-Tests (rot)** im Block „ActivityStore Integration“.
  - Drei Heartbeats per `addHeartbeat` mit gemocktem `Date.now` hinzufügen (VS Code/a.ts, Chrome/x,
    `{ userActivity: 'inactive' }` ohne `appWindow`) → `getLatestAppWindow()` liefert
    `{ app: 'Chrome', title: 'x' }`.
  - Ohne Heartbeats → `null`.
  - Die Anzahl der Heartbeats in `getDayData()` ist vor und nach dem Aufruf gleich.
- [ ] **Step 2: `formatActivityTitle`-Tests (rot):**
  - `({app:'Figma',title:'Workmory'})` → `'Figma · Workmory'`
  - `({app:'Figma',title:''})` → `'Figma'`
  - `(null)` → `null`
- [ ] **Step 3:** `npm test` → FAIL bei den neuen Tests.
- [ ] **Step 4: Implementieren** (Store, IPC, Hook, Format, Verdrahtung in App → Timeline).
- [ ] **Step 5:** `npm test` → PASS, inklusive aller bestehenden Aggregations-Tests.
- [ ] **Step 6: Verifikation** mit `npm run dev`. App-Fenster wechseln → spätestens nach dem nächsten
  Heartbeat (30 s) zeigt der laufende Block die neue App und den Fenstertitel. Im Mock-Modus erscheint
  der Standardtext.
- [ ] **Step 7: Commit.** `feat: show live app and window title in running timeline block`

### Task 9: Fenster & Titelleiste

**Files:**
- Modify: `src/main/main.ts` (`createWindow` ab Zeile 100, Theme-Hintergrund)
- Create: `src/components/window/WindowTitleBar.js`, `WindowTitleBar.css`
- Modify: `src/components/App.js` (`<WindowTitleBar />` statt `<WindowChrome />`)
- Delete: `src/components/WindowChrome.js` (und die `wc-*`-Regeln in `workmory.css`, nachdem die
  Mac-Ampel-Styles nach `WindowTitleBar.css` umgezogen sind)

**Interfaces:**
- Produces:
  - Fenster `width: 387, height: 499, minWidth: 387, minHeight: 360, frame: false`
  - `backgroundColor` = `nativeTheme.shouldUseDarkColors ? '#0a0a0a' : '#ffffff'` (Konstante
    `SURFACE_2` mit Kommentar „spiegelt --surface-2 in tokens.css“)
  - `nativeTheme.on('updated')` → `mainWindow.setBackgroundColor(...)`

- [ ] **Step 1: `main.ts` anpassen** wie oben. `window-maximize`-IPC bleibt (Mac).
- [ ] **Step 2: `WindowTitleBar`** nach Spec §7.1.
  - Höhe 32, Hintergrund `--surface-2`, `-webkit-app-region: drag`
  - Titel `t('appTitle')`, `.text-m-primary`, `--ink-3`, `padding-left: var(--size-xxl)`
  - Windows: Buttons 46 × 32, `-webkit-app-region: no-drag`,
    `font-family: "Segoe Fluent Icons", "Segoe MDL2 Assets"`, 10 px, Glyphen `` (Minimieren)
    und `` (Schließen), Farbe `--ink`, `aria-label` aus `minimize`/`close`
  - Hover: Minimieren `--line-3`, Schließen `#c42b1c` mit weißer Glyphe (Windows-Standard;
    Konstante mit Kommentar „OS-Konvention, nicht in Figma“)
  - Mac: bestehende Ampel-Buttons links, danach der Titel
- [ ] **Step 3: Verifikation** mit `npm run dev:mock`.
  - Fenster öffnet mit 387 × 499; kleiner als 387 × 360 geht nicht.
  - Ziehen an der Titelleiste bewegt das Fenster.
  - Minimieren und Schließen funktionieren.
  - Beim Theme-Wechsel blitzt beim Ziehen bzw. Größenändern kein Weiß auf.
- [ ] **Step 4:** `npm test` → PASS.
- [ ] **Step 5: Commit.** `feat: compact window and Figma title bar with theme-aware background`

### Task 10: Toolbar (ersetzt Header)

**Files:**
- Create: `src/components/toolbar/Toolbar.js`, `Toolbar.css`, `DateNav.js`, `IntervalPicker.js`,
  `IntervalPicker.css`, `TrackingButton.js`, `TrackingButton.css`
- Modify: `src/components/App.js` (`<Toolbar>` statt `<Header>`, gleiche Props)
- Delete: `src/components/Header.js`, `src/components/Header.css`

**Interfaces:**
- Consumes: `Button`, `Icon`, `TrackingDot` (Task 4)
- Produces: `<Toolbar selectedDate availableDates onDateChange isTracking onToggleTracking isMockData aggregationInterval onIntervalChange />`

- [ ] **Step 1: `Toolbar.css`** nach Spec §7.2.
  - Höhe 60, `padding: var(--size-m) var(--size-xxl) var(--size-m) var(--size-m)`, Hintergrund
    `--surface-2`
  - linke und rechte Gruppe mit `gap: var(--size-s)`, Pfeile ohne Abstand untereinander
- [ ] **Step 2: `DateNav`.**
  - Navigationslogik aus `Header.js:38-53` übernehmen.
  - Label: `today`/`yesterday` wie bisher; sonst `` `${t('timeFormats.weekday',{date})}, ${t('timeFormats.dateShort',{date})}` ``.
  - `.text-m-primary`, `--ink`.
- [ ] **Step 3: `IntervalPicker`.**
  - Auslöser ist ein `Button` mit Label `` `${value}m` ``, ohne Icon (Figma-Instanz `84671:1463`).
  - Das aufgeklappte Menü ist die bestehende Slider-Auswahl aus `Header.js:122-178`, nur auf Tokens
    umgestellt: Flyout `--surface-2`, Rand `--line`, Radius `--size-m`, Marken `.text-m-default`,
    aktiv `--ink`, sonst `--ink-3` (Figma `84672:1736`).
  - Kein neues Design (laut Spec TODO).
- [ ] **Step 4: `TrackingButton`** (Figma `84678:1437`).
  - Breite 110, Padding `--size-s`, Radius 100px
  - *Tracking*: Hintergrund `--ink`, `TrackingDot`, Label `t('tracking')` in `--surface`
  - *Paused*: transparent, `Icon pause_circle`, Label `t('paused')` in `--ink`, Hover-Layer aus Task 4
  - Im Mock-Modus wird er wie bisher nicht gerendert.
- [ ] **Step 5: Verifikation** mit `npm run dev:mock` und `npm run dev`.
  - Toolbar 60 px hoch; Pfeile 36 × 36.
  - → ist an „Heute“ deaktiviert.
  - Intervall wechseln funktioniert.
  - Tracking/Paused schaltet um.
  - Bei 387 px Breite gibt es keinen Umbruch.
- [ ] **Step 6:** `npm test` → PASS.
- [ ] **Step 7: Commit.** `feat: Figma toolbar (date nav, interval trigger, tracking button) replaces Header`

### Task 11: Footer + Ansichtswechsel

**Files:**
- Create: `src/components/footer/Footer.js`, `Footer.css`, `DaySummary.js`
- Modify: `src/components/App.js`
  - „…“ ruft `onOpenSettings` auf, das bis Task 12 weiter das bestehende `SettingsModal` öffnet
  - Zusammenfassung: Active = `totalActiveDuration`, Inactive = `totalInactiveDuration`,
    Tracked = `activeTrackingDuration`
- Modify: `src/i18n.js` (neue Keys laut Global Constraints)
- Delete: `src/components/Footer.js`, `src/components/Footer.css` (alt, liegen direkt in
  `components/`)

**Interfaces:**
- Produces:
  - `<Footer summary={{active, inactive, tracked}} isMockData onOpenSettings />`
  - `<DaySummary items={[{value, label}]} />`

- [ ] **Step 1: `Footer.css`** nach Spec §7.4.
  - `padding: var(--size-l) var(--size-xxl)`, rechtsbündig, `position: relative`
  - Menü-Button absolut `left: 20px; top: 7px`, 28 × 28, Padding `--size-xs`, `Icon more_horiz_20`
- [ ] **Step 2: `DaySummary`.**
  - Je Eintrag Wert (`.text-m-primary .tnum`, `--ink`) plus Label (`.text-m-default`, `--ink-3`)
  - Abstand 4 px innerhalb, 16 px zwischen den Einträgen
  - Reihenfolge Active, Inactive, Tracked
- [ ] **Step 3: Mock-Hinweis** `t('mockData')` als `.text-m-default` in `--ink-4` links vom
  Summary.
- [ ] **Step 4: Verifikation.**
  - Footer 41 px hoch.
  - Die Werte entsprechen denen vor dem Umbau (dieselben Summary-Felder).
  - „…“ öffnet die Einstellungen (bis Task 12 noch das alte Modal).
- [ ] **Step 5:** `npm test` → PASS.
- [ ] **Step 6: Commit.** `feat: Figma footer with day summary and settings entry`

### Task 12: Settings-Ansicht (ersetzt SettingsModal)

**Files:**
- Create: `src/components/settings/SettingsView.js`, `SettingsView.css`,
  `StoreLocationSetting.js`, `SettingRow.js`
- Modify: `src/components/App.js`
  - State `view: 'day'|'settings'` ersetzt `settingsModalOpen`
  - `onOpenSettings` setzt `'settings'`
  - `view === 'settings'` rendert `SettingsView` statt Toolbar, Timeline und Footer
  - ← setzt `'day'`
- Modify: `src/i18n.js` (Texte laut Global Constraints)
- Delete: `src/components/SettingsModal.js`, `src/components/SettingsModal.css`

**Interfaces:**
- Produces:
  - `<SettingsView onBack />`
  - `<SettingRow control? title description>{children}</SettingRow>`
    Figma `84699:2276`: Padding `--size-l`, `gap: var(--size-l)`; Textspalte mit
    `gap: var(--size-m)`, Titel `.text-m-primary` in `--ink`, Beschreibung `.text-m-default` in
    `--ink-2`

- [ ] **Step 1: Kopf.** `SettingsView`-Toolbar wie Task 10 (Höhe 60, gleiches Padding), `Button`
  mit `arrow_back` plus `t('settings')`. Inhaltsbereich mit Hintergrund `--surface`,
  `padding: 0 var(--size-m) var(--size-m)`, scrollbar.
- [ ] **Step 2: Logik übernehmen.** Laden, Autostart, Beta, Fehler und Version **unverändert** aus
  `SettingsModal.js:28-165` übernehmen (dieselben IPC-Kanäle).
  - Autostart- und Beta-Zeile mit `Toggle`.
  - Fehlermeldung als Zeile in `--tracking`, mit Schließen-Button.
- [ ] **Step 3: `StoreLocationSetting`** (laut Nutzerentscheidung im Figma-Stil behalten).
  - `SettingRow` ohne Toggle: Titel `activityStoreLocation`, Beschreibung
    `activityStoreDescription`, Pfad als `.text-m-default` in `--ink-3` mit Ellipse
  - Text-`Button`s `changePath` und `resetToDefault`
  - Bestätigung „Datei existiert“ als Inline-Zeile mit den Buttons `useExistingFile` und `cancel`
    statt eines zweiten Modals
  - Logik 1:1 aus `SettingsModal.js:66-132`
- [ ] **Step 4: Fuß.** Abstandhalter `flex: 1`, darunter eine Zeile (Padding `--size-l`) mit
  `t('placeholderLink')` und `t('version') + ' ' + appVersion`, beide `.text-m-default` in `--ink-2`.
  Nicht verlinkt (local-only).
- [ ] **Step 5: Verifikation** in `npm run dev`.
  - Autostart und Beta schalten, Werte bleiben nach Neustart erhalten.
  - Speicherort ändern, zurücksetzen und „existierende Datei“ funktionieren wie vorher.
  - Light und Dark gegen `84705:4120`/`84705:4351` prüfen: Toggle 35 × 20, Zeilen-Padding 16.
- [ ] **Step 6:** `npm test` → PASS.
- [ ] **Step 7: Commit.** `feat: Figma settings view replaces settings modal`

### Task 13: Inaktiv-Schraffur in CSS (niedrige Priorität)

**Files:**
- Modify: `src/components/timeline/TimelineEvent.css`

- [ ] **Step 1: Bild abmessen.** `get_design_context` auf `84653:1247` (Inactive-Variante) liefert
  die Asset-URL `…/442f5.png`. In den Scratchpad laden und ansehen: Winkel, Streifenbreite und
  Periode messen.
- [ ] **Step 2: Umsetzen.** `background-image: repeating-linear-gradient(<Winkel>, color-mix(in srgb, var(--ink) 9%, transparent) 0 <Breite>, transparent <Breite> <Periode>)`
  auf der Inaktiv-Ebene. Die Werte werden benannte Konstanten mit Node-ID `84653:1248`.
- [ ] **Step 3: Verifikation.** Light-Screenshot neben Figma `84653:1076` (Inactive-Block); Dark zeigt
  helle Streifen.
- [ ] **Step 4: Commit.** `feat: theme-aware inactive hatch in CSS`

### Task 14: Aufräumen, Doku, Gesamtabnahme

**Files:**
- Delete: `src/components/Icons.js`, `src/styles/colors_and_type.css`, `src/styles/workmory.css`
- Modify: `src/components/App.js` (alte Style-Imports raus), `src/components/App.css` (nur noch
  `#app`-Glue und `.update-notification` auf Tokens)
- Create: `docs/design/figma-map.md`
- Modify: `CLAUDE.md` (Styles/Layout-Abschnitte, Doku-Tabelle), `docs/Engineering Design Dokument.md`
  (Renderer-Struktur, IPC `get-current-activity`/`heartbeat-added`)

- [ ] **Step 1: Reste suchen.** `grep -rn "wmk-\|wm-\|--fg-\|--bg-\|--wm-\|Icons'" src` → keine
  Treffer außerhalb gelöschter Dateien. Treffer auf Tokens umstellen.
- [ ] **Step 2: `figma-map.md`.**
  - Tabelle Figma-Node/Variable → Datei/Klasse/Token für alle in diesem Plan genannten Node-IDs
  - Update-Checkliste aus Spec §13
  - Hinweis auf Main-Konstante `SURFACE_2`, die bei Änderung von `Surface 2` mitzuziehen ist
  - Hinweis zum Figma-Zugang über den Connector
- [ ] **Step 3: Gesamtabnahme** nach Spec §12.
  - `npm test` → PASS.
  - `npm run build` → erfolgreich.
  - `npm run dev:mock` in Light und Dark: alle Messungen aus Spec §12 einmal komplett durchgehen,
    Ergebnis als Tabelle (Soll/Ist) in den Commit-Text bzw. die PR-Beschreibung.
- [ ] **Step 4: Commit.** `chore: remove legacy styles, add figma-map and update docs`
