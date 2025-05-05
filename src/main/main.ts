// Remove ts-node/register as this file will be compiled
// require('ts-node/register');

import { app, BrowserWindow, ipcMain, IpcMainInvokeEvent, dialog } from 'electron';
import * as path from 'path';
import * as url from 'url';
import * as remoteMain from '@electron/remote/main'; // Use import for @electron/remote/main
import { autoUpdater, UpdateInfo, ProgressInfo } from 'electron-updater';
import * as fs from 'fs';

// Read app version from package.json
import { version as appVersion } from '../../package.json';

// Use default imports for our TypeScript modules
import ActivityStore from '../store/ActivityStore';
import HeartbeatManager from '../store/HeartbeatManager';

// Initialize @electron/remote
remoteMain.initialize();

// Keep a global reference of the window object and other instances
// Add type annotations (BrowserWindow | null, etc.)
let mainWindow: BrowserWindow | null = null;
let activityStore: ActivityStore | null = null;
let heartbeatManager: HeartbeatManager | null = null;

// Prüfe, ob bereits eine Instanz läuft
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  console.log('Eine andere Instanz der App läuft bereits. Beende diese Instanz.');
  app.quit();
} else {
  // Reagiere auf den Start einer zweiten Instanz
  app.on('second-instance', (event, commandLine, workingDirectory) => {
    // Wenn ein Fenster existiert, fokussiere es
    if (mainWindow) {
      if (mainWindow.isMinimized()) {
        mainWindow.restore();
      }
      mainWindow.focus();
    }
  });
}

// Check if in development mode and enable live reload
const isDev = process.env.NODE_ENV === 'development';
if (isDev) {
  try {
    // Use import for electron-reload if possible, otherwise keep require
    require('electron-reload')(__dirname, {
      electron: path.join(__dirname, '../../node_modules', '.bin', 'electron')
    });
  } catch (e) {
    console.log('Electron reload not available:', e);
  }
}

// Check for the mock data flag
const useMockData = process.argv.includes('--mock-data');
if (useMockData) {
  console.log('🧪 Mock data mode enabled for development');
}

// Create the main browser window
function createWindow(): void { // Add return type void
  mainWindow = new BrowserWindow({
    width: 1024,
    height: 768,
    title: 'Chronflow - Passive Work Tracker' + (useMockData ? ' (Mock Data)' : ''),
    icon: path.join(app.getAppPath(), 'build', 'icon.ico'),
    webPreferences: {
      nodeIntegration: true, // Consider disabling if possible for security
      contextIsolation: false, // Consider enabling if possible for security
      // enableRemoteModule: true, // deprecated, use remoteMain.enable instead
      // --- Add preload script if contextIsolation is enabled ---
      // preload: path.join(__dirname, 'preload.js')
    },
  });

  // Enable @electron/remote for the created window
  if (mainWindow) {
      remoteMain.enable(mainWindow.webContents);
  }


  // Load the index.html file.
  // In development, use webpack output path
  let rendererPath;
  
  // In development mode, always load from dist directory
  rendererPath = path.join(__dirname, '../../dist/index.html');
  
  console.log(`Attempting to load renderer from: ${rendererPath}`); // Debug log
  mainWindow.loadURL(url.format({
    pathname: rendererPath,
    protocol: 'file:',
    slashes: true
  }));

  // Open DevTools in development mode
  if (isDev && mainWindow) {
    mainWindow.webContents.openDevTools();
  }

  // Emitted when the window is closed
  if (mainWindow) {
      mainWindow.on('closed', () => { // Use arrow function for correct 'this' if needed (not needed here)
        mainWindow = null;
      });
  }
}

// Initialize activity tracking components
async function initializeTracking(): Promise<void> { // Add return type Promise<void>
   if (!mainWindow) {
       console.error("Cannot initialize tracking: mainWindow is not available.");
       return;
   }

  console.log("Initializing tracking components...");
  try {
      // Create ActivityStore instance with mock data flag
      activityStore = new ActivityStore({
        useMockData: useMockData
        // Pass storagePath if needed
      });
      console.log("ActivityStore created.");

      // Create HeartbeatManager instance with activity store and main window
      heartbeatManager = new HeartbeatManager({
        activityStore: activityStore, // activityStore is guaranteed to be non-null here
        mainWindow: mainWindow // mainWindow is checked at the start
      });
      console.log("HeartbeatManager created.");

      // Initialize the watchers inside the heartbeat manager
      await heartbeatManager.init();
      console.log("HeartbeatManager initialized.");

      // Start tracking (only if not using mock data)
      if (!useMockData && activityStore && heartbeatManager) {
        // Start the watcher for activity data
        activityStore.startTracking();

        // Start generating heartbeats
        heartbeatManager.start();

        console.log('Activity tracking initialized and started');
      } else if (useMockData) {
        console.log('Using mock data, not starting real tracking');
      }

      // Run cleanup for old data
      if (activityStore) {
          activityStore.cleanupOldData();
      }
  } catch (error) {
      console.error("Error during tracking initialization:", error);
      // Handle initialization error appropriately (e.g., show error message to user)
      // Reset instances maybe?
      activityStore = null;
      heartbeatManager = null;
  }
}

