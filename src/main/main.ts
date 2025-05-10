// Remove ts-node/register as this file will be compiled
// require('ts-node/register');

import { app, BrowserWindow, ipcMain, IpcMainInvokeEvent, dialog, globalShortcut } from 'electron';
import * as path from 'path';
import * as url from 'url';
import * as remoteMain from '@electron/remote/main'; // Use import for @electron/remote/main
import { autoUpdater, UpdateInfo, ProgressInfo } from 'electron-updater';
import * as fs from 'fs';
import AutoLaunch from 'auto-launch'; // Auto-Launch-Import

// Read app version from package.json
import { version as appVersion } from '../../package.json';

// Use default imports for our TypeScript modules
import ActivityStore from '../store/ActivityStore';
import HeartbeatManager from '../store/HeartbeatManager';
import OnboardingWindow from './OnboardingWindow';
import { PermissionsManager } from '../store/PermissionsManager';
import { SettingsManager } from '../store/SettingsManager';

// Auto-Launcher-Instanz
let autoLauncher: AutoLaunch;

// Initialize @electron/remote
remoteMain.initialize();

// Keep a global reference of the window object and other instances
// Add type annotations (BrowserWindow | null, etc.)
let mainWindow: BrowserWindow | null = null;
let activityStore: ActivityStore | null = null;
let heartbeatManager: HeartbeatManager | null = null;
let onboardingWindow: OnboardingWindow | null = null;
let permissionsManager: PermissionsManager | null = null;
let settingsManager: SettingsManager | null = null;

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

