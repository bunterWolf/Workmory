# Engineering Design Document: Workmory - Automatic time tracking made easy and free

## Glossar

- **Heartbeat**: Ein zeitbasierter Datenpunkt, der alle 30 Sekunden erfasst wird und den aktuellen Systemzustand dokumentiert.
- **Watcher**: Modulare Komponenten, die spezifische Systemzustände überwachen (z.B. aktives Fenster, Benutzeraktivität).
- **Aggregation**: Prozess der Zusammenfassung von Heartbeat-Daten in 15-Minuten-Intervalle für die Timeline-Darstellung.

## 1. Introduction

Workmory is an Electron-based desktop application designed to track and analyze user activity on a computer. The application follows a main process/renderer process architecture connected through IPC communication.

## 1. System Architecture

### 1.1 Overview

Workmory is an Electron-based desktop application designed to track and analyze user activity on a computer. The application follows a main process/renderer process architecture connected through IPC communication.

### 1.2 Architectural Components

```
┌─────────────────────────────────────────────────────────┐
│                    Electron Application                 │
├─────────────────┬─────────────────────┬─────────────────┤
│                 │                     │                 │
│  Main Process   │  IPC Communication  │ Renderer Process│
│   (main.js)     │                     │   (index.html)  │
│                 │                     │                 │
├─────────────────┴─────────────────────┴─────────────────┤
│                                                         │
│                  Data Management                        │
├─────────┬───────────────────┬────────────┬─────────────┤
│         │                   │            │             │
│Activity │ Heartbeat-Manager │  Watchers  │ Persistence │
│ Store   │                   │ (Modules)  │             │
│         │                   │            │             │
└─────────┴───────────────────┴────────────┴─────────────┘
```

### 1.3 Key Components

1. **Electron Framework**: Provides cross-platform support.
2. **Main Process**: Central coordination hub and backend.
3. **Renderer Process**: User interface and visualization.
4. **Activity Store**: Core for storing, processing, and aggregating activity data.
5. **Heartbeat-Manager**: Manages heartbeats and request information from watcher.
6. **Watcher Modules**: Provide Information about user actions (active window, inactivity, meetings).

## 2. Component Design

### 2.1 Main Process (main.js)

#### 2.1.1 Responsibilities

- Initializes the application
- Manages windows
- Registers IPC handlers
- Coordinates ActivityStore and WatcherManager instances
- Handles graceful shutdown and cleanup

### 2.2 ActivityStore

#### 2.2.1 Responsibilities

- Manages and persists activity data/heartbeats
- Cleans up outdated records
- Supports customizable data storage location for synchronization across devices
- Creates and updates the Day Summary
- Aggregates heartbeat data into aggregated timeline events based on user-selected interval (5, 10, or 15 minutes)
- Ensures proper event ordering and overlap handling based on priority

#### 2.2.2 Data Model

```
{
  version: 1,
  startTime: timestamp,
  lastCleanup: timestamp,
  aggregationInterval: 15, // can be 5, 10, or 15 (minutes)
  days: {
    ["YYYY-MM-DD"]: {
      heartbeats: [
        {
          timestamp: number,
          data: {
            teamsMeeting: false | {
              title: string,
              status: string
            },
            userActivity: "active" | "may_be_inactive" | "inactive",
            appWindow: {
              app: string,
              title: string
            }
          }
        }
      ],
      aggregated: {
        summary: {
          activeTrackingDuration: number,
          totalActiveDuration: number,
          totalInactiveDuration: number,
          totalMeetingDuration: number,
          appUsage: { [appName: string]: number } // active duration per app, in ms
        },
        timelineOverview: [
          {
            timestamp: number,
            duration: number,
            type: "appWindow" | "teamsMeeting" | "inactive",
            data: {
              ...
            }
          }
        ]
      }
    }
  }
}
```


#### 2.2.3 Aggregation for Timeline Overview

The Aggregation is critical and can easily create unwanted outcomes. This section of the App needs detailed documentation and should be test-driven programmed.

Activities
- Heartbeats are aggregated into activities in configurable time intervals (5, 10, or 15 minutes)
- The default interval is 15 minutes
- An activity always starts or ends at fixed times based on the chosen interval:
  - 15-minute intervals: XX:00 - XX:15 - XX:30 - XX:45
  - 10-minute intervals: XX:00 - XX:10 - XX:20 - XX:30 - XX:40 - XX:50
  - 5-minute intervals: XX:00 - XX:05 - XX:10 - XX:15 - ... - XX:55
