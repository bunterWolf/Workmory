# Missing Hours - Automatic time tracking made easy and free

Missing Hours is an Electron-based desktop application designed to track and analyze your computer activity. It automatically records which applications you use, detects inactive periods, and identifies time spent on different tasks.

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

- **macOS**: ZIP archive
  - Unzip and move to Applications
  - Automatic updates
  - macOS 10.15 (Catalina) and newer

## Development

### Prerequisites

- Node.js (v20+)
- npm or yarn

### Setup

1. Clone the repository
   ```
   git clone https://github.com/bunterWolf/Missing-Hours.git
   cd Missing-Hours
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
     - x64 and arm64 builds
     - ZIP archive
     - Auto-update support

#### App Icon

All icon files come from one drawing, `resources/icon-source/icon.svg` (square, artwork edge to edge). After changing it, run:
```bash
npm run icons
```
and commit the generated files: `resources/icon.ico` (Windows, 16–256 px), `resources/icon.png`
(1024 px, window icon outside Windows), `resources/icon.icns` (macOS, artwork scaled to Apple's
824/1024 icon grid) and the Microsoft Store tiles in `resources/appx/`.

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
   - Run the tests and build the installers for all platforms
   - Create the GitHub Release with all files, once every platform has succeeded

See `docs/RELEASE-PROZESS.md` for details and troubleshooting.

### Beta Testing

#### Creating a Beta Release

To create a beta version for testing, from a beta branch (`beta` or `beta/*`):
```bash
npm run release:beta
```

This will:
1. Create a version with beta tag (e.g., v1.1.0-beta.0)
2. Generate a changelog
3. Push the branch and the tag
4. Trigger the GitHub Actions workflow, which builds the installers and creates a GitHub Pre-Release

See `docs/BETA-RELEASE-PROZESS.md` for the full process, including how the version number continues.

#### Setting Up Beta Testers

Beta testers need to opt-in to receive beta updates:

1. **In the app**: turn on the beta updates toggle in the settings.

2. **Manual installation**:
   - Download the beta installer from GitHub Pre-Releases
   - Install the beta version
   - Turn on the toggle to receive newer beta versions automatically

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

Missing Hours is designed with privacy in mind:
- **Local Storage:** All tracked data is stored locally on your computer. No data is sent to external servers.
