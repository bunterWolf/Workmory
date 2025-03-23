const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const url = require('url');
const ActivityStore = require('../store/ActivityStore');
const WatcherManager = require('../watchers/WatcherManager');

// Keep a global reference of the window object and other instances
let mainWindow;
let activityStore;
let watcherManager;

// Check if in development mode and enable live reload
const isDev = process.env.NODE_ENV === 'development';
if (isDev) {
  try {
    require('electron-reload')(__dirname, {
      electron: path.join(__dirname, '../../node_modules', '.bin', 'electron')
    });
  } catch (e) {
    console.log('Electron reload not available');
  }
}

// Create the main browser window
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 700,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
    title: 'Focus - Productivity Tracker'
  });

  // Load the index.html file
  mainWindow.loadURL(url.format({
    pathname: path.join(__dirname, '../renderer/index.html'),
    protocol: 'file:',
    slashes: true
  }));

  // Open DevTools in development mode
  if (isDev) {
    mainWindow.webContents.openDevTools();
  }

  // Emitted when the window is closed
  mainWindow.on('closed', function () {
    mainWindow = null;
  });
}

// Initialize activity tracking components
function initializeTracking() {
  // Create ActivityStore instance
  activityStore = new ActivityStore();
  
  // Create WatcherManager instance and pass the ActivityStore to it
  watcherManager = new WatcherManager(activityStore);
  
  // Start tracking
  watcherManager.startAll();
}

// Register IPC handlers
function registerIpcHandlers() {
  // Get activity data for a specific date
  ipcMain.handle('get-activity-data', async (event, date) => {
    return activityStore.getActivityData(date);
  });
  
  // Pause or resume tracking
  ipcMain.handle('toggle-tracking', async (event, shouldTrack) => {
    if (shouldTrack) {
      watcherManager.startAll();
      return true;
    } else {
      watcherManager.stopAll();
      return false;
    }
  });
  
  // Get tracking status
  ipcMain.handle('get-tracking-status', () => {
    return watcherManager.isTracking();
  });
  
  // Update data storage location
  ipcMain.handle('update-storage-location', async (event, newLocation) => {
    return activityStore.updateStoragePath(newLocation);
  });
}

// App is ready to start
app.whenReady().then(() => {
  createWindow();
  initializeTracking();
  registerIpcHandlers();
  
  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// Quit when all windows are closed, except on macOS
app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});

// Save data and clean up before quitting
app.on('before-quit', async () => {
  if (watcherManager) {
    watcherManager.stopAll();
  }
  
  if (activityStore) {
    await activityStore.save();
  }
}); 