- An activity is calculated when its end time is reached. Aggregation can also run mid-interval (app start with autosaved heartbeats, resuming tracking, changing the interval); the still-running interval is then skipped (`TimelineGenerator.generateActivities` compares the interval end with the current time) and is only shown as the renderer's running block.

Activity Aggregation
- Contains all heartbeats within the activity's time window
- Heartbeats must exist for at least half of the activity duration for an activity to be created. If not - there is not activity for this timeframe.
- Reduces each heartbeat to a data type:
  - Meeting: If there is an active TeamsMeeting
  - Inactive: If userActivity is inactive and there is no active TeamsMeeting
  - appWindow: If the user is not inactive and there is no active meeting
- Sets the activity type to the type that occurs most frequently in the heartbeats: "appWindow" | "teamsMeeting" | "inactive"

Merging Activities
After an activity is updated or created in the timeline data, it's checked whether consecutive activities with the same content can be merged.
- If activities are identical in type and data and follow each other chronologically, they are combined into a single activity
- This applies to all consecutive activities - not just 2.

Summary calculation
After an activity change, the summary times are updated. These are not based on the heartbeats, but are determined from the activities, their types, and the corresponding duration.

### 2.3 Heartbeat-Manager

#### 2.3.1 Responsibilities

- Creates heartbeats in a fixed interval at :15 and :45 seconds of every minute (therefore every 30 seconds)
- Collects heartbeat data from watcher modules - See ActivityStore Data Structure
- Forwards heartbeats to the ActivityStore
- Supports pause/resume operations

### 2.4 Watcher Modules

#### 2.4.1 Active-Window-Watcher
- Returns the currently active window
- Uses `active-win` for cross-platform support

#### 2.4.2 Inactivity-Watcher
- Detects if user is performan an mouse or keyboard action between requested heartbeats
- Return "may-be-inactive" if the user has not performand an command since the last heartbeat request
- Return "inactive" if the user has not performand an command since the last FIVE heartbeat request


#### 2.4.3 Teams-Meetings-Watcher
- Return if the user is currently in a Teams meeting or call
- Returns meeting metadata

### 2.5 Renderer Process (React)

#### 2.5.1 Responsibilities
- Displays aggregatedActivity data
- Allows user interaction (pause/resume, date selection)
- Is very minimal    

#### 2.5.2 UI Structure
- Uses minimal **React**, written as plain JavaScript (`src/components/**/*.js`)
- No third-party UI libraries or routing (no React Router)
- Styling is done using **plain CSS files**, editable directly by designers. Design tokens (colors, sizes) live only in `src/styles/tokens.css` and mirror the Figma variables 1:1; text styles are in `typography.css`, reset and bundled Inter font in `base.css`. Component CSS uses only `var(--…)` tokens plus named constants (with Figma node id) at the top of the file. See `docs/design/figma-map.md` for the mapping Figma -> code and the update checklist.
- Theme: the CSS follows `prefers-color-scheme`; the main process sets `nativeTheme.themeSource` from the appearance setting (Auto / Light / Dark, see 2.5.2.3), so there is no theme logic in the CSS
- One component in code corresponds to one Figma component (same name, Figma node id in the file header)
- The window is frameless with a custom title bar and starts at 387 x 499 (content size), minimum 387 x 360. The title bar holds the settings button (`…`, left of minimize; on macOS at the right end) besides the window controls

```
src/components/
  App.js             Shell: loads data, switches between Day View and Settings view
  window/            WindowTitleBar
  toolbar/           Toolbar, DateNav, IntervalPicker, TrackingButton
  timeline/          Timeline, TimelineHourGrid, TimelineEvent, timelineGeometry.js (pure functions),
                     eventColors.js, useAppIcon, useCurrentActivity, useColorScheme
  footer/            Footer, DaySummary
  settings/          SettingsView, SettingRow, StoreLocationSetting
  ui/                Button, Toggle, Icon, TrackingDot
```

