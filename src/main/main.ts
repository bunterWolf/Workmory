// Remove ts-node/register as this file will be compiled
// require('ts-node/register');

import { app, BrowserWindow, ipcMain, IpcMainInvokeEvent, dialog } from 'electron';
import * as path from 'path';
import * as url from 'url';
import * as remoteMain from '@electron/remote/main'; // Use import for @electron/remote/main
import { autoUpdater, UpdateInfo, ProgressInfo } from 'electron-updater';
import * as fs from 'fs';
import AutoLaunch from 'auto-launch'; // Auto-Launch-Import

// Read app version from package.json
import { version as appVersion } from '../../package.json';

// Use default imports for our TypeScript modules
import HeartbeatManager from '../store/HeartbeatManager';
import { ActivityFacade } from '../store/ActivityFacade';
import { ActivityFacadeIpc } from '../store/ActivityFacadeIpc';

// Auto-Launcher-Instanz
let autoLauncher: AutoLaunch;

// Initialize @electron/remote
remoteMain.initialize();

// Keep a global reference of the window object and other instances
// Add type annotations (BrowserWindow | null, etc.)
let mainWindow: BrowserWindow | null = null;
let activityFacade: ActivityFacade | null = null;
let heartbeatManager: HeartbeatManager | null = null;
let activityFacadeIpc: ActivityFacadeIpc | null = null;

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
    title: 'Workmory - Automatic time tracking made easy and free' + (useMockData ? ' (Mock Data)' : ''),
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
      // Erstelle die ActivityFacade
      activityFacade = new ActivityFacade({
        useMockData: useMockData
        // storagePath wird aus den Einstellungen gelesen
      });
      console.log("ActivityFacade created.");
      
      // Erstelle den ActivityFacadeIpc-Handler
      activityFacadeIpc = new ActivityFacadeIpc(activityFacade);
      activityFacadeIpc.registerHandlers();
      console.log("ActivityFacadeIpc registered.");

      // Create HeartbeatManager instance with activity facade and main window
      heartbeatManager = new HeartbeatManager({
        activityFacade: activityFacade, // Direkter Zugriff auf ActivityFacade
        mainWindow: mainWindow // mainWindow is checked at the start
      });
      console.log("HeartbeatManager created.");

      // Initialize the watchers inside the heartbeat manager
      await heartbeatManager.init();
      console.log("HeartbeatManager initialized.");

      // Initialisiere AutoLaunch
      try {
        autoLauncher = new AutoLaunch({
          name: 'Chronflow',
          path: app.getPath('exe'),
        });

        // Synchronisiere mit den gespeicherten Einstellungen
        if (activityFacade) {
          const settingsManager = activityFacade.getSettingsManager();
          const shouldAutoLaunch = settingsManager.getAutoLaunchEnabled();
          
          const isEnabled = await autoLauncher.isEnabled();
          
          // Nur ändern, wenn nötig
          if (shouldAutoLaunch && !isEnabled) {
            await autoLauncher.enable();
            console.log('Auto-Start aktiviert');
          } else if (!shouldAutoLaunch && isEnabled) {
            await autoLauncher.disable();
            console.log('Auto-Start deaktiviert');
          }
        }
      } catch (error) {
        console.error('Fehler bei der Initialisierung von AutoLaunch:', error);
      }

      // Start tracking (only if not using mock data)
      if (!useMockData && activityFacade && heartbeatManager) {
        // Start the activity facade
        activityFacade.startTracking();

        // Start generating heartbeats
        heartbeatManager.start();

        console.log('Activity tracking initialized and started');
      } else if (useMockData) {
        console.log('Using mock data, not starting real tracking');
      }

      // Run cleanup for old data
      if (activityFacade) {
          activityFacade.cleanupOldData();
      }
      
      // Start day change monitoring
      if (activityFacade) {
          activityFacade.startDayChangeMonitoring(handleDayChange);
          console.log('Day change monitoring started');
      }
  } catch (error) {
      console.error("Error during tracking initialization:", error);
      // Handle initialization error appropriately (e.g., show error message to user)
      // Reset instances maybe?
      activityFacade = null;
      activityFacadeIpc = null;
      heartbeatManager = null;
  }
}

