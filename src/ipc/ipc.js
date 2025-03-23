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
    return ipcRenderer.invoke('update-storage-location', newLocation);
  },
  
  // Check if mock data is being used
  isUsingMockData: async () => {
    return ipcRenderer.invoke('is-using-mock-data');
  }
};

module.exports = ipc; 