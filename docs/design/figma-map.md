# Figma-Map: Figma → Code

Diese Datei ordnet jedes Element der Figma-Datei der Datei, Klasse oder dem Token im Code zu und
enthält die Checkliste für spätere Figma-Änderungen. Hintergrund und Entscheidungen:
`docs/superpowers/specs/2026-11-01-figma-redesign-design.md`.

## 1. Quelle und Zugang

- **Figma-Datei:** „Workmory“, Datei-Key `BYAYmyZwAVg1mkrBqS2esP`

| Frame | Node-ID |
|---|---|
| Day View, Light | `84653:1076` |
| Day View, Dark | `84653:1077` |
| Settings, Light | `84705:4120` |
| Settings, Dark | `84705:4351` |
| Components | `84705:4012` |

- **Zugang:** Die Datei wird über den **claude.ai-Figma-Connector** mit dem **Wilddesign-Account**
  gelesen. Der Login des Figma-Plugins (gmail) hat keinen Zugriff auf die Datei, und der
  Figma-MCP-Server liest nur mit Edit-Rechten.
- **Grundsatz:** Figma ist die Quelle für das Aussehen (Farben, Größen, Typografie, Abstände), der
  Code für das Verhalten. Zoomstufe, Auflösung und Beispieldaten der Timeline in Figma sind nur
  Illustration (Stundenhöhe 288/144/96 px kommt aus `timelineGeometry.js`).

## 2. Konventionen

- **Tokens nur in `src/styles/tokens.css`.** Komponenten-CSS nutzt ausschließlich `var(--…)`. Figma-Maße,
  die keine Variablen sind, stehen als benannte Custom Properties oben in der Komponenten-CSS, mit
  Figma-Node-ID im Kommentar (Abschnitt 5).
- **Benennung:** Figma-Name in kebab-case (`Ink 3` → `--ink-3`, `size/M` → `--size-m`,
  `EventInkMix` → `--event-ink-mix`, `Line Tracking` → `--line-tracking`).
- **Farbwerte immer als Hex** (`#rrggbb` oder `#rrggbbaa`), weil `timeline/eventColors.js` sie per
  `getComputedStyle` liest und parst.
- **Dateikopf:** Jede Komponentendatei beginnt mit `// Figma: <Node-Name> <Node-ID>` (CSS: `/* Figma: … */`).
- **Klassen:** Präfix `wm-<komponente>` (z. B. `wm-timeline`, `wm-footer`, `wm-button`). Timeline-interne
  Konstanten tragen das Präfix `--tl-`.
- **Theme:** Light in `:root`, Dark per `@media (prefers-color-scheme: dark)`. Die Einstellung Darstellung (Auto / Hell / Dunkel) setzt im Main-Prozess `nativeTheme.themeSource`; das CSS kennt keinen eigenen Schalter.
- **Schrift:** Inter 500/600 lokal über `@fontsource/inter` (`base.css`), kein CDN. Alle Textklassen nutzen
  `text-box: trim-both cap alphabetic`.

## 3. Variablen → Tokens (`src/styles/tokens.css`)

| Figma-Variable | CSS-Token | Light | Dark |
|---|---|---|---|
| Ink | `--ink` | #0a0a0a | #f5f5f5 |
| Ink 2 | `--ink-2` | #404040 | #b4b4b4 |
| Ink 3 | `--ink-3` | #737373 | #8a8a8a |
| Ink 4 | `--ink-4` | #a3a3a3 | #5c5c5c |
| Line | `--line` | #a3a3a3 | #262626 |
| Line 3 | `--line-3` | #0000001a | #ffffff1a |
| Line Tracking | `--line-tracking` | #ff57571a | #ff575733 |
| Tracking | `--tracking` | #ff5757 | #ff5757 |
| Surface | `--surface` | #f8f7f6 | #141414 |
| Surface 2 | `--surface-2` | #ffffff | #0a0a0a |
| EventBackground | `--event-background` | #e8e8e8 | #1c1c1c |
| EventInkMix | `--event-ink-mix` | #00000066 | #ffffff66 |
| size/XS · S · M · L · XL · XXL | `--size-xs` … `--size-xxl` | 4 · 8 · 12 · 16 · 20 · 24 px | gleich |
| AppIconSize | `--app-icon-size` | 16 px | gleich |

- Die Figma-Variablen `Teams`, `Chrome`, `Claude` und `Excel` sind Beispieldaten und stehen **nicht** in
  `tokens.css`. Die App-Farbe eines Events ist zur Laufzeit die aus dem App-Icon extrahierte Farbe
  (`get-app-icon` → `color`); ohne Icon `--ink-3`.
