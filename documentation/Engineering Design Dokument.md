# Engineering Design Document: Focus - Productivity Tracker

## Glossar

- **Heartbeat**: Ein zeitbasierter Datenpunkt, der alle 30 Sekunden erfasst wird und den aktuellen Systemzustand dokumentiert.
- **Watcher**: Modulare Komponenten, die spezifische Systemzustände überwachen (z.B. aktives Fenster, Benutzeraktivität).
- **Aggregation**: Prozess der Zusammenfassung von Heartbeat-Daten in 15-Minuten-Intervalle für die Timeline-Darstellung.

## 1. System Architecture

### 1.1 Overview

Focus is an Electron-based desktop application designed to track and analyze user activity on a computer. The application follows a main process/renderer process architecture connected through IPC communication.

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
				}
				userActivity: "active" | "may_be_inactive" | "inactive",
				appWindow: {
					app: string,
					title: string
				}
			  }
            }
          ]
    	,
      aggregated: {
		summary: {
			activeTrackingDuration: number,
			totalActiveDuration: number,
			totalInactiveDuration: number,
			totalMeetingDuration: number
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
- An activity is calculated when its end time is reached.

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
- Uses minimal **React**
- No third-party UI libraries or routing (no React Router)
- Styling is done using **simple CSS files**, editable directly by designers
- Components are kept flat and small

##### 2.5.2.1 Header
- **Date Picker** with friendly labels ("Today", "Yesterday") - placed in Header
	- Arrow Navigation Buttons
- **Interval Selector** dropdown for choosing the aggregation block size (5, 10, or 15 minutes)
- Button to pause or start tracking

#### 2.5.2.2 Content: DayOverview

##### A. Grundlegende Anforderungen
1. **Zeitliche Darstellung**
   - Vertikale Timeline im Kalender-Stil
   - Standard-Zeitfenster: 8:00 bis 17:00 Uhr
   - Dynamische Erweiterung bei Events außerhalb des Standard-Zeitfensters
   - TimelineOverview event block Positionierung entsprechend der Zeitskala für Start- und Endzeit

##### B. Event-Darstellung

1. **Event-Block Informationen**
   - Farbkodierung nach Event-Typ
   - Proportionale Höhendarstellung entsprechend der Eventdauer
   - Einheitliche Blockbreite unabhängig vom Inhalt
   - Dauer in benutzerfreundlichem Format
   - Meetings: Vollständiger Meeting-Titel und Status
   - Inaktive Zeiten: Standardisierte Beschreibung
   - Aktive Fenster: Anwendungsname und Fenstertitel

##### C. Interaktives Verhalten

1. **Echtzeit-Updates**
   - Nahtlose Integration neuer Events
   - Keine Neuladung bei Datenaktualisierung

2. **Scroll-Verhalten**
   - Vertikales Scrollen durch die Zeitskala für einen Tag
   - Automatischer Scroll zur aktuellen Zeit bei Initialisierung
   - Beibehaltung der Scroll-Position bei Updates

##### D. Responsive Design

1. **Bildschirmanpassung**
   - Flexible Breitenanpassung
   - Beibehaltung der ausgewählten Aggregationsintervall-Proportionen (5, 10 oder 15 Minuten)   

2. **Wiederherstellung**
   - Automatische Wiederherstellung nach Verbindungsabbrüchen
   - Erhaltung des Anzeigestatus bei Fehlern
   - Nahtlose Fortsetzung der Aktualisierungen

#### 2.5.2.3 Fußzeile
- Displays the total active time and the total inactive time calculated in the aggregated summary data.

#### 2.5.4 Development & Debugging

- All components written in plain, typed React functional components
- Use of `console.log` and browser dev tools for debugging
- IPC communication isolated in a simple `ipc.ts` module
- Minimal Webpack/Build config to reduce overhead
- Directory structure is flat and easy to follow:
    
    ```
    src/
      ├── main/              # Electron main process
      ├── renderer/          # React UI (no routing)
      ├── components/        # Small reusable components
      ├── watchers/          # Watcher implementations
      ├── store/             # ActivityStore logic
      ├── ipc/               # IPC bridge
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

## 4. Technical Details

### 4.1 Persistence

- Stored in `app.getPath('userData')/activity-data.json`
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

- Die Intervallauswahl wird als Dropdown-Menü im Header der Anwendung implementiert
- Die Einstellung wird in der ActivityStore-Datenstruktur als `aggregationInterval`-Feld gespeichert
- Bei Änderung der Einstellung werden alle betroffenen Tage neu aggregiert

#### 12.2.2 Zeitliche Grenzen

Unabhängig vom gewählten Intervall werden Aktivitätsblöcke immer an festen Uhrzeiten begonnen und beendet, um eine konsistente visuelle Darstellung zu gewährleisten:
- 5-Minuten-Intervalle: XX:00, XX:05, XX:10, XX:15, XX:20, XX:25, XX:30, XX:35, XX:40, XX:45, XX:50, XX:55
- 10-Minuten-Intervalle: XX:00, XX:10, XX:20, XX:30, XX:40, XX:50
- 15-Minuten-Intervalle: XX:00, XX:15, XX:30, XX:45

#### 12.2.3 Berechnung und Darstellung

- Bei Änderung des Aggregationsintervalls wird die `TimelineGenerator`-Komponente die neuen Zeitgrenzen berücksichtigen
- Die visuelle Darstellung in der DayOverview-Komponente passt sich automatisch an das gewählte Intervall an
- Die Bedingung, dass mindestens die Hälfte eines Intervalls mit Heartbeats gefüllt sein muss, bleibt unabhängig von der Intervallgröße bestehen

#### 12.2.4 Leistungsauswirkungen

Mit abnehmender Intervallgröße:
- Steigt die Anzahl der dargestellten Aktivitätsblöcke
- Erhöht sich die Detailgenauigkeit der Zeitverfolgung
- Kann die Leistung bei der Aggregation minimal beeinflusst werden