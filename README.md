# Focus - Productivity Tracker

Focus is an Electron-based desktop application designed to track and analyze your computer activity. It automatically records which applications you use, detects inactive periods, and identifies Teams meetings to give you a clear overview of how you spend your time.

## Features

- **Automatic Activity Tracking**: Monitors which applications you're using without manual input
- **Inactivity Detection**: Identifies when you're away from your computer
- **Teams Meeting Tracking**: Recognizes and logs your Microsoft Teams meetings
- **Timeline View**: Visual representation of your day with color-coded activities
- **Date Navigation**: Easily switch between today, yesterday, and previous days
- **Activity Summary**: See total active and inactive time at a glance
- **Pause/Resume**: Control when tracking occurs
- **Local Data Storage**: All your data stays on your computer
- **Cross-Platform**: Works on Windows, macOS, and Linux

## Development

### Prerequisites

- Node.js (v14+)
- npm or yarn

### Setup

1. Clone the repository
   ```
   git clone https://github.com/yourusername/focus.git
   cd focus
   ```

2. Install dependencies
   ```
   npm install
   ```

3. Run in development mode
   ```
   npm run dev
   ```

### Building

To build the application for your platform:

```
npm run dist
```

This will create platform-specific installers in the `release` directory.

## Data Storage

By default, activity data is stored in the app's user data directory. You can change this location to use a shared folder (like Google Drive or Dropbox) for synchronization across devices.

Data is automatically cleaned up after 30 days to avoid excessive storage usage.

## Privacy

Focus is designed with privacy in mind:
- All data is stored locally on your computer
- No data is sent to the internet or any third-party servers
- The application will request necessary permissions to access window information

## License

MIT 