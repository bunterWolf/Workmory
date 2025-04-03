const fs = require('fs');
const path = require('path');
const { app, ipcMain, BrowserWindow } = require('electron');
const TimelineGenerator = require('./TimelineGenerator');
const { generateMockData } = require('./mockData');

/**
 * Manages activity data storage, aggregation, and persistence
 */
class ActivityStore {
  /**
   * Initialize the ActivityStore
   * @param {Object} options - Configuration options
   * @param {boolean} options.useMockData - Use mock data instead of real tracking
   * @param {string} options.storagePath - Custom storage path for the data file
   */
  constructor(options = {}) {
    this.options = Object.assign({
      useMockData: false,
      storagePath: null
    }, options);

    // Set up file paths
    this.dataFilePath = this.options.storagePath || 
      path.join(app.getPath('userData'), 'activity-data.json');
    
    // Initialize timeline generator
    this.timelineGenerator = new TimelineGenerator();
    
    // Initialize data structure
    this.data = {
      version: 1,
      startTime: Date.now(),
      lastCleanup: Date.now(),
      aggregationInterval: 15, // Default to 15 minutes
      days: {}
    };
    
    // Tracking state
    this.isTracking = false;
    this.autoSaveInterval = null;
    
    // Use mock data if specified
    if (this.options.useMockData) {
      this.data = generateMockData();
      // Ensure mock data has the aggregationInterval property
      if (!this.data.aggregationInterval) {
        this.data.aggregationInterval = 15;
      }
    } else {
      // Load data from disk if available
      this.loadDataFromDisk();
    }
    
    // Register IPC handlers
    this.registerIpcHandlers();
  }

  /**
   * Register IPC handlers for renderer communication
   */
  registerIpcHandlers() {
    // Don't register 'get-tracking-status' here to avoid duplicate with main.js
    ipcMain.handle('get-day-data', (event, date) => this.getDayData(date));
    ipcMain.handle('get-available-dates', () => this.getAvailableDates());
    ipcMain.on('start-tracking', () => this.startTracking());
    ipcMain.on('pause-tracking', () => this.pauseTracking());
  }

  /**
   * Load data from disk
   */
  loadDataFromDisk() {
    try {
      if (fs.existsSync(this.dataFilePath)) {
        const fileData = fs.readFileSync(this.dataFilePath, 'utf8');
        this.data = JSON.parse(fileData);
        
        // Ensure aggregationInterval exists (for backward compatibility)
        if (!this.data.aggregationInterval) {
          this.data.aggregationInterval = 15;
        }
        
        console.log(`Activity data loaded from ${this.dataFilePath}`);
      } else {
        console.log('No existing activity data found, starting fresh');
      }
    } catch (error) {
      console.error('Error loading activity data:', error);
      // Keep using default empty data structure
    }
  }

  /**
   * Save data to disk
   */
  saveToDisk() {
    if (this.options.useMockData) {
      console.log('Using mock data, not saving to disk');
      return;
    }
    
    try {
      const dataString = JSON.stringify(this.data, null, 2);
      fs.writeFileSync(this.dataFilePath, dataString, 'utf8');
      console.log(`Activity data saved to ${this.dataFilePath}`);
    } catch (error) {
      console.error('Error saving activity data:', error);
    }
  }

  /**
   * Get the current aggregation interval
   * @returns {number} The current aggregation interval in minutes (5, 10, or 15)
   */
  getAggregationInterval() {
    return this.data.aggregationInterval;
  }

  /**
   * Set a new aggregation interval and update all aggregated data
   * @param {number} interval - The new interval in minutes (5, 10, or 15)
   * @returns {Promise<void>}
   */
  async setAggregationInterval(interval) {
    // Validate interval
    if (![5, 10, 15].includes(interval)) {
      throw new Error('Invalid interval. Must be 5, 10, or 15 minutes.');
    }
    
    // Skip if no change
    if (interval === this.data.aggregationInterval) {
      return;
    }
    
    // Update interval
    this.data.aggregationInterval = interval;
    
    // Update the timeline generator with the new interval
    this.timelineGenerator.setAggregationInterval(interval);
    
    // Re-aggregate all days
    this.reaggregateDays();
    
    // Save changes
    this.saveToDisk();
    
    console.log(`Aggregation interval changed to ${interval} minutes`);
  }