- **Inactive-Text** (in Figma noch als Hex #454545 / #b9b9b9): Entscheidung: in Figma an `Ink 2` binden; der
  Code nutzt `--ink-2`.

### Main-Prozess-Konstante `SURFACE_2`

`src/main/main.ts` enthält `SURFACE_2 = { light: '#ffffff', dark: '#0a0a0a' }` als Hintergrundfarbe des
nativen Fensters (verhindert weißes Aufblitzen beim Resize; wird bei `nativeTheme`-Updates angepasst). Sie
**spiegelt `--surface-2`**. Ändert sich die Variable `Surface 2` in Figma, müssen `tokens.css` **und**
`SURFACE_2` in `main.ts` gemeinsam angepasst werden.

### Timeline-Konstante `TL_PAD_Y`

`src/components/timeline/Timeline.js` enthält `TL_PAD_Y = 30` (Scroll-Ziel für den laufenden Block). Sie
**spiegelt `--tl-pad-y`** in `Timeline.css` (Figma `2066:772`, Container-Padding oben/unten). Beide Werte
müssen gemeinsam geändert werden.

### Fenstergröße (`src/main/main.ts`)

| Konstante | Wert | Bedeutung |
|---|---|---|
| `WINDOW_WIDTH` | 387 | Breite der **Content-Fläche** (`useContentSize`), zugleich Mindestbreite |
| `WINDOW_HEIGHT` | 499 | Starthöhe der Content-Fläche |
| `WINDOW_MIN_HEIGHT` | 360 | Mindesthöhe der Content-Fläche |

Fenster rahmenlos; Ecken und Schatten kommen vom System (Windows 11 rundet mit 8 px). Radius 16 und
Schatten im Figma-Frame stellen das OS-Fenster dar.

## 4. Textstile → Klassen (`src/styles/typography.css`)

| Figma-Stil | Klasse | Definition |
|---|---|---|
| M/Primary | `.text-m-primary` | Inter 500, `--size-m`, line-height 18px, letter-spacing 0 |
| M/Default | `.text-m-default` | Inter 500, `--size-m`, line-height 1.4, letter-spacing 0 |
| XL/Default | `.text-xl-default` | Inter 600, `--size-xl`, line-height 1.4, letter-spacing −0.08px |

`.tnum` zusätzlich für tabellarische Ziffern (Dauer, Uhrzeiten).

## 5. Komponenten → Dateien

Pfade relativ zu `src/components/`. Jede Komponente hat `.js` und (falls vorhanden) `.css` gleichen Namens.

| Figma-Komponente | Node-ID | Code | Klasse(n) |
|---|---|---|---|
| Title bar | `2061:4850` | `window/WindowTitleBar` | `wm-titlebar*` |
| Settings-Button in der Titelleiste (more_horiz_20, öffnet/schließt die Einstellungen) | `84822:1653` | `window/WindowTitleBar` | `wm-titlebar-button-settings` |
| Toolbar | `2005:832` | `toolbar/Toolbar` | `wm-toolbar` |
| Pfeile ←/→ (arrow_back / arrow_forward) | `84658:1621` / `84664:1382` | `toolbar/DateNav`, `ui/Icon` | `wm-date-nav*` |
| Button (Intervall-Trigger) | `84671:1463` | `toolbar/IntervalPicker` | `wm-interval*` |
| SliderDropDownText (Marken) | `84672:1736` | `toolbar/IntervalPicker` | |
| ButtonTracking (Tracking, Paused) | `84678:1437` | `toolbar/TrackingButton` | `wm-tracking-button` |
| Tracking dot | `84678:838` | `ui/TrackingDot` | `wm-tracking-dot*` |
| Button (Default, Hover, Pressed, Disabled) | `84658:1616` (`84658:1623`, `84734:3006`, `84734:2997`) | `ui/Button` | `wm-button` |
| Toggle | `84699:3534` | `ui/Toggle` | `wm-toggle` |
| SegmentedControl (Darstellung Auto/Hell/Dunkel) | *noch kein Figma-Node* | `ui/SegmentedControl` | `wm-segmented*` |
| Icons (arrow_back, arrow_forward, more_horiz_20, pause_circle) | `84658:1621`, `84664:1382`, `84686:535`, `84678:1461` | `ui/Icon`, `src/assets/icons/*.svg` | `wm-icon` |
| Container (Scroll-Container) / Content (Event-Spalte) | `2066:772` / `2067:795` | `timeline/Timeline` | `wm-timeline*` |
| Entry (Stundenzeile, Label, Halbstunden-Marker) | `2005:793` (`84783:3209`, `84783:3210`, `84783:3213`) | `timeline/TimelineHourGrid` | `wm-timeline-hour*`, `wm-timeline-half-marker` |
| .Event-Master (Varianten Inactive, Tracking) | `2007:199` (`84653:1247`, `84722:2213`) | `timeline/TimelineEvent` | `wm-timeline-event*` |
| Footer | `2005:845` | `footer/Footer` | `wm-footer*` |
| Status Bar (Active · Inactive · Tracked) | `2052:157` | `footer/DaySummary` | |
| Settings (Toolbar `84699:2887`) | `84705:4120` / `84705:4351` | `settings/SettingsView` | `wm-settings*` |
| SettingRow | `84699:2276` | `settings/SettingRow`, `settings/StoreLocationSetting` | `wm-setting-row*` |

Ohne Figma-Vorlage: **Speicherort der Aktivitätsdatei** (`settings/StoreLocationSetting`, aus dem
Zeilenmuster abgeleitet, Figma wird später nachgezogen) und das **Intervall-Flyout** mit Slider (in Figma noch
offen, TODO).

### Figma-only-Konstanten (benannte Custom Properties, Kopf der Komponenten-CSS)

| Datei | Konstante | Wert | Figma-Node |
|---|---|---|---|
| `timeline/Timeline.css` | `--tl-pad-y` | 30 px | `2066:772` (Padding oben/unten) |
| | `--tl-lane-left` | 76 px | `2067:795` (Event-Spalte links) |
| | `--tl-lane-right` | 24 px | `2067:795` (rechts, ab Fensterrand; die Scrollbar-Breite wird im CSS abgezogen, wegen `scrollbar-gutter: stable`) |
| | `--tl-label-inset` | 23 px | `84783:3210` (Padding links) |
| | `--tl-label-gap` | 6 px | `84783:3210` (Padding oben, Linie → Text) |
| | `--tl-label-pad-right` | 12 px | `84783:3209` (Padding rechts) |
| | `--tl-half-marker-left` | 49 px | `84783:3212` (Padding links) |
| | `--tl-half-marker-width` | 11 px | `84783:3213` |
| | `--tl-scrollbar-width` | 14 px | `84766:1347` |
| | `--tl-scrollbar-inset` | 5 px | `84766:1347` (Padding) |
| | `--tl-scrollbar-thumb` | 4 px | `84769:1359` (= Breite − 2 × Inset) |
| | `--tl-scrollbar-opacity` | 0.36 | `84769:1359` |
| `timeline/timelineGeometry.js` (JS) | `EVENT_OFFSET_Y` | 1 px | `2067:795` (top der Event-Spalte) |
| | `MIN_EVENT_HEIGHT` | 14 px | Mindesthöhe eines Events (Verhalten, nicht Figma) |
| | `MIN_BLOCK_HEIGHT` | 24 px | Verhalten: Stundenhöhe = 24 × 60 / Intervall |
| `timeline/TimelineEvent.css` | `--tl-event-outer-stroke` | 1 px | `2007:199` (Rand in `--surface`, ohne Layout-Platz, über dem Inhalt: `::after`) |
| | `--tl-event-inner-stroke` | 1 px | `2067:853` (Rand in `--event-background`, äußerstes Pixel vom äußeren Rand verdeckt) |
| | `--tl-event-header-max-height` | 32 px | `2007:151` |
| | `--tl-event-title-gap` | 6 px | `2007:152` |
| | `--tl-event-tracking-border` | 2 px | `84722:2213` (innerer Rand; sichtbar 1 px, das äußere Pixel liegt unter dem `--surface`-Rand) |
| | `--tl-hatch-angle` / `-stripe` / `-period` / `-opacity` | 135deg / 1px / 3px / 9% | `84653:1248` (am Bild `442f5.png` abgemessen; Streifen in `--ink`) |
| `ui/Button.css` | `--wm-button-hover-opacity` | 0.15 | `84734:3056` |
| | `--wm-button-pressed-opacity` | 0.3 | `84734:3051` |
| | `--wm-button-radius` | 100 px | `84658:1616` |
| | `--wm-button-label-min-height` | 20 px | `84664:1561` |
| `ui/Toggle.css` | `--wm-toggle-width` / `-height` / `-padding` / `-knob-size` / `-offset` | 35 / 20 / 3 / 14 / 18 px | `84699:3534` |
| `ui/SegmentedControl.css` | `--wm-segmented-padding` / `--wm-segmented-track-opacity` | 3 px / 0.15 | kein eigener Node (übernommen von `84699:3534` / `84734:3056`) |
| `ui/TrackingDot.css` | `--wm-dot-box-width` / `-box-height` | 16 / 20 px | `84678:838` |
| | `--wm-dot-size` / `-pulse-size` | 5 / 16 px | `84678:838` |
| | `--wm-dot-pulse-start-opacity` / `-pulse-duration` | 0.5 / 2s | `84678:838` |
| `toolbar/Toolbar.css` | `--wm-toolbar-height` | 60 px | `2005:832` |
| `toolbar/TrackingButton.css` | `--wm-tracking-button-width` | 110 px | `84678:1437` |
| `toolbar/IntervalPicker.css` | `--wm-interval-track-height` / `-thumb-size` / `-thumb-border` / `-flyout-width` | 4 / 18 / 2 / 216 px | kein Figma-Design (vom alten Header übernommen) |
| `footer/Footer.css` | `--wm-footer-height` | 41 px | `2005:845` (Status Bar zentriert) |
| `settings/SettingsView.css` | `--wm-settings-toolbar-height` | 60 px | `84699:2887` |
| `window/WindowTitleBar.css` | `--wm-titlebar-height` | 32 px | `2061:4850` |
| | `--wm-titlebar-button-width` | 46 px | `2061:4850` |
| | `--wm-titlebar-glyph-size` | 10 px | `2061:4850` (Segoe Fluent Icons) |
| | `--wm-titlebar-close-hover(-ink)`, `--wm-titlebar-light-*`, `--wm-titlebar-transition` | | OS-Konvention (Windows-Close-Rot, macOS-Ampel), nicht in Figma |

Titelleiste: Hintergrund `--surface-2`, Titel „Workmory“ in `.text-m-primary` / `--ink-3`, Settings (`…`, Icon 20 px),
Minimieren und Schließen je 46 × 32, **kein** Maximieren-Button (macOS: Ampel-Buttons links, Settings rechts).
Der leere 28-px-Platzhalter `84822:1564` links davon ist unsichtbar und wird nicht umgesetzt.

### Event-Farben (`timeline/eventColors.js`)

Textfarbe eines App-Events = App-Farbe, darüber `--event-ink-mix` normal überblendet (`blendOver`). Der
Token-Wert wird zur Laufzeit per `getComputedStyle` gelesen und bei Theme-Wechsel neu berechnet. Prüfwerte:

| App-Farbe | Light | Dark |
|---|---|---|
| Teams #4750cb | #2b307a | #9196e0 |
| Chrome #1a73e8 | #10458b | #76abf1 |

## 6. Update-Checkliste (Figma hat sich geändert)

1. **Variable geändert** → Zeile in `src/styles/tokens.css` anpassen (beide Modi). Bei `Surface 2` zusätzlich
   `SURFACE_2` in `src/main/main.ts`.
2. **Abstand oder Maß geändert** → Konstante in der Komponenten-CSS (Tabelle in Abschnitt 5), Figma-Node-ID im
   Kommentar prüfen. Bei der Timeline-Geometrie auch `timelineGeometry.js` / `timelineGeometry.test.js`.
3. **Neue Variante oder Komponente** → neue Datei im passenden Ordner unter `src/components/` mit
   `// Figma: <Name> <Node-ID>` im Kopf, plus Eintrag in dieser Map.
4. **Verifikation** (Spec §12): App mit `npm run dev:mock` in Light und Dark starten und gegen die
   Figma-Frames `84653:1076` / `84653:1077` (Day View) bzw. `84705:4120` / `84705:4351` (Settings) vergleichen.
   Mit den DevTools nachmessen: Event-Spalte 76/24 px und Versatz 1 px, Label 23/6/12 px,
   Halbstunden-Marker 49/11 px, Scrollbar 14/5/4 px, Toolbar 60 px, Titelleiste 32 px, Footer 41 px. Event-Farben
   gegen die Prüfwerte (Abschnitt 5) und die Intervalle 5/10/15m (Stundenhöhen 288/144/96 px) prüfen. Auto-Scroll und
   Tracking-Titel zusätzlich im echten Tracking (`npm run dev`) testen. Danach `npm test`.
