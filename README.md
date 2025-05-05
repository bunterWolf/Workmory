# Chronflow - Productivity Tracker

Chronflow is an Electron-based desktop application designed to track and analyze your computer activity. It automatically records which applications you use, detects inactive periods, and identifies Teams meetings to give you a clear overview of how you spend your time.

## Features

- **Automatic Activity Tracking**: Monitors which applications you're using without manual input
- **Inactivity Detection**: Identifies when you're away from your computer
- **Teams Meeting Tracking**: Recognizes and logs your Microsoft Teams meetings
- **Timeline View**: Visual representation of your day with color-coded activities
- **Date Navigation**: Easily switch between today, yesterday, and previous days
- **Activity Summary**: See total active and inactive time at a glance
- **Pause/Resume**: Control when tracking occurs
- **Local Data Storage**: All your data stays on your computer
- **Cross-Platform**: Works on Windows and macOS
- **Automatic Updates**: Seamlessly receive and install new versions

## Supported Platforms

- **Windows**: Installer (.exe)
  - One-click installation
  - Automatic updates
  - Windows 10 and newer

- **macOS**: DMG installer
  - Easy drag & drop installation
  - Automatic updates
  - macOS 10.15 (Catalina) and newer

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

### Using Mock Data

For development and testing purposes, you can use sample mock data instead of tracking real activity:

```
npm start -- --mock-data
```

When using mock data:
- The application will load sample activity data from `public/mock-data.json` instead of tracking real activity.
- No actual activity will be tracked.
- Tracking controls will be disabled.
- Mock data will not be saved to disk.

This is useful for:
- UI development without waiting for real data
- Testing functionality without actual tracking
- Presentations and demos

### Building and Releasing

#### Local Development Build

To create a development build:
```bash
npm run build
```

This will:
1. Run tests
2. Compile TypeScript
3. Bundle with webpack

#### Creating Installers

To build installers for your current platform:
```bash
npm run dist
```

Platform-specific builds:
- Windows: `npm run dist:win`
- macOS: `npm run dist:mac`

The build process will:
1. Create platform-specific installers in the `release` directory
2. Generate auto-update files (latest.yml for Windows, latest-mac.yml for macOS)
3. Create installers with the following features:
   - Windows:
     - NSIS installer (.exe)
     - Desktop and Start Menu shortcuts
     - Auto-update support
   - macOS:
     - Universal Binary (x64 + arm64)
     - DMG installer and ZIP archive
     - Auto-update support

#### Creating a Release

To create a new release:
```bash
npm run release
```

This will:
1. Update the version number
2. Generate the changelog
3. Create a git tag
4. Push to GitHub
5. Trigger the GitHub Actions workflow that will:
   - Build the installers for all platforms
   - Create a GitHub Release
   - Upload the installers and update files

### Beta Testing

#### Creating a Beta Release

To create a beta version for testing:
```bash
npm run release:beta
```

This will:
1. Create a version with beta tag (e.g., v1.1.0-beta.0)
2. Generate a changelog
3. Create a GitHub Pre-Release
4. Build and upload installers to the beta channel

#### Setting Up Beta Testers

Beta testers need to opt-in to receive beta updates. There are two ways to enable beta updates:

1. **Environment Variable**:
   - Set `ALLOW_PRERELEASE=true` in the system environment
   - Restart the application

2. **Manual Installation**:
   - Download the beta installer from GitHub Pre-Releases
   - Install the beta version
   - The app will automatically update to newer beta versions

#### Beta Testing Workflow

1. **Developer**:
   - Make changes
   - Run `npm run release:beta`
   - Monitor feedback from beta testers

2. **Beta Testers**:
   - Enable beta updates
   - Use the application normally
   - Report bugs and feedback
   - Get automatic updates for new beta versions

3. **Final Release**:
   When beta testing is successful:
   - Run `npm run release`
   - This creates the final version
   - All users receive the update

#### Notes
- Beta versions are clearly marked (e.g., v1.1.0-beta.0)
- Only opted-in devices receive beta updates
- Beta releases are marked as pre-releases on GitHub
- Regular users won't see or receive beta updates
- You can release multiple beta versions (beta.1, beta.2, etc.)

## Data Storage

By default, activity data is stored in the app's user data directory. You can change this location to use a shared folder (like Google Drive or Dropbox) for synchronization across devices.

Data is automatically cleaned up after 30 days to avoid excessive storage usage.

Chronflow is designed with privacy in mind:
- **Local Storage:** All tracked data is stored locally on your computer. No data is sent to external servers.

## License

MIT 