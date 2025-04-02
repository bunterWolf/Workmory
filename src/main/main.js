const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const url = require('url');
const ActivityStore = require('../store/ActivityStore');
const HeartbeatManager = require('../store/HeartbeatManager');

// Keep a global reference of the window object and other instances
let mainWindow;
let activityStore;
let heartbeatManager;

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

// Check for the mock data flag
const useMockData = process.argv.includes('--mock-data');
if (useMockData) {
  console.log('🧪 Mock data mode enabled for development');
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
    title: 'Focus - Productivity Tracker' + (useMockData ? ' (Mock Data)' : '')
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
async function initializeTracking() {
  // Create ActivityStore instance with mock data flag
  activityStore = new ActivityStore({
    useMockData: useMockData
  });
  
  // Create HeartbeatManager instance with activity store and main window
  heartbeatManager = new HeartbeatManager({
    activityStore: activityStore,
    mainWindow: mainWindow
  });
  
  // Initialize the watchers inside the heartbeat manager
  await heartbeatManager.init();
  
  // Start tracking (only if not using mock data)
  if (!useMockData) {
    // Start the watcher for activity data
    activityStore.startTracking();
    
    // Start generating heartbeats
    heartbeatManager.start();
    
    console.log('Activity tracking initialized and started');
  } else {
    console.log('Using mock data, not starting real tracking');
  }
  
  // Run cleanup for old data
  activityStore.cleanupOldData();
}

// Register IPC handlers
function registerIpcHandlers() {
  // Get tracking status
  ipcMain.handle('get-tracking-status', () => {
    if (useMockData) return true;
    return activityStore.isTracking;
  });
  
  // Toggle tracking status
  ipcMain.handle('toggle-tracking', async (event, shouldTrack) => {
    if (useMockData) {
      console.log('Mock data mode - tracking controls disabled');
      return true;
    }
    
    if (shouldTrack) {
      activityStore.startTracking();
      heartbeatManager.start();
      return true;
    } else {
      activityStore.pauseTracking();
      heartbeatManager.stop();
      return false;
    }
  });
  
  // Check if using mock data
  ipcMain.handle('is-using-mock-data', () => {
    return useMockData;
  });
  
  // Get current aggregation interval
  ipcMain.handle('get-aggregation-interval', () => {
    return activityStore.getAggregationInterval();
  });
  
  // Set new aggregation interval
  ipcMain.handle('set-aggregation-interval', async (event, interval) => {
    try {
      await activityStore.setAggregationInterval(interval);
      return true;
    } catch (error) {
      console.error('Error setting aggregation interval:', error);
      return false;
    }
  });
}

// App is ready to start
app.whenReady().then(async () => {
  createWindow();
  await initializeTracking();
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
  // Clean up resources
  if (heartbeatManager) {
    heartbeatManager.cleanup();
  }
  
  if (activityStore) {
    activityStore.cleanup();
  }
  
  // Clean up our directly registered IPC handlers
  ipcMain.removeHandler('get-tracking-status');
  ipcMain.removeHandler('toggle-tracking');
  ipcMain.removeHandler('is-using-mock-data');
  ipcMain.removeHandler('get-aggregation-interval');
  ipcMain.removeHandler('set-aggregation-interval');
  
  console.log('All resources cleaned up before quitting');
}); 