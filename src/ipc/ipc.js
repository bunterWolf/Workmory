const { ipcRenderer } = require('electron');

// IPC module for abstracted communication between renderer and main processes
const ipc = {
  // Get activity data for a specific date
  getActivityData: async (date) => {
    return ipcRenderer.invoke('get-activity-data', date);
  },
  
  // Toggle tracking on/off
  toggleTracking: async (shouldTrack) => {
    return ipcRenderer.invoke('toggle-tracking', shouldTrack);
  },
  
  // Get current tracking status
  getTrackingStatus: async () => {
    return ipcRenderer.invoke('get-tracking-status');
  },
  
  // Update data storage location
  updateStorageLocation: async (newLocation) => {
    return ipcRenderer.invoke('update-activity-store-path', newLocation);
  },
  
  // Confirm using existing activity store file
  confirmUseExistingStore: async (dirPath) => {
    return ipcRenderer.invoke('confirm-use-existing-activity-store', dirPath);
  },
  
  // Update beta release setting
  updateBetaReleaseSetting: async (allowPrerelease) => {
    return ipcRenderer.invoke('update-beta-release-setting', allowPrerelease);
  },
  
  // Open directory selection dialog
  openDirectoryDialog: async () => {
    return ipcRenderer.invoke('open-directory-dialog');
  },
  
  // Get current settings
  getSettings: async () => {
    return ipcRenderer.invoke('get-settings');
  },
  
  // Check if mock data is being used
  isUsingMockData: async () => {
    return ipcRenderer.invoke('is-using-mock-data');
  }
};

module.exports = ipc; 