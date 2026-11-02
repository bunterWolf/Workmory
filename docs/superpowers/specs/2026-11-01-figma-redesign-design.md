# Figma-Redesign v2: Design-Spec

**Datum:** 2026-11-01 · **Branch:** `redesign-figma-v2` · **Status:** Entwurf zur Freigabe

## 1. Ziel

Die Workmory-Oberfläche wird auf das neue Figma-Design umgestellt: kompaktes Fenster, neue Day View
mit Timeline, Settings-Ansicht, Light und Dark Mode. Gleichzeitig entsteht eine Struktur, in der sich
spätere Änderungen aus Figma schnell und nachvollziehbar übernehmen lassen.

**Figma-Quelle:** Datei `BYAYmyZwAVg1mkrBqS2esP` („Workmory“)

| Frame | Node-ID |
|---|---|
| Day View, Light | `84653:1076` |
| Day View, Dark | `84653:1077` |
| Settings, Light | `84705:4120` |
| Settings, Dark | `84705:4351` |
| Components | `84705:4012` |

> Zugriff: Der Figma-Connector mit dem Wilddesign-Account kann die Datei lesen. Der Plugin-Login
> (gmail) hat keinen Edit-Zugriff, und der MCP-Server liest nur mit Edit-Rechten.

## 2. Grundsätze

1. **Figma ist die Quelle für Aussehen, der Code für Verhalten.** Farben, Größen, Typografie und
   Abstände kommen aus Figma. Zoomstufe, Auflösung und Beispieldaten der Timeline in Figma sind nur
   Illustration; die bestehende Größenberechnung der App bleibt maßgeblich (siehe §5).
2. **Tokens nur in `tokens.css`.** Komponenten-CSS verwendet ausschließlich `var(--…)`. Feste
   Figma-Pixelwerte, die keine Variablen sind, werden als benannte CSS-Konstanten oben in der
   Komponenten-CSS definiert, jeweils mit Figma-Node-ID im Kommentar.
3. **Eine Komponente im Code entspricht einer Figma-Komponente.** Gleicher Name, Node-ID im Dateikopf.
4. **Kein Nebeneinander von Alt und Neu.** Ersetzte Dateien werden entfernt (siehe §9).
5. **Tracking-, Aggregations- und Speicher-Logik bleiben unberührt.** Einzige Ausnahme ist ein rein
   lesender Zugriff auf den letzten Heartbeat (§7.3).

## 3. Dateistruktur

```
src/styles/
  tokens.css         Figma-Variablen 1:1 (Light in :root, Dark per prefers-color-scheme)
  typography.css     Figma-Textstile als Klassen
  base.css           Reset, body, @font-face Inter
                     (Inter 500/600 über das npm-Paket @fontsource/inter, gebündelt von webpack)
src/components/
  App.js             Shell: Ansichtswechsel Day View ↔ Settings, Datenladen (wie heute)
  window/            WindowTitleBar.js/.css
  toolbar/           Toolbar, DateNav, IntervalPicker, TrackingButton
  timeline/          Timeline, TimelineHourGrid, TimelineEvent, timelineGeometry.js (+ .test.js),
                     useAppIcon.js
  footer/            Footer, DaySummary
  settings/          SettingsView, SettingRow, StoreLocationSetting
  ui/                Button, Toggle, Icon
src/assets/icons/    SVGs aus Figma (arrow_back, arrow_forward, arrow_drop_down, more_horiz_20,
                     pause_circle, tracking)
docs/design/figma-map.md   Figma-Node → Datei/Klasse/Token, plus Update-Checkliste
```

**Inter wird lokal mitgeliefert.** Bisher steht Inter nur im Font-Stack, ist aber nicht installiert;
Windows rendert deshalb Segoe UI. Eingebunden wird die Schrift über `@fontsource/inter`; webpack
bündelt die woff2-Dateien in die App. Es gibt kein CDN, die App bleibt local-only. Die Segoe Fluent Icons der Titelleiste kommen vom System (Windows).

## 4. Tokens (`tokens.css`)

### 4.1 Benennung

Der Figma-Name wird zu kebab-case: `Ink 3` → `--ink-3`, `size/M` → `--size-m`,
`EventInkMix` → `--event-ink-mix`, `Line Tracking` → `--line-tracking`, `Surface 2` → `--surface-2`,
`AppIconSize` → `--app-icon-size`.