  /**
   * Reaggregate all days with the current interval setting
   */
  reaggregateDays() {
    // Skip if using mock data
    if (this.options.useMockData) {
      return;
    }
    
    // Re-process each day
    Object.keys(this.data.days).forEach(dateKey => {
      this.updateAggregatedData(dateKey);
      this.notifyDataUpdate(dateKey);
    });
  }

  /**
   * Start autosave timer
   */
  startAutoSave() {
    if (this.autoSaveInterval) {
      clearInterval(this.autoSaveInterval);
    }
    
    // Save every 5 minutes
    this.autoSaveInterval = setInterval(() => {
      this.saveToDisk();
    }, 5 * 60 * 1000);
  }

  /**
   * Stop autosave timer
   */
  stopAutoSave() {
    if (this.autoSaveInterval) {
      clearInterval(this.autoSaveInterval);
      this.autoSaveInterval = null;
    }
  }

  /**
   * Start tracking activity
   */
  startTracking() {
    if (this.isTracking || this.options.useMockData) {
      return;
    }
    
    this.isTracking = true;
    this.startAutoSave();
    
    console.log('Activity tracking started');
  }

  /**
   * Pause tracking activity
   */
  pauseTracking() {
    if (!this.isTracking || this.options.useMockData) {
      return;
    }
    
    this.isTracking = false;
    this.saveToDisk();
    
    console.log('Activity tracking paused');
  }

  /**
   * Add a heartbeat to the store
   * @param {Object} heartbeatData - Data from watchers
   */
  addHeartbeat(heartbeatData) {
    if (!this.isTracking || this.options.useMockData) {
      return;
    }
    
    const timestamp = Date.now();
    const dateKey = this.getDateKey(timestamp);
    
    // Ensure day exists in data structure
    this.ensureDayExists(dateKey);
    
    // Create heartbeat object
    const heartbeat = {
      timestamp,
      data: heartbeatData
    };
    
    // Add heartbeat to appropriate day
    this.data.days[dateKey].heartbeats.push(heartbeat);

    // Wenn ein 'inactive' Status erkannt wird, aktualisiere vorherige 'may_be_inactive' Heartbeats
    if (heartbeatData.userActivity === 'inactive') {
      this.updatePreviousHeartbeats(dateKey, timestamp);
    }
    
    // Regenerate aggregated data for the day
    this.updateAggregatedData(dateKey);
    
    // Notify the renderer of the update
    this.notifyDataUpdate(dateKey);
  }

  /**
   * Aktualisiert vorherige 'may_be_inactive' Heartbeats zu 'inactive'
   * @param {string} dateKey - Date key
   * @param {number} currentTimestamp - Timestamp des aktuellen Heartbeats
   */
  updatePreviousHeartbeats(dateKey, currentTimestamp) {
    const dayData = this.data.days[dateKey];
    if (!dayData || !dayData.heartbeats) return;

    // Sortiere Heartbeats nach Timestamp (absteigend)
    const sortedHeartbeats = [...dayData.heartbeats].sort((a, b) => b.timestamp - a.timestamp);
    
    let foundActive = false;
    let updateSequence = [];

    // Gehe rückwärts durch die Heartbeats
    for (const heartbeat of sortedHeartbeats) {
      if (heartbeat.timestamp >= currentTimestamp) continue;

      const activity = heartbeat.data.userActivity;

      if (activity === 'active') {
        // Wenn wir einen aktiven Heartbeat finden, beenden wir die Sequenz
        foundActive = true;
        break;
      } else if (activity === 'may_be_inactive') {
        // Sammle may_be_inactive Heartbeats für die Aktualisierung
        updateSequence.push(heartbeat);
      }
    }

    // Aktualisiere die gesammelten Heartbeats zu 'inactive'
    if (updateSequence.length > 0) {
      updateSequence.forEach(heartbeat => {
        heartbeat.data.userActivity = 'inactive';
      });
    }
  }