// Register IPC handlers
function registerIpcHandlers(): void { // Add return type void
  console.log("Registering IPC handlers...");

  // Get tracking status
  ipcMain.handle('get-tracking-status', (): boolean => {
    if (useMockData) return true;
    // Ensure activityStore exists before accessing property
    return activityStore ? activityStore.isTracking : false;
  });

  // Toggle tracking status
  // Add types for event and shouldTrack
  ipcMain.handle('toggle-tracking', async (event: IpcMainInvokeEvent, shouldTrack: boolean): Promise<boolean> => {
    if (useMockData) {
      console.log('Mock data mode - tracking controls disabled');
      return true; // Return current (mock) status
    }

    // Ensure instances exist before calling methods
    if (!activityStore || !heartbeatManager) {
        console.error('Cannot toggle tracking: store or manager not initialized.');
        return false; // Indicate failure or current state
    }

    try {
        if (shouldTrack) {
          activityStore.startTracking();
          heartbeatManager.start();
          return true;
        } else {
          activityStore.pauseTracking();
          heartbeatManager.stop();
          return false;
        }
    } catch (error) {
        console.error('Error toggling tracking state:', error);
        // Return current state in case of error?
        return activityStore.isTracking;
    }
  });

  // Check if using mock data
  ipcMain.handle('is-using-mock-data', (): boolean => {
    return useMockData;
  });

  // Get app version
  ipcMain.handle('get-app-version', (): string => {
    return appVersion;
  });

  // Settings-bezogene Handler
  
  // Get current settings
  ipcMain.handle('get-settings', (): any => {
    if (!activityStore) {
      console.error('Cannot get settings: activity store not initialized.');
      return { error: 'Activity store not initialized' };
    }
    
    const settingsManager = activityStore.getSettingsManager();
    return {
      activityStoreDirPath: settingsManager.getActivityStoreDirPath(),
      allowPrerelease: settingsManager.getAllowPrerelease()
    };
  });
  
  // Update activity store path
  ipcMain.handle('update-activity-store-path', async (event: IpcMainInvokeEvent, newPath: string | null): Promise<any> => {
    if (!activityStore) {
      console.error('Cannot update activity store path: activity store not initialized.');
      return { success: false, error: 'Activity store not initialized' };
    }
    
    // Wenn Dateien existieren würde, zeige Bestätigungsdialog
    if (newPath) {
      const fullPath = path.join(newPath, 'chronflow-activity-store.json');
      if (fs.existsSync(fullPath)) {
        return { 
          success: false, 
          fileExists: true,
          path: fullPath 
        };
      }
    }
    
    // Aktualisiere den Pfad
    const success = activityStore.updateStoragePath(newPath);
    return { success };
  });
  
  // Confirm using existing activity store file
  ipcMain.handle('confirm-use-existing-activity-store', async (event: IpcMainInvokeEvent, newPath: string): Promise<any> => {
    if (!activityStore) {
      console.error('Cannot update activity store path: activity store not initialized.');
      return { success: false, error: 'Activity store not initialized' };
    }
    
    // Verwende die existierende Datei
    const success = activityStore.useExistingStoreFile(newPath);
    return { success };
  });
  
  // Update beta release setting
  ipcMain.handle('update-beta-release-setting', async (event: IpcMainInvokeEvent, allowPrerelease: boolean): Promise<any> => {
    if (!activityStore) {
      console.error('Cannot update beta release setting: activity store not initialized.');
      return { success: false, error: 'Activity store not initialized' };
    }
    
    // Aktualisiere die Einstellung
    const settingsManager = activityStore.getSettingsManager();
    settingsManager.setAllowPrerelease(allowPrerelease);
    
    // Aktualisiere den Auto-Updater
    autoUpdater.channel = allowPrerelease ? 'beta' : 'latest';
    
    // Löse eine neue Update-Prüfung aus
    autoUpdater.checkForUpdates().catch((err: Error) => {
      console.error('Error checking for updates:', err);
    });
    
    return { success: true };
  });
  
  // Open directory dialog
  ipcMain.handle('open-directory-dialog', async (event: IpcMainInvokeEvent): Promise<string | null> => {
    if (!mainWindow) {
      console.error('Cannot open directory dialog: main window not initialized.');
      return null;
    }
    
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory']
    });
    
    if (result.canceled) {
      return null;
    }
    
    return result.filePaths[0];
  });

  console.log("IPC handlers registered.");
}