// Register IPC handlers
function registerIpcHandlers(): void { // Add return type void
  console.log("Registering IPC handlers...");

  // Get tracking status - jetzt direkt über ActivityFacade
  ipcMain.handle('get-tracking-status', (): boolean => {
    if (useMockData) return true;
    // Direkter Zugriff auf ActivityFacade
    return activityFacade ? true : false; // Vereinfachte Implementierung - ActivityFacade hat keine isTracking Property
  });

  // Toggle tracking status - jetzt mit ActivityFacade
  ipcMain.handle('toggle-tracking', async (event: IpcMainInvokeEvent, shouldTrack: boolean): Promise<boolean> => {
    if (useMockData) {
      console.log('Mock data mode - tracking controls disabled');
      return true;
    }

    // Prüfe ob ActivityFacade und HeartbeatManager existieren
    if (!activityFacade || !heartbeatManager) {
        console.error('Cannot toggle tracking: activity facades not initialized.');
        return false;
    }

    try {
        if (shouldTrack) {
          activityFacade.startTracking();
          heartbeatManager.start();
          return true;
        } else {
          activityFacade.pauseTracking();
          heartbeatManager.stop();
          return false;
        }
    } catch (error) {
        console.error('Error toggling tracking state:', error);
        return false;
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
    if (!activityFacade) {
      console.error('Cannot get settings: activity facade not initialized.');
      return { error: 'Activity facade not initialized' };
    }
    
    const settingsManager = activityFacade.getSettingsManager();
    return {
      activityStoreDirPath: settingsManager.getActivityStoreDirPath(),
      allowPrerelease: settingsManager.getAllowPrerelease()
    };
  });
  
  // Update activity store path
  ipcMain.handle('update-activity-store-path', async (event: IpcMainInvokeEvent, newPath: string | null): Promise<any> => {
    if (!activityFacade) {
      console.error('Cannot update activity store path: activity facade not initialized.');
      return { success: false, error: 'Activity facade not initialized' };
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
    const success = activityFacade.updateStoragePath(newPath);
    return { success };
  });
  
  // Confirm using existing activity store file
  ipcMain.handle('confirm-use-existing-activity-store', async (event: IpcMainInvokeEvent, newPath: string): Promise<any> => {
    if (!activityFacade) {
      console.error('Cannot update activity store path: activity facade not initialized.');
      return { success: false, error: 'Activity facade not initialized' };
    }
    
    // Verwende die existierende Datei
    const success = activityFacade.useExistingStoreFile(newPath);
    return { success };
  });
  
  // Update beta release setting
  ipcMain.handle('update-beta-release-setting', async (event: IpcMainInvokeEvent, allowPrerelease: boolean): Promise<any> => {
    if (!activityFacade) {
      console.error('Cannot update beta release setting: activity facade not initialized.');
      return { success: false, error: 'Activity facade not initialized' };
    }
    
    // Aktualisiere die Einstellung
    const settingsManager = activityFacade.getSettingsManager();
    settingsManager.setAllowPrerelease(allowPrerelease);
    
    // Aktualisiere den AutoUpdater
    autoUpdater.allowPrerelease = allowPrerelease;
    
    return { success: true };
  });

  // Update auto launch setting
  ipcMain.handle('update-auto-launch-setting', async (event: IpcMainInvokeEvent, enabled: boolean): Promise<any> => {
    if (!activityFacade) {
      console.error('Cannot update auto launch setting: activity facade not initialized.');
      return { success: false, error: 'Activity facade not initialized' };
    }
    
    try {
      // Aktualisiere die Einstellung
      const settingsManager = activityFacade.getSettingsManager();
      settingsManager.setAutoLaunchEnabled(enabled);
      
      // Aktualisiere AutoLaunch
      if (enabled) {
        await autoLauncher.enable();
      } else {
        await autoLauncher.disable();
      }
      
      return { success: true };
    } catch (error: any) {
      console.error('Error updating auto launch setting:', error);
      return { success: false, error: error.message };
    }
  });

  console.log("IPC handlers registered.");
}

/**
 * Wird aufgerufen, wenn sich der Tag ändert. Lädt alle Fenster neu, damit sie
 * den neuen Tag anzeigen.
 * @param oldDateKey Der alte Datums-Key
 * @param newDateKey Der neue Datums-Key
 */
function handleDayChange(oldDateKey: string, newDateKey: string): void {
  console.log(`Day changed from ${oldDateKey} to ${newDateKey}. Refreshing windows...`);
  
  // Alle Fenster neu laden
  const windows = BrowserWindow.getAllWindows();
  windows.forEach(window => {
    if (window && !window.isDestroyed()) {
      try {
        // Fenster neu laden, um die gesamte UI mit dem neuen Tag zu aktualisieren
        window.reload();
        console.log(`Successfully refreshed window ${window.id}`);
      } catch (error) {
        console.warn(`Failed to refresh window ${window.id}:`, error);
      }
    }
  });
}

// Initialize auto-updater
function initAutoUpdater() {
  // Konfiguriere Auto-Updater
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.logger = console;
  autoUpdater.forceDevUpdateConfig = false;

  // Beta-Kanal Konfiguration
  // Lies die Einstellung aus den Settings statt aus der Umgebungsvariable
  const allowPrerelease = activityFacade?.getSettingsManager().getAllowPrerelease() || false;
  if (allowPrerelease) {
    autoUpdater.channel = 'beta';
    console.log('Beta-Updates aktiviert. Kanal:', autoUpdater.channel);
  } else {
    autoUpdater.channel = 'latest';
    console.log('Standard-Updates aktiviert. Kanal:', autoUpdater.channel);
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

// Cleanup resources before quit
const cleanup = () => {
  console.log('Cleaning up resources before quit...');
  
  try {
    if (heartbeatManager) {
      console.log("Cleaning up HeartbeatManager...");
      heartbeatManager.cleanup();
    }
    
    if (activityFacade) {
      console.log("Cleaning up ActivityFacade...");
      activityFacade.cleanup(); // This will save data
    }

    // Unregister IPC handlers
    console.log("Unregistering IPC handlers...");
    ipcMain.removeHandler('get-tracking-status');
    ipcMain.removeHandler('toggle-tracking');
    ipcMain.removeHandler('is-using-mock-data');
    ipcMain.removeHandler('get-settings');
    ipcMain.removeHandler('update-activity-store-path');
    ipcMain.removeHandler('confirm-use-existing-activity-store');
    ipcMain.removeHandler('update-beta-release-setting');
    ipcMain.removeHandler('update-auto-launch-setting');

    console.log('All resources cleaned up before quitting.');
  } catch (err) {
    console.error('Error during cleanup:', err);
  }
};

// Save data and clean up before quitting
app.on('before-quit', async (event) => { // Add event type if needed (Event)
  console.log('App before-quit event triggered.');
  // Prevent immediate quitting if cleanup takes time?
  // event.preventDefault();

  try {
      // Clean up resources
      cleanup();

      // Allow quitting now
      // app.quit(); // Only if preventDefault was called
  } catch(error) {
      console.error("Error during before-quit cleanup:", error);
      // Consider whether to still quit or not
      // app.exit(1); // Exit with error code
  }
}); 