##### 2.5.2.1 Toolbar
- **Date navigation** with friendly labels ("Today", "Yesterday"): arrow buttons (previous/next day) and the date text; "next" is disabled on the current day
- **Interval selector**: a trigger button showing the current interval (5m, 10m, 15m). A click opens it in place into a pill *Zoom 15m · 10m · 5m* (no popup; the label *Zoom* names what the choice changes) that grows to the left over the date, which fades out over 48 px; the toolbar does not shift. A choice applies and closes the pill at once; an outside click or Esc closes without change, arrow keys move the selection. There is no Figma design for the pill yet.
- **Tracking button** to pause or start tracking (states *Tracking* with a pulsing dot, and *Paused*)

#### 2.5.2.2 Content: Timeline

##### A. Grundlegende Anforderungen
1. **Zeitliche Darstellung**
   - Vertikale Timeline mit Stundenlinien, Stunden-Labels und Halbstunden-Markern
   - Stundenhöhe = 24 px × 60 / Intervall, also 288 px (5m), 144 px (10m), 96 px (15m)
   - Angezeigt wird nur der Bereich mit Aktivität (`getTimeRange`): vom Start des ersten bis zum Ende des letzten Blocks, laufender Block einbezogen; Grenzen 0–24 Uhr. Den optischen Abstand oben und unten liefert allein der 30-px-Innenabstand des Scroll-Containers (Figma), es gibt keinen zusätzlichen Zeitpuffer. Ist der Inhalt kürzer als das Fenster, wächst der Bereich in ganzen 24-px-Blockschritten (nach unten, ab Mitternacht nach oben), bis er das Fenster füllt, aber nie darüber hinaus, sodass kein leeres Scrollen entsteht. Weil Blöcke auf Intervallgrenzen beginnen und px/min = 24 / Intervall ist, liegen alle Events und Rasterlinien auf ganzen Pixeln. Die Berechnung steckt in den reinen Funktionen von `timelineGeometry.js` (getestet in `timelineGeometry.test.js`).
   - Raster (`getGridMarks`): Stundenlinie mit Label zu jeder vollen Stunde, Halbstunden-Marker zu jeder :30, innerhalb des Bereichs.
   - Event-Position: `top = (Startminute − Bereichsanfang in Minuten) × px/min + 1 px`, `height = max(14, Dauer × px/min)`. Die Lücke zwischen benachbarten Events entsteht durch den 1-px-Rand in `--surface` an jedem Event. Wie in Figma nimmt dieser Rand keinen Platz ein und liegt über dem Inhalt (verdeckt das äußerste Pixel des inneren Rands und des App-Farb-Overlays).

##### B. Event-Darstellung

1. **Event-Block Informationen**
   - App-Fenster: App-Icon, Anwendungsname und Fenstertitel, Dauer. Hintergrund `--event-background` mit einer Ebene in der aus dem App-Icon extrahierten Farbe (`mix-blend-mode: overlay`); die Textfarbe wird in `eventColors.js` (`blendOver`) aus App-Farbe und `--event-ink-mix` berechnet und bei Theme-Wechsel neu bestimmt.
   - Inaktive Zeiten: Standardisierte Beschreibung auf `--surface` mit CSS-Schraffur
   - Laufender Block (nur „Heute“, nur bei aktivem Tracking): Intervall-Block ab der aktuellen Intervallgrenze, pulsierender Punkt, Titel „App · Fenstertitel“ des letzten Heartbeats (siehe §3.3), wird jede Minute neu berechnet
   - Einheitliche Blockbreite unabhängig vom Inhalt, Dauer in benutzerfreundlichem Format
   - Teams-Meeting-Events werden nicht mehr verfolgt (Abschnitt 2.4.3 beschreibt noch das alte Konzept)

##### C. Interaktives Verhalten

1. **Echtzeit-Updates**
   - Nahtlose Integration neuer Events
   - Keine Neuladung bei Datenaktualisierung

2. **Scroll-Verhalten**
   - Der Timeline-Container scrollt nativ (eigene 14-px-Scrollbar)
   - Beim Öffnen und beim Wechsel auf „Heute“ scrollt die Timeline **einmal** zum laufenden Block, danach nur noch der Nutzer
   - Beibehaltung der Scroll-Position bei Updates

##### D. Responsive Design

1. **Bildschirmanpassung**
   - Flexible Höhenanpassung (Fenster frei skalierbar, Mindestgröße 387 x 360)
   - Beibehaltung der ausgewählten Aggregationsintervall-Proportionen (5, 10 oder 15 Minuten)

