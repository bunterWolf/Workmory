const ActiveWindowWatcher = require('../watchers/ActiveWindowWatcher');
const InactivityWatcher = require('../watchers/InactivityWatcher');
const TeamsMeetingsWatcher = require('../watchers/TeamsMeetingsWatcher');

/**
 * Manages heartbeat generation and all watchers
 * This class combines the functionality of the former HeartbeatManager and WatcherManager
 */
class HeartbeatManager {
  /**
   * Initialize the HeartbeatManager
   * @param {Object} options - Configuration options
   * @param {ActivityStore} options.activityStore - ActivityStore instance
   * @param {Electron.BrowserWindow} options.mainWindow - Main Electron window
   */
  constructor(options = {}) {
    this.activityStore = options.activityStore;
    this.mainWindow = options.mainWindow;
    
    this.heartbeatInterval = null;
    this.isRunning = false;
    this.isInitialized = false;
    
    // Flag to track if we need to check if it's time for a heartbeat
    this.shouldCheckHeartbeatTime = true;
    
    // Initialize watcher instances
    this.activeWindowWatcher = new ActiveWindowWatcher();
    this.inactivityWatcher = new InactivityWatcher();
    this.teamsMeetingsWatcher = new TeamsMeetingsWatcher();
    
    // Store all watchers in an array for easier management
    this.watchers = [
      this.activeWindowWatcher,
      this.inactivityWatcher,
      this.teamsMeetingsWatcher
    ];
  }

  /**
   * Initialize all watchers
   * @returns {Promise<void>}
   */
  async init() {
    if (this.isInitialized) {
      return;
    }

    console.log('Initializing HeartbeatManager watchers...');
    
    try {
      // Initialize each watcher with appropriate parameters
      await this.activeWindowWatcher.init();
      await this.inactivityWatcher.init(this.mainWindow);
      await this.teamsMeetingsWatcher.init();
      
      this.isInitialized = true;
      console.log('HeartbeatManager watchers initialized successfully');
    } catch (error) {
      console.error('Error initializing HeartbeatManager watchers:', error);
      throw error;
    }
  }
  
  /**
   * Start generating heartbeats
   */
  start() {
    if (this.isRunning || !this.isInitialized) {
      return;
    }
    
    this.isRunning = true;
    
    // Set up interval to check for heartbeat timing
    this.heartbeatInterval = setInterval(() => {
      this.checkHeartbeatTime();
    }, 1000); // Check every second
    
    console.log('HeartbeatManager started');
  }

  /**
   * Stop generating heartbeats
   */
  stop() {
    if (!this.isRunning) {
      return;
    }
    
    this.isRunning = false;
    
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
    
    console.log('HeartbeatManager stopped');
  }

  /**
   * Check if it's time to generate a heartbeat (at :15 and :45 seconds of every minute)
   */
  checkHeartbeatTime() {
    if (!this.isRunning || !this.shouldCheckHeartbeatTime) {
      return;
    }
    
    const now = new Date();
    const seconds = now.getSeconds();
    
    // Generate heartbeats at :15 and :45 seconds
    if (seconds === 15 || seconds === 45) {
      this.shouldCheckHeartbeatTime = false;
      this.generateHeartbeat();
      
      // Reset the flag after 1 second to avoid duplicate heartbeats
      setTimeout(() => {
        this.shouldCheckHeartbeatTime = true;
      }, 1000);
    }
  }

  /**
   * Collect data from all watchers for a heartbeat
   * @returns {Promise<Object>} Combined heartbeat data
   */
  async collectHeartbeatData() {
    if (!this.isInitialized) {
      throw new Error('HeartbeatManager watchers not initialized');
    }
    
    try {
      // Collect data from each watcher in parallel
      const results = await Promise.all([
        this.activeWindowWatcher.getHeartbeatData(),
        this.inactivityWatcher.getHeartbeatData(),
        this.teamsMeetingsWatcher.getHeartbeatData()
      ]);
      
      // Merge all data into a single object
      return Object.assign({}, ...results);
    } catch (error) {
      console.error('Error collecting heartbeat data:', error);
      throw error;
    }
  }

  /**
   * Generate a heartbeat by collecting data from watchers
   */
  async generateHeartbeat() {
    if (!this.isRunning || !this.activityStore) {
      return;
    }
    
    try {
      // Collect data from all watchers
      const heartbeatData = await this.collectHeartbeatData();
      
      // Add heartbeat to activity store
      this.activityStore.addHeartbeat(heartbeatData);
    } catch (error) {
      console.error('Error generating heartbeat:', error);
    }
  }

  /**
   * Clean up resources
   */
  cleanup() {
    this.stop();
    
    // Clean up each watcher
    this.watchers.forEach(watcher => {
      try {
        watcher.cleanup();
      } catch (error) {
        console.error(`Error cleaning up watcher:`, error);
      }
    });
    
    this.isInitialized = false;
    
    console.log('HeartbeatManager cleaned up');
  }
}

module.exports = HeartbeatManager; 