### 4.2 Werte

| Figma | CSS | Light | Dark |
|---|---|---|---|
| Ink | `--ink` | #0a0a0a | #f5f5f5 |
| Ink 2 | `--ink-2` | #404040 | #b4b4b4 |
| Ink 3 | `--ink-3` | #737373 | #8a8a8a |
| Ink 4 | `--ink-4` | #a3a3a3 | #5c5c5c |
| Line | `--line` | #a3a3a3 | #262626 |
| Line 3 | `--line-3` | #00000017 | #ffffff17 |
| Line Tracking | `--line-tracking` | #ff57571a | #ff575733 |
| Tracking | `--tracking` | #ff5757 | #ff5757 |
| Surface | `--surface` | #fbfaf9 | #141414 |
| Surface 2 | `--surface-2` | #ffffff | #0a0a0a |
| EventBackground | `--event-background` | #e8e8e8 | #1c1c1c |
| EventInkMix | `--event-ink-mix` | #00000066 | #ffffff66 |
| size/XS · S · M · L · XL · XXL | `--size-xs` … `--size-xxl` | 4 · 8 · 12 · 16 · 20 · 24 px | gleich |
| AppIconSize | `--app-icon-size` | 16 px | gleich |

Die Figma-Variablen `Teams`, `Chrome`, `Claude` und `Excel` sind Beispieldaten und kommen **nicht**
in `tokens.css`. Die App-Farbe ist zur Laufzeit die aus dem App-Icon extrahierte Farbe
(`get-app-icon` → `color`).

### 4.3 Typografie (`typography.css`)

| Figma-Stil | Klasse | Definition |
|---|---|---|
| M/Primary | `.text-m-primary` | Inter Medium 500, `--size-m`, line-height 18px, letter-spacing 0 |
| M/Default | `.text-m-default` | Inter Medium 500, `--size-m`, line-height 1.4, letter-spacing 0 |
| XL/Default | `.text-xl-default` | Inter Semi Bold 600, `--size-xl`, line-height 1.4, letter-spacing −0.08px |

Alle Texte nutzen wie in Figma `text-box: trim-both cap alphabetic`. Electron 42 unterstützt das.

### 4.4 Offene Punkte in Figma