2. **Wiederherstellung**
   - Automatische Wiederherstellung nach Verbindungsabbrüchen
   - Erhaltung des Anzeigestatus bei Fehlern
   - Nahtlose Fortsetzung der Aktualisierungen

#### 2.5.2.3 Footer and Settings view
- **Footer**: the centered day summary *Active · Inactive · Tracked*, calculated from the aggregated summary data. The Settings view is opened (and closed again) with the `…` button in the title bar.
- **Settings view** (replaces the former settings modal, same window; the back arrow returns to the Day View): auto-launch toggle, beta-release toggle, appearance (one line: title plus Auto / Light / Dark on the right, aligned with the toggle rows; saved as `themeMode` in `settings.json`; the main process applies it to `nativeTheme.themeSource` before the window paints, so `prefers-color-scheme` and the window background follow; IPC `get-theme-mode` / `set-theme-mode`), activity-file location (change, reset, adopt an existing file; the confirmation appears inline), placeholder link and app version. The auto-delete setting is not part of the UI; the store deletes data after a fixed 30 days.

#### 2.5.4 Development & Debugging

- All components written as plain JavaScript React functional components (the backend is TypeScript)
- Use of `console.log` and browser dev tools for debugging
- IPC from the renderer uses `ipcRenderer` directly (`invoke` for queries, `on` for events) in `App.js` and small hooks
- Minimal Webpack/Build config to reduce overhead
- Directory structure is flat and easy to follow:
    
    ```
    src/
      ├── main/              # Electron main process
      ├── renderer/          # React entry (index.html / index.js)
      ├── components/        # React components by area (ui, window, toolbar, timeline, footer, settings)
      ├── styles/            # tokens.css, typography.css, base.css
      ├── assets/            # logos and SVG icons (assets/icons)
      ├── watchers/          # Watcher implementations
      ├── store/             # ActivityStore logic, ActivityIpc (IPC bridge)
    ```
    
## 3. Data Flow

### 3.1 Activity Collection

```
OS Events -> Watcher -> Heartbeat -> ActivityStore-heartbeats -> ActivityStore-aggregeted-timelineOverview
```

### 3.2 Persistence

```
┌──────────────┐    ┌───────────────┐    ┌──────────────┐
│ ActivityStore│───>│ JSON.stringify│───>│ Filesystem   │
└──────────────┘    └───────────────┘    └──────────────┘
```

### 3.3 UI Communication

```
┌──────────────┐    ┌───────────────┐    ┌────────────┐
│ ActivityStore│───>│   IPC Channel │───>│ Renderer   │
└──────────────┘    └───────────────┘    └────────────┘
```

**Read-only IPC for the running block title:** `activity-data-updated` is only sent at the end of an aggregation interval, so the running timeline block would show stale data. Two additions, which read but never write or aggregate:

- `get-current-activity` (`ipcMain.handle`): returns `ActivityStore.getLatestAppWindow()`, the app name and window title of the **latest heartbeat of today that has an `appWindow`**, or `null`. The store state is not changed.
- `heartbeat-added` (event, no payload): sent to the renderer by the `ActivityIpc` bridge after `ActivityStore.addHeartbeat` has stored a heartbeat.

The renderer (`useCurrentActivity`) fetches the value on startup and on every `heartbeat-added`, and shows it as "App · Window title" in the running block (default text when `null`).

## 4. Technical Details

### 4.1 Persistence

- Stored as a JSON file inside `app.getPath('userData')` (storage location is configurable)
- JSON with 2-space indentation
- Autosave every 5 minutes
- Cleanup after 30 days

## 5. Dependencies

- **Electron** for app shell
- **React** (no router)
- **active-win** for active window tracking
- **Node.js fs/path** for file operations

## 6. Performance
- Daily data: ~50-200KB
- Cleanup after 30 days
- CPU usage: <2%
- Batching and incremental saves

## 7. Security & Privacy

- Local-only storage
- No network transmission
- UI transparency (tracking indicator)

## 8. Extensibility
- Modular watcher system
- Configurable save path (e.g., Google Drive folder)

## 9. Limitations
- Accessibility permissions on macOS
- High-security apps may not be visible
- Inactivity detection may vary across devices

## 10. Testing
- Multi-OS verification
- Long-term testing
- Memory & performance profiling

## 11. Development Mode und Mock-Daten

### 11.1 Mock-Daten Integration

