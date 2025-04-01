const { ipcMain } = require('electron');

/**
 * Watcher module that detects user inactivity
 * Returns the following states:
 * - "active": User has been active since the last heartbeat
 * - "may_be_inactive": User has not been active since the last heartbeat 
 * - "inactive": User has not been active for the last five heartbeats
 */
class InactivityWatcher {
  constructor() {
    this.lastUserActivityTime = Date.now();
    this.inactivityCounter = 0;
    this.status = 'active';
    this.boundHandleUserActivity = this.handleUserActivity.bind(this);
  }

  /**
   * Initialize the watcher
   * @param {Electron.BrowserWindow} mainWindow - The main browser window
   */
  init(mainWindow) {
    if (!mainWindow) {
      console.error('Cannot initialize InactivityWatcher without a mainWindow');
      return Promise.reject(new Error('mainWindow is required'));
    }

    // Register IPC handler for user activity events from the renderer
    ipcMain.on('user-activity', this.boundHandleUserActivity);
    
    // Send an instruction to the renderer to start monitoring user activity
    mainWindow.webContents.send('start-activity-monitoring');

    this.lastUserActivityTime = Date.now();
    this.inactivityCounter = 0;
    this.status = 'active';

    return Promise.resolve();
  }

  /**
   * Handle user activity events from the renderer
   */
  handleUserActivity() {
    this.lastUserActivityTime = Date.now();
    this.inactivityCounter = 0;
    this.status = 'active';
  }

  /**
   * Check if the user is inactive since the last heartbeat
   * @returns {boolean}
   */
  isInactiveSinceLastHeartbeat() {
    // If the last activity was more than 30 seconds ago (standard heartbeat interval)
    return (Date.now() - this.lastUserActivityTime) > 30000;
  }

  /**
   * Get data for the heartbeat
   * @returns {Promise<{userActivity: string}>}
   */
  async getHeartbeatData() {
    if (this.isInactiveSinceLastHeartbeat()) {
      this.inactivityCounter++;
      
      // After 5 heartbeats (approximately 2.5 minutes) of inactivity
      if (this.inactivityCounter >= 5) {
        this.status = 'inactive';
      } else {
        this.status = 'may_be_inactive';
      }
    } else {
      this.inactivityCounter = 0;
      this.status = 'active';
    }

    return { userActivity: this.status };
  }

  /**
   * Reset inactivity counter and status
   */
  resetInactivity() {
    this.lastUserActivityTime = Date.now();
    this.inactivityCounter = 0;
    this.status = 'active';
  }

  /**
   * Clean up resources used by the watcher
   */
  cleanup() {
    ipcMain.removeListener('user-activity', this.boundHandleUserActivity);
  }
}

module.exports = InactivityWatcher; 