// Create and show the onboarding window
function createOnboardingWindow(): OnboardingWindow {
  onboardingWindow = new OnboardingWindow();
  onboardingWindow.createWindow();
  
  // Set callback for when the window is attempted to be closed
  onboardingWindow.setOnCloseCallback(() => {
    // Prevent closing the onboarding window if it's required
    if (settingsManager && !settingsManager.getOnboardingCompleted()) {
      dialog.showMessageBox({
        type: 'info',
        title: 'Onboarding erforderlich',
        message: 'Bitte schließen Sie das Onboarding ab, um die App zu nutzen.',
        buttons: ['OK']
      });
    } else {
      // If onboarding is complete, allow closing
      onboardingWindow?.close();
      onboardingWindow = null;
      
      // Open the main window if it doesn't exist
      if (!mainWindow) {
        createWindow();
        initializeTracking();
      }
    }
  });
  
  return onboardingWindow;
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

      // Initialisiere AutoLaunch
      try {
        autoLauncher = new AutoLaunch({
          name: 'Chronflow',
          path: app.getPath('exe'),
        });

        // Synchronisiere mit den gespeicherten Einstellungen
        if (activityStore) {
          const settingsManager = activityStore.getSettingsManager();
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

      // Add permission check in heartbeatManager initialization
      if (heartbeatManager) {
        heartbeatManager.on('permissions-required', () => {
          // Check if permissions are still valid
          if (permissionsManager) {
            permissionsManager.checkPermissions().then(status => {
              if (!status.accessibility || !status.screenRecording) {
                // If permissions are missing, update settings and show onboarding
                if (settingsManager) {
                  settingsManager.setPermissionsGranted(status);
                  settingsManager.setOnboardingCompleted(false);
                  
                  // Show onboarding window
                  createOnboardingWindow();
                }
              }
            });
          }
        });
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

  // Auto-Launch-Einstellungen abrufen
  ipcMain.handle('get-auto-launch-settings', async (): Promise<any> => {
    if (!activityStore) {
      console.error('Cannot get auto-launch settings: activity store not initialized.');
      return { enabled: false, error: 'Activity store not initialized' };
    }
    
    const settingsManager = activityStore.getSettingsManager();
    const enabled = settingsManager.getAutoLaunchEnabled();
    
    return { enabled };
  });
  
  // Auto-Launch-Einstellungen aktualisieren
  ipcMain.handle('update-auto-launch-settings', async (event: IpcMainInvokeEvent, enabled: boolean): Promise<any> => {
    if (!activityStore || !autoLauncher) {
      console.error('Cannot update auto-launch settings: components not initialized.');
      return { success: false, error: 'Components not initialized' };
    }
    
    try {
      // Einstellung in SettingsManager speichern
      const settingsManager = activityStore.getSettingsManager();
      settingsManager.setAutoLaunchEnabled(enabled);
      
      // AutoLaunch aktualisieren
      if (enabled) {
        await autoLauncher.enable();
      } else {
        await autoLauncher.disable();
      }
      
      return { success: true };
    } catch (error) {
      console.error('Fehler beim Aktualisieren der Auto-Launch-Einstellungen:', error);
      return { success: false, error: 'Fehler beim Aktualisieren der Einstellungen' };
    }
  });

  // Register onboarding-specific IPC handlers
  registerOnboardingHandlers();

  console.log("IPC handlers registered.");
}

// Register Onboarding-specific IPC handlers
function registerOnboardingHandlers(): void {
  // Get platform
  ipcMain.handle('onboarding:get-platform', async () => {
    return process.platform;
  });
  
  // Check permissions
  ipcMain.handle('onboarding:check-permissions', async () => {
    if (!permissionsManager) {
      permissionsManager = new PermissionsManager();
    }
    return await permissionsManager.checkPermissions();
  });
  
  // Request accessibility permission
  ipcMain.handle('onboarding:request-accessibility', async () => {
    if (!permissionsManager) {
      permissionsManager = new PermissionsManager();
    }
    
    const result = await permissionsManager.requestAccessibilityPermission();
    
    // Update settings
    if (settingsManager) {
      const permissions = settingsManager.getPermissionsGranted();
      permissions.accessibility = result;
      settingsManager.setPermissionsGranted(permissions);
    }
    
    // Notify renderer of permission change
    if (onboardingWindow && onboardingWindow.getWindow()) {
      onboardingWindow.getWindow()?.webContents.send('onboarding:permission-changed', 'accessibility', result);
    }
    
    return result;
  });
  
  // Request screen recording permission
  ipcMain.handle('onboarding:request-screen-recording', async () => {
    if (!permissionsManager) {
      permissionsManager = new PermissionsManager();
    }
    
    const result = await permissionsManager.requestScreenRecordingPermission();
    
    // Update settings
    if (settingsManager) {
      const permissions = settingsManager.getPermissionsGranted();
      permissions.screenRecording = result;
      settingsManager.setPermissionsGranted(permissions);
    }
    
    // Notify renderer of permission change
    if (onboardingWindow && onboardingWindow.getWindow()) {
      onboardingWindow.getWindow()?.webContents.send('onboarding:permission-changed', 'screenRecording', result);
    }
    
    return result;
  });
  
  // Open accessibility settings
  ipcMain.handle('onboarding:open-accessibility-settings', async () => {
    if (!permissionsManager) {
      permissionsManager = new PermissionsManager();
    }
    return await permissionsManager.openAccessibilityPreferences();
  });
  
  // Open screen recording settings
  ipcMain.handle('onboarding:open-screen-recording-settings', async () => {
    if (!permissionsManager) {
      permissionsManager = new PermissionsManager();
    }
    return await permissionsManager.openScreenRecordingPreferences();
  });
  
  // Complete onboarding
  ipcMain.handle('onboarding:complete', async () => {
    if (settingsManager) {
      settingsManager.setOnboardingCompleted(true);
    }
    
    // Close onboarding window and open main window
    if (onboardingWindow) {
      onboardingWindow.close();
      onboardingWindow = null;
    }
    
    if (!mainWindow) {
      createWindow();
      await initializeTracking();
    } else {
      mainWindow.show();
    }
    
    return true;
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
  const allowPrerelease = activityStore?.getSettingsManager().getAllowPrerelease() || false;
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

// App ready event handler
app.whenReady().then(async () => {
  registerIpcHandlers();
  
  // Initialize Settings Manager first
  settingsManager = new SettingsManager();
  
  // Initialize Permissions Manager
  permissionsManager = new PermissionsManager();
  
  // Check if onboarding is completed
  const onboardingCompleted = settingsManager.getOnboardingCompleted();
  
  if (!onboardingCompleted) {
    // If onboarding is not completed, show onboarding window
    createOnboardingWindow();
  } else {
    // Check permissions again to be sure
    const permissions = await permissionsManager.checkPermissions();
    
    if (!permissions.accessibility || !permissions.screenRecording) {
      // If permissions are missing, update settings and show onboarding
      settingsManager.setPermissionsGranted(permissions);
      settingsManager.setOnboardingCompleted(false);
      createOnboardingWindow();
    } else {
      // If all is well, proceed with normal startup
      createWindow();
      await initializeTracking();
    }
  }
  
  initAutoUpdater();
});

// Quit when all windows are closed, except on macOS
app.on('window-all-closed', () => {
  // On macOS it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  if (process.platform !== 'darwin') {
    console.log("All windows closed, quitting app (non-macOS).");
    app.quit();
  }
});

app.on('activate', () => {
  // On macOS it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
      console.log("App activated with no windows open, creating window.");
      createWindow();
  }
});

// Add Ctrl+Shift+O shortcut to restart onboarding
app.on('browser-window-focus', () => {
  globalShortcut.register('CommandOrControl+Shift+O', () => {
    if (settingsManager) {
      settingsManager.setOnboardingCompleted(false);
      
      if (onboardingWindow && onboardingWindow.isVisible()) {
        // If already open, reset permissions
        if (settingsManager) {
          settingsManager.setPermissionsGranted({
            accessibility: false,
            screenRecording: false
          });
        }
        // Reload onboarding window
        onboardingWindow.getWindow()?.reload();
      } else {
        // Create new onboarding window
        createOnboardingWindow();
        
        // Hide main window
        if (mainWindow) {
          mainWindow.hide();
        }
      }
    }
  });
});

app.on('browser-window-blur', () => {
  globalShortcut.unregister('CommandOrControl+Shift+O');
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
      ipcMain.removeHandler('get-auto-launch-settings');
      ipcMain.removeHandler('update-auto-launch-settings');

      console.log('All resources cleaned up before quitting.');
      // Allow quitting now
      // app.quit(); // Only if preventDefault was called
  } catch(error) {
      console.error("Error during before-quit cleanup:", error);
      // Consider whether to still quit or not
      // app.exit(1); // Exit with error code
  }
}); 