Zur Vereinfachung der Entwicklung und des Testens bietet die Anwendung einen speziellen Mock-Daten-Modus, der über eine Kommandozeilen-Flag aktiviert werden kann.

#### 11.1.1 Aktivierung

Der Mock-Daten-Modus kann über folgendes Kommando aktiviert werden:

```
npm start -- --mock-data
```

Für die Entwicklung mit automatischem Reload:

```
npm run dev:mock
```

#### 11.1.2 Verhalten im Mock-Daten-Modus

- Die Anwendung lädt einen vordefinierten Datensatz aus `public/mock-data.json` anstatt echte Aktivitäten zu verfolgen.
- Die Mock-Daten enthalten Beispieldaten für feste Testtage (z.B. `2024-01-01`, `2024-01-02`).
- Tracking-Kontrollen werden deaktiviert.
- Die UI zeigt durch visuelle Indikatoren an, dass Mock-Daten verwendet werden.
- Mock-Daten werden nicht auf der Festplatte gespeichert.
- Events werden nicht aufgezeichnet.

#### 11.1.3 Implementierung

Die Mock-Daten-Funktionalität ist folgendermaßen implementiert:

- `public/mock-data.json`: Enthält statische Beispieldaten im JSON-Format.
- Kommandozeilen-Flag wird im `main.ts` ausgewertet.
- Der `ActivityStore` erhält einen zusätzlichen Parameter `useMockData`.
- Bei aktiviertem Mock-Modus liest der `ActivityStore` die `public/mock-data.json` statt die `generateMockData` Funktion aufzurufen oder Daten aus dem persistenten Speicher zu laden.
- Sämtliche Tracking- und Speicheroperationen werden im Mock-Modus übersprungen.
- Die UI-Komponenten zeigen entsprechende Status-Hinweise an.

#### 11.1.4 Vorteile für die Entwicklung

- UI-Entwicklung ohne Warten auf echte Daten
- Konsistente Testumgebung mit vorhersehbaren Daten
- Demonstrationen und Präsentationen ohne echtes Tracking
- Keine Verfälschung der tatsächlichen Nutzungsdaten während der Entwicklung

## 12. Konfigurierbare Aggregationsintervalle

### 12.1 Übersicht

Die Anwendung unterstützt konfigurierbare Zeitintervalle für die Aggregation von Heartbeat-Daten in der Timeline. Der Benutzer kann zwischen 5-, 10- und 15-Minuten-Intervallen wählen, wobei die Standardeinstellung 15 Minuten beträgt.

### 12.2 Implementierungsdetails

#### 12.2.1 Benutzereinstellung

- Die Intervallauswahl wird als Intervall-Button in der Toolbar implementiert, der sich zur Auswahl-Pille „Zoom 15m · 10m · 5m“ aufklappt (siehe 2.5.2)
- Die Einstellung wird in der ActivityStore-Datenstruktur als `aggregationInterval`-Feld gespeichert
- Bei Änderung der Einstellung werden alle betroffenen Tage neu aggregiert

#### 12.2.2 Zeitliche Grenzen

Unabhängig vom gewählten Intervall werden Aktivitätsblöcke immer an festen Uhrzeiten begonnen und beendet, um eine konsistente visuelle Darstellung zu gewährleisten:
- 5-Minuten-Intervalle: XX:00, XX:05, XX:10, XX:15, XX:20, XX:25, XX:30, XX:35, XX:40, XX:45, XX:50, XX:55
- 10-Minuten-Intervalle: XX:00, XX:10, XX:20, XX:30, XX:40, XX:50
- 15-Minuten-Intervalle: XX:00, XX:15, XX:30, XX:45

#### 12.2.3 Berechnung und Darstellung

- Bei Änderung des Aggregationsintervalls wird die `TimelineGenerator`-Komponente die neuen Zeitgrenzen berücksichtigen
- Die visuelle Darstellung in der Timeline-Komponente passt sich automatisch an das gewählte Intervall an
- Die Bedingung, dass mindestens die Hälfte eines Intervalls mit Heartbeats gefüllt sein muss, bleibt unabhängig von der Intervallgröße bestehen

#### 12.2.4 Leistungsauswirkungen

Mit abnehmender Intervallgröße:
- Steigt die Anzahl der dargestellten Aktivitätsblöcke
- Erhöht sich die Detailgenauigkeit der Zeitverfolgung
- Kann die Leistung bei der Aggregation minimal beeinflusst werden