// Initialize auto-updater
function initAutoUpdater() {
  // Konfiguriere Auto-Updater
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  // Beta-Kanal Konfiguration
  // Lies die Einstellung aus den Settings statt aus der Umgebungsvariable
  const allowPrerelease = activityStore?.getSettingsManager().getAllowPrerelease() || false;
  if (allowPrerelease) {
    autoUpdater.channel = 'beta';
    console.log('Beta-Updates aktiviert');
  }

  // Event-Handler für Update-Status
  autoUpdater.on('checking-for-update', () => {
    console.log('Checking for updates...');
    notifyAllWindows('update-status', { status: 'checking' });
  });

  autoUpdater.on('update-available', (info: UpdateInfo) => {
    console.log('Update available:', info);
    notifyAllWindows('update-status', { 
      status: 'available',
      version: info.version
    });
  });

  autoUpdater.on('update-not-available', (info: UpdateInfo) => {
    console.log('Update not available:', info);
    notifyAllWindows('update-status', { status: 'not-available' });
  });

  autoUpdater.on('error', (err: Error) => {
    console.error('Update error:', err);
    notifyAllWindows('update-status', { 
      status: 'error',
      error: err.message
    });
  });

  autoUpdater.on('download-progress', (progressObj: ProgressInfo) => {
    console.log('Download progress:', progressObj);
    notifyAllWindows('update-status', {
      status: 'downloading',
      progress: progressObj
    });
  });

  autoUpdater.on('update-downloaded', (info: UpdateInfo) => {
    console.log('Update downloaded:', info);
    notifyAllWindows('update-status', {
      status: 'downloaded',
      version: info.version
    });
  });

  // Prüfe regelmäßig auf Updates (alle 4 Stunden)
  setInterval(() => {
    autoUpdater.checkForUpdates().catch((err: Error) => {
      console.error('Error checking for updates:', err);
    });
  }, 4 * 60 * 60 * 1000);

  // Erste Update-Prüfung nach App-Start
  autoUpdater.checkForUpdates().catch((err: Error) => {
    console.error('Error checking for updates:', err);
  });
}

// Hilfsfunktion zum Benachrichtigen aller Fenster
function notifyAllWindows(channel: string, data: any) {
  const windows = BrowserWindow.getAllWindows();
  windows.forEach(window => {
    if (!window.isDestroyed()) {
      window.webContents.send(channel, data);
    }
  });
}

// App is ready to start
app.whenReady().then(async () => {
  console.log("App ready.");
  createWindow();
  await initializeTracking();
  registerIpcHandlers();
  initAutoUpdater(); // Initialize auto-updater

  app.on('activate', () => { // Use arrow function
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) {
        console.log("App activated with no windows open, creating window.");
        createWindow();
    }
  });
});

// Quit when all windows are closed, except on macOS
app.on('window-all-closed', () => { // Use arrow function
  // On macOS it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  if (process.platform !== 'darwin') {
    console.log("All windows closed, quitting app (non-macOS).");
    app.quit();
  }
});

// Save data and clean up before quitting
app.on('before-quit', async (event) => { // Add event type if needed (Event)
  console.log('App before-quit event triggered.');
  // Prevent immediate quitting if cleanup takes time?
  // event.preventDefault();

  try {
      // Clean up resources
      if (heartbeatManager) {
        console.log("Cleaning up HeartbeatManager...");
        heartbeatManager.cleanup();
      }

      if (activityStore) {
        console.log("Cleaning up ActivityStore...");
        activityStore.cleanup(); // This should also save data
      }

      // Clean up our directly registered IPC handlers (optional but good practice)
      console.log("Removing IPC handlers...");
      ipcMain.removeHandler('get-tracking-status');
      ipcMain.removeHandler('toggle-tracking');
      ipcMain.removeHandler('is-using-mock-data');

      console.log('All resources cleaned up before quitting.');
      // Allow quitting now
      // app.quit(); // Only if preventDefault was called
  } catch(error) {
      console.error("Error during before-quit cleanup:", error);
      // Consider whether to still quit or not
      // app.exit(1); // Exit with error code
  }
}); 