  /**
   * Get the date key (YYYY-MM-DD) for a timestamp
   * @param {number} timestamp - Timestamp in milliseconds
   * @returns {string} Date key
   */
  getDateKey(timestamp) {
    const date = new Date(timestamp);
    return date.toISOString().split('T')[0];
  }

  /**
   * Ensure day entry exists in the data structure
   * @param {string} dateKey - Date key
   */
  ensureDayExists(dateKey) {
    if (!this.data.days[dateKey]) {
      this.data.days[dateKey] = {
        heartbeats: [],
        aggregated: {
          summary: {
            activeTrackingDuration: 0,
            totalActiveDuration: 0,
            totalInactiveDuration: 0,
            totalMeetingDuration: 0
          },
          timelineOverview: []
        }
      };
    }
  }

  /**
   * Update aggregated data for a day
   * @param {string} dateKey - Date key
   */
  updateAggregatedData(dateKey) {
    const dayData = this.data.days[dateKey];
    
    if (!dayData || !dayData.heartbeats || dayData.heartbeats.length === 0) {
      return;
    }
    
    // Generate timeline events using the current aggregation interval
    const timelineEvents = this.timelineGenerator.generateTimelineEvents(
      dayData.heartbeats
    );
    
    // Calculate summary
    const summary = this.timelineGenerator.calculateSummary(timelineEvents);
    
    // Update aggregated data
    dayData.aggregated = {
      summary,
      timelineOverview: timelineEvents
    };
  }

  /**
   * Notify the renderer process of data updates
   * @param {string} dateKey - Date key
   */
  notifyDataUpdate(dateKey) {
    // Get all browser windows
    const windows = BrowserWindow.getAllWindows();
    
    if (windows.length > 0) {
      windows.forEach(window => {
        if (!window.isDestroyed()) {
          window.webContents.send('activity-data-updated', dateKey);
        }
      });
    }
  }

  /**
   * Get data for a specific day
   * @param {string} dateKey - Date key (YYYY-MM-DD)
   * @returns {Object|null} Day data or null if not found
   */
  getDayData(dateKey) {
    // If no date provided, use today
    if (!dateKey) {
      dateKey = this.getDateKey(Date.now());
    }
    
    return this.data.days[dateKey] || null;
  }

  /**
   * Get a list of all available dates
   * @returns {Array} Array of date keys
   */
  getAvailableDates() {
    return Object.keys(this.data.days).sort();
  }

  /**
   * Clean up old data (older than 30 days)
   */
  cleanupOldData() {
    if (this.options.useMockData) {
      return;
    }
    
    const now = Date.now();
    const thirtyDaysAgo = now - (30 * 24 * 60 * 60 * 1000);
    
    // Skip if last cleanup was less than a day ago
    if (this.data.lastCleanup > now - (24 * 60 * 60 * 1000)) {
      return;
    }
    
    const datesToDelete = [];
    
    // Find dates older than 30 days
    for (const dateKey in this.data.days) {
      const date = new Date(dateKey).getTime();
      if (date < thirtyDaysAgo) {
        datesToDelete.push(dateKey);
      }
    }
    
    // Delete old dates
    datesToDelete.forEach(dateKey => {
      delete this.data.days[dateKey];
    });
    
    if (datesToDelete.length > 0) {
      console.log(`Cleaned up ${datesToDelete.length} days of old data`);
    }
    
    // Update last cleanup time
    this.data.lastCleanup = now;
    
    // Save changes to disk
    this.saveToDisk();
  }

  /**
   * Clean up and close the activity store
   */
  cleanup() {
    this.stopAutoSave();
    this.saveToDisk();
    
    // Unregister IPC handlers
    ipcMain.removeHandler('get-day-data');
    ipcMain.removeHandler('get-available-dates');
    ipcMain.removeAllListeners('start-tracking');
    ipcMain.removeAllListeners('pause-tracking');
    
    console.log('ActivityStore cleaned up');
  }
}

module.exports = ActivityStore; 