- Inactive-Text („Inactive“, Dauer) ist noch als Hex eingetragen (#454545 / #b9b9b9). **Entscheidung:**
  In Figma an `Ink 2` binden; der Code nutzt `--ink-2`.

## 5. Timeline

### 5.1 Was bleibt (Verhalten)

- **Stundenhöhe** = `MIN_BLOCK_HEIGHT (24) × 60 / Intervall`, also 5m = 288 px, 10m = 144 px,
  15m = 96 px.
- **Stundenbereich:** Angezeigt werden nur die aktiven Zeiten mit Puffer: erste Aktivität minus 1 h,
  Ende nach der letzten Aktivität, Verlängerung bei sehr langen Events, Mindestspanne 3 h, Grenzen
  0–23 Uhr, laufender Block einbezogen. Die Logik ist identisch mit dem heutigen Stand in
  `DayOverview.js`.
- **Laufender Block:** Intervall-Block ab der aktuellen Intervallgrenze, wird jede Minute neu
  berechnet, nur bei „Heute“ und nur wenn Tracking aktiv ist.

### 5.2 Aufteilung

`timeline/timelineGeometry.js` enthält reine Funktionen ohne React und ohne DOM:

- `getHourHeight(intervalMin)`
- `getHourRange(events, trackingBlock, isToday)` → `{ minHour, maxHour }`
- `getEventGeometry(event, minHour, pxPerMin)` → `{ top, height }`
- `getHalfHourOffset(hourHeight)` → `Math.round(hourHeight / 2)`
- `getScrollTarget(trackingBlock, minHour, pxPerMin, viewportHeight)` → scrollTop

JS rechnet nur **Zeit → Pixel** und setzt `--hour-height` am Timeline-Container. Alle seitlichen und
inneren Abstände stehen in `Timeline.css`.

### 5.3 Layout-Konstanten (`Timeline.css`)

| Konstante | Wert | Figma-Herkunft |
|---|---|---|
| `--tl-pad-y` | 30 px | Scroll-Container `2066:772`, Padding oben/unten |
| `--tl-lane-left` | 76 px | Event-Spalte `2067:795`, links |
| `--tl-lane-right` | 24 px | Event-Spalte `2067:795`, rechts, gemessen ab Fensterrand. Im CSS wird die Scrollbar-Breite abgezogen (`scrollbar-gutter: stable`), weil die native Spur Platz belegt. |
| `--tl-event-offset-y` | 1 px | Event-Spalte `2067:795`, top |
| `--tl-label-inset` | 23 px | Label-Box `84783:3210`, Padding links |
| `--tl-label-gap` | 6 px | Label-Box `84783:3210`, Padding oben (Linie → Text) |
| `--tl-label-pad-right` | 12 px | Zeile `84783:3209`, Padding rechts |
| `--tl-half-marker-left` | 49 px | Marker-Container `84783:3212`, Padding links |
| `--tl-half-marker-width` | 11 px | Marker `84783:3213` |
| `--tl-scrollbar-width` | 14 px | Scrollbar `84766:1347` |
| `--tl-scrollbar-inset` | 5 px | Scrollbar `84766:1347`, Padding |
| `--tl-scrollbar-thumb` | 4 px | Daumen `84769:1359` |
| `--tl-scrollbar-opacity` | 0.36 | Daumen `84769:1359` |

### 5.4 Marker

- **Stundenlinie:** 1 px `--line-3`, oben an der Label-Box. Sie läuft **nur unter dem Label** (Breite
  = Label-Einzug + Textbreite), nicht über die ganze Spalte.
- **Stunden-Label:** Format wie bisher (`timeFormats.time`), `.text-m-default`, Farbe `--ink-3`,
  rechtsbündig, Abstand zur Linie `--tl-label-gap`.
- **Halbstunden-Marker:** 1 px `--line-3`, Breite `--tl-half-marker-width`, links
  `--tl-half-marker-left`, vertikal bei `getHalfHourOffset(hourHeight)` (bei 143 px ergibt das 72 px,
  wie in Figma).
- Position der Stunde *i*: `top = i × hourHeight` innerhalb des Inhaltsbereichs, also unterhalb von
  `--tl-pad-y`.

### 5.5 Event-Position (geändert)

- `top = (Startminute − minHour × 60) × pxPerMin + 1` (der Wert aus `--tl-event-offset-y`).
- `height = max(14, Dauer in Minuten × pxPerMin)`. **Der bisherige Abzug von −2 px entfällt.** Die
  Lücke zwischen benachbarten Events entsteht wie in Figma durch den 1-px-Rand in `--surface` an jedem
  Event (sichtbar 2 px).
- Horizontal: `left: --tl-lane-left; right: --tl-lane-right`.

### 5.6 Scrollen

- Der Timeline-Container scrollt nativ: `overflow-y: auto`, `overflow-x: hidden`, Hintergrund
  `--surface`, Padding `--tl-pad-y` oben und unten.
- **Scrollbar** über `::-webkit-scrollbar`: Breite 14 px; Daumen 4 px sichtbar (5 px transparenter
  Rand, `background-clip: padding-box`), Farbe `color-mix(in srgb, var(--ink-4) 36%, transparent)`,
  Radius `--size-xxl`; Spur transparent, beginnt/endet bei `--tl-pad-y` (30 px), sodass der Daumen wie in Figma 35 px unter dem oberen Rand beginnt.
- **Kein Scroll-Fade** (in Figma entfernt).
- **Auto-Scroll (neu):** Beim Öffnen und beim Wechsel auf „Heute“ scrollt die Timeline **einmal** so,
  dass der laufende Block sichtbar ist. Danach scrollt nur noch der Nutzer. Ein minütliches
  Neuberechnen des Blocks löst kein erneutes Scrollen aus.

## 6. Events (`TimelineEvent`)

### 6.1 Aufbau (`.Event-Master`, `2007:199`)

- **Außen:** Radius `--size-m`, Rand 1 px `--surface`, `overflow: clip`.
- **Innen:** Rand 1 px `--event-background`, Radius `--size-m`.
- **Kopfzeile:** `max-height: 32px`, Padding `--size-m` vertikal und `--size-l` horizontal, Abstand
  `--size-m` zwischen Titel und Dauer. Icon (`--app-icon-size`) und Titel mit 6 px Abstand.
  `.text-m-primary`, Titel einzeilig mit Ellipse, Dauer rechtsbündig.
- **Kurze Blöcke:** Die Kopfzeile schrumpft unter 32 px mit, der Inhalt bleibt vertikal zentriert.

### 6.2 Varianten

| Variante | Hintergrund | Text |
|---|---|---|
| App-Fenster | `--event-background`, darüber eine Ebene in App-Farbe mit `mix-blend-mode: overlay` | App-Farbe gemischt mit `--event-ink-mix` (§6.3) |
| Inaktiv | `--surface` plus Schraffur (§6.4) | `--ink-2` |
| Laufend (Tracking) | `--surface`, Rand 2 px `--line-tracking` | Titel `--ink-3`, Dauer ausgeblendet |

### 6.3 Textfarbe

Die Textfarbe entsteht wie in Figma: App-Farbe, darüber `--event-ink-mix` normal überblendet.
Umsetzung als getestete JS-Funktion `blendOver(appColor, inkMix)` in `timeline/eventColors.js`. Der
Token-Wert wird zur Laufzeit per `getComputedStyle` aus `tokens.css` gelesen und bei einem
Theme-Wechsel neu berechnet. Eine reine CSS-Formel kann die Fallback-Farbe `--ink-3` nicht mit dem
Token mischen, deshalb JS.

**Prüfwerte aus Figma:** Teams #4750cb ergibt #2b307a (Light) und #9196e0 (Dark). Chrome #1a73e8
ergibt #10458b (Light) und #76abf1 (Dark).

Events ohne auflösbares Icon nutzen als App-Farbe `--ink-3`.
Grenzfälle bei sehr dunklen oder sehr hellen Markenfarben sind **nicht Teil dieser Spec** (eigenes
Thema).

### 6.4 Schraffur (niedrige Priorität)

Statt des Bildes aus Figma wird die Schraffur mit CSS gezeichnet: `repeating-linear-gradient` in
`--ink` mit 9 % Deckkraft. Winkel und Streifenabstand werden am Figma-Bild (`442f5.png`) abgemessen.
Im Dark Mode werden die Streifen dadurch automatisch hell. Für die Schraffur entsteht kein neues Token.

### 6.5 Laufender Block

- **Titel (neu):** „App · Fenstertitel“ des letzten Heartbeats, aktualisiert mit jedem Heartbeat
  (Figma-Annotation am Tracking-Event). Ohne Daten erscheint wie bisher der Text `trackingActivities`.
- **Icon:** pulsierender Punkt in `--tracking`, Box 16 × 20. Animation nach Figma (`84678:838`):
  ein 5-px-Punkt wächst innerhalb von ca. 1 s (Anteil 0,505 der Laufzeit) auf 16 px, die Deckkraft
  sinkt dabei von 0,5 auf 0. Das wiederholt sich alle 2 s. Darunter liegt ein statischer 5-px-Punkt.
  Umgesetzt als CSS-`@keyframes`.

## 7. Screens

### 7.1 Fenster und Titelleiste

- **Startgröße 387 × 499**, frei skalierbar. **Mindestgröße 387 × 360**: Die Design-Breite ist die
  kleinste Breite, bei der Toolbar und Footer ohne Umbruch passen. Bei 360 px Höhe bleibt noch etwa
  eine Stunde Timeline sichtbar.
- **Fenster** rahmenlos (wie heute). **Ecken und Schatten kommen vom System** (Windows 11 rundet mit
  8 px), weil transparente Fenster unter Windows nicht zuverlässig in der Größe änderbar sind. Radius
  16 und Schatten im Figma-Frame stellen das OS-Fenster dar.
- **Titelleiste:** 32 px, Hintergrund `--surface-2`. Titel „Workmory“ (in Figma steht als Platzhalter
  „Missing Hours“), `.text-m-primary`, `--ink-3`, links Abstand `--size-xxl`. Rechts Minimieren und
  Schließen, je 46 × 32, Segoe Fluent Icons 10 px (``, ``) in `--ink`. **Kein
  Maximieren-Button.** Auf macOS bleiben die Ampel-Buttons.
- **`backgroundColor`** des Fensters = `Surface 2` des aktiven Themes; wird bei `nativeTheme`-Updates
  angepasst.

### 7.2 Toolbar (`2005:832`)

- Höhe 60 px, Padding `--size-m` oben/unten/links und `--size-xxl` rechts.
- **Links:** ← und → (Buttons 36 × 36, Icon 20, Padding `--size-s`, Radius 100px), danach mit Abstand
  `--size-s` der Text „Today“ bzw. das Datum (`.text-m-primary`, `--ink`). → ist am heutigen Tag
  *Disabled*.
- **Rechts**, Abstand `--size-s`:
  - **Intervall-Button** mit Text „10m“ usw. Das aufgeklappte Menü ist in Figma **noch offen
    (TODO)**; vorerst bleibt die bestehende Slider-Auswahl in Funktion und Aufbau.
  - **TrackingButton** (`84678:1437`), 110 px breit:
    - *Tracking*: Hintergrund `--ink`, Text `--surface`, pulsierender Punkt in `--tracking`
    - *Paused*: transparent, Icon `pause_circle`, Text `--ink`, Hover-Layer
  - Ein Klick schaltet um, wie heute.

### 7.3 Tracking-Titel: Datenfluss (neu, nur lesend)

- **Main-Prozess:** `ActivityStore.getLatestAppWindow()` liefert App-Name und Fenstertitel des
  **letzten heutigen Heartbeats mit `appWindow`**, sonst `null`. Es wird **nichts** geschrieben,
  aggregiert oder geändert. Der IPC-Handler `get-current-activity` gibt diesen Wert zurück.
  `addHeartbeat` sendet danach das Ereignis `heartbeat-added` ohne Daten. Nötig ist das, weil
  `activity-data-updated` nur am Intervallende kommt.
- **Renderer:** holt den Wert beim Öffnen und bei jedem `heartbeat-added` und formatiert ihn als
  „App · Titel“ (bei leerem Titel nur „App“). Bei `null` erscheint der Standardtext.

### 7.4 Footer (`2005:845`)

- Padding `--size-l` oben/unten und `--size-xxl` seitlich.
- **Links:** Button „…“ (`more_horiz_20`), 28 × 28, Padding `--size-xs`, Position 20 px / 7 px.
  Öffnet die Settings-Ansicht.
- **Rechts:** Zusammenfassung **Active · Inactive · Tracked**, je Wert (`.text-m-primary`, `--ink`)
  plus Bezeichnung (`.text-m-default`, `--ink-3`), Abstand 4 px innerhalb und 16 px zwischen den
  Einträgen. Die Werte werden berechnet wie heute.
- Der Mock-Daten-Hinweis bleibt, dezent gestaltet.

### 7.5 Settings-Ansicht (`84705:4120` / `84705:4351`)

- **Ersetzt `SettingsModal`.** Die Ansicht liegt im selben Fenster; ← führt zurück zur Day View.
- **Toolbar:** ← und „Settings“.
- **Inhalt:** Padding `--size-m`, die Einträge mit Padding `--size-l` und Abstand `--size-l`.
  - Autostart: Toggle, Titel und Beschreibung (`--ink` / `--ink-2`)
  - Beta-Releases: Toggle, Titel und Beschreibung
  - **Auto-Delete: entfällt in diesem Redesign** (eigenes Feature, siehe §10)
  - **Speicherort der Aktivitätsdatei** (ändern, zurücksetzen, vorhandene Datei übernehmen) bleibt
    erhalten, im Zeilenmuster der Figma-Settings; die Bestätigung erscheint inline statt als zweites
    Modal. Figma wird später nachgezogen.
  - Unten der Link „www.appname.io“ als Platzhalter (`--ink-2`), damit er nicht vergessen wird, plus
    die App-Version
- **Toggle** (`84699:3534`): 35 × 20, Radius `--size-xxl`, Padding 3 px, Knopf 14 px in `--surface`.
  An: Hintergrund `--ink`, Knopf rechts. Aus: Hintergrund `--ink-4`, Knopf links.
- Die bestehenden IPC-Aufrufe (`get-auto-launch-settings`, `update-beta-release-setting` usw.) und
  ihre Fehlermeldungen bleiben erhalten.

### 7.6 Button (`84658:1622`)

Vier Zustände: Default, Hover, Pressed, Disabled. Die genauen Werte werden beim Umsetzen aus Figma
gelesen; bekannt ist bisher der Hover-Layer `--ink-4` mit 15 % (aus TrackingButton/Paused).

## 8. Theme

- Das CSS folgt `prefers-color-scheme`; Electron nutzt `nativeTheme.themeSource = 'system'`.
- **Kein manueller Schalter** (im Design nicht vorgesehen).
- Die Icon-Farbextraktion bleibt unverändert.

## 9. Was entfernt bzw. ersetzt wird

| Alt | Ersetzt durch |
|---|---|
| `src/styles/colors_and_type.css` | `tokens.css`, `typography.css` |
| `src/styles/workmory.css` | Komponenten-CSS |
| `src/components/DayOverview.js/.css` | `timeline/*` |
| `src/components/Header.js/.css` | `toolbar/*` |
| `src/components/SettingsModal.js/.css` | `settings/*` |
| `src/components/WindowChrome.js` | `window/WindowTitleBar.js` |
| `src/components/Icons.js` | `ui/Icon` + `assets/icons` |
| Footer, App.css | angepasst bzw. auf Shell-Glue reduziert |

## 10. Nicht im Umfang

- **Auto-Delete-Einstellung** (Schalter und einstellbare Tage). Der Store löscht weiter fest nach
  30 Tagen. Wird ein eigenes Feature mit eigener Spec und Tests, weil echte Daten gelöscht werden.
- **Neues Intervall-Menü** (Design in Figma noch offen).
- **Feinabstimmung der Event-Farben** bei extremen Markenfarben.
- Manueller Theme-Schalter, Code Connect, automatischer Token-Export.

## 11. Tests

1. **Charakterisierung zuerst:** `timelineGeometry.test.js` hält das *heutige* Verhalten aus
   `DayOverview.js` fest: Stundenhöhen für 5/10/15m, Stundenbereich (Puffer, lange Events,
   Mindestspanne, Grenzen, laufender Block) und die Geometrie alt. Die Logik wird erst danach
   unverändert verschoben; die Tests bleiben grün.
2. **Neue Regeln, jeweils als roter Test zuerst:** Höhe ohne −2 px; top +1 px; Halbstunden-Offset
   `round(h / 2)`; Scroll-Ziel für den laufenden Block.
3. **Tracking-Titel:** Test, dass der Lesezugriff den letzten Heartbeat liefert und keinen Zustand
   ändert.
4. Die bestehenden Tests `ActivityStore.test.ts` und `TimelineGenerator.test.ts` bleiben grün;
   `npm test` muss vollständig grün sein.
5. **Jest-Konfiguration:** Für JS-Tests unter `src/components` wird `babel-jest` mit
   `@babel/preset-env` und `@babel/preset-react` ergänzt. Die bestehende relative `testMatch`-Regel
   für Worktrees bleibt erhalten.

## 12. Verifikation

- Die App läuft mit `npm run dev:mock`, einmal im Light-, einmal im Dark-Theme des OS. Die
  Screenshots werden mit `84653:1076` und `84653:1077` verglichen.
- **Mit den DevTools nachmessen:**
  - Event-Spalte 76/24 px, Versatz 1 px
  - Label 23/6/12 px, Halbstunden-Marker 49/11 px
  - Scrollbar 14/5/4 px
  - Toolbar 60 px, Titelleiste 32 px, Footer 41 px
- **Event-Farben** gegen die Prüfwerte aus §6.3.
- **Intervalle** 5/10/15m durchschalten: Die Stundenhöhen bleiben 288/144/96 px, Events und Marker
  stehen an der richtigen Stelle.
- **Auto-Scroll** bei „Heute“ und **Tracking-Titel**-Update im echten Tracking (`npm run dev`)
  prüfen.

## 13. Dokumentation

- **Neu:** `docs/design/figma-map.md` mit
  - Tabelle Figma-Node/Variable → Datei/Klasse/Token
  - **Update-Checkliste:** (1) Variable geändert → Zeile in `tokens.css`; (2) Abstand/Maß geändert
    → Konstante in Komponenten-CSS mit Node-ID; (3) neue Variante oder Komponente → neue Datei plus
    Eintrag in der Map; (4) Verifikation nach §12
- **`CLAUDE.md`:** Abschnitte zu Styles und Layout aktualisieren (`tokens.css` statt
  `colors_and_type.css`/`workmory.css`, Verweis auf `figma-map.md`).
- **`docs/Engineering Design Dokument.md`:** Abschnitt zum Renderer aktualisieren (neue
  Komponentenstruktur, lesender IPC für den letzten Heartbeat).
