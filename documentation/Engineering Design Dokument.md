# Engineering Design Document: Focus - Productivity Tracker

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
│Activity │    WatcherManager │  Watchers  │ Persistence │
│ Store   │                   │ (Modules)  │             │
│         │                   │            │             │
└─────────┴───────────────────┴────────────┴─────────────┘
```

### 1.3 Key Components

1. **Electron Framework**: Provides cross-platform support.
2. **Main Process**: Central coordination hub and backend.
3. **Renderer Process**: User interface and visualization.
4. **Activity Store**: Core for storing, processing, and aggregating activity data.
5. **Watcher Manager**: Controls and abstracts all watcher logic.
6. **Watcher Modules**: Implement different tracking logic (active window, inactivity, meetings).

## 2. Component Design

### 2.1 Main Process (main.js)

#### 2.1.1 Responsibilities

- Initializes the application
- Manages windows
- Registers IPC handlers
- Coordinates ActivityStore and WatcherManager instances
- Handles graceful shutdown and cleanup
### 2.2 ActivityStore (src/ActivityStore.ts)

#### 2.2.1 Responsibilities

- Manages and persists activity data
- Cleans up outdated records
- Supports customizable data storage location for synchronization across devices
- Manages and persists Watcher Events
- Creates and updates the Day Summary
	- Combines the WatcherEvents: 
	  active-window->primaryWindow, inactivity and teams-meetings
	- Determines the more important Event per point in time to show only one:
	  Teams > inactivity > active window.
	- Ensures that there are no overlaps, so that less important events are cut off from more important ones in terms of start, duration and end time.
	- Combines events that follow each other identically in type and content into one event and adjusts the startTime, endTime and duration.
	- 
#### 2.2.2 Data Model

```
{
  version: 1,
  startTime: timestamp,
  lastCleanup: timestamp,
  days: {
    ["YYYY-MM-DD"]: {
	  activeTrackingDuration: number,
	  totalActiveDuration: number,
	  totalInactiveDuration: number
      daySummary: [
		  {
			start: startTime,
			end: endTime,
			duration: number,
			type: "primaryWindow",
			title: "Figma",
			subTitle: "UI Redesign v2", 
		  },
		  {
			start: startTime,
			end: endTime,
			duration: number,
			type: "teams_meeting",
			title: "Daily Standup",
		  },
		  {
			start: "09:00",
			end: "09:15",
			duration: number,
			type: "inactive"
		  },
		  {
			start: "09:15",
			end: "09:45",
			duration: number,
			type: "primaryWindow",
			app: "VS Code",
			title: "focus-tracker.js"
		  },
		  ...
	  ],
	  allWatcherEvents: {
	    "active-window": {
		    primaryWindows: [ 
			  {
				start: startTime,
				end: endTime,
				duration: number,
				type: "primaryWindow",
				title: "Figma",
				subTitle: "UI Redesign v2", 
			  },
			  ...
			],
		    allActiveWindows: [ 
			  { 
				  timestamp, 
				  appName, 
				  title, 
				  duration 
			  } 
			],
		},
	    "inactivity": [ { timestamp, duration } ],
	    "teams-meetings": [ { title, startTime, endTime, duration } ]
    }
  }
}

```

### 2.3 WatcherManager (src/WatcherManager.ts)

#### 2.3.1 Responsibilities

- Manages the lifecycle of all watchers
- Forwards watcher events to ActivityStore
- Supports pause/resume operations

### 2.4 Watcher Modules

#### 2.4.1 Active-Window-Watcher

- Monitors active window changes
- Uses `active-win` for cross-platform support
- Sampling every 5000ms
- Stores all activeWindows at allActiveWindows
- Calculates the most frequently used window for a time period in primaryWindows
	- Time periods always end on the quarter hour
	- If the same window is recognised on several consecutive time periods, these time periods are combined into one and the startTime, endTime and duration are adjusted accordingly. 

#### 2.4.2 Inactivity-Watcher

- Detects user inactivity
- Checks every 20 seconds
- Inactivity applies if the user is inactive for more than 5 minutes. 

#### 2.4.3 Teams-Meetings-Watcher

- Detects Teams meeting participation
- Extracts meeting title, start and end time
- A Teams meeting must be active for more than 5 minutes to be recorded.

### 2.5 Renderer Process (React)

#### 2.5.1 Responsibilities
- Displays activity data
- Allows user interaction (pause/resume, date selection)
- Is very minimal
- Auto Refresh data form ActivityStore every minute
    

#### 2.5.2 UI Structure
- Uses minimal **React**
- No third-party UI libraries or routing (no React Router)
- Styling is done using **simple CSS files**, editable directly by designers
- Components are kept flat and small, all in a single `components/` folder

##### 2.5.2.1 Header
- **Date Picker** with friendly labels ("Today", "Yesterday") - placed in Header
	- Arrow Navigation Buttons
- Button to pause or start tracking

#### 2.5.2.2 Content: dayOverview 
- Vertical Timeline (like a Day-Calendar View) showing the data of the ‘daySummary’
- By default, the timeline consists of a time window from 8:00 to 17:00 and expands when events are displayed outside this time. 
- The events are positioned along the vertical time axis according to their start and end time
- Each event displays its type, title, subtitle (if applicable) and duration. 
- The 3 event types are separated by colour
- The view should not load during updates, changes are adjusted directly.

#### 2.5.2.3 Fußzeile
- Displays the total active time and the total inactive time.

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

OS Events -> Watcher -> WatcherManager -> ActivityStore

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

### 4.2 Aggregation & Rounding
- Full miniute rounding for inactivity and meetings
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