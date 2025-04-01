const activeWin = require('active-win');

/**
 * Watcher module that tracks the currently active window
 */
class ActiveWindowWatcher {
  constructor() {
    this.lastActiveWindow = null;
  }

  /**
   * Initialize the watcher
   */
  init() {
    // Nothing to initialize for this watcher
    return Promise.resolve();
  }

  /**
   * Get the current active window information
   * @returns {Promise<{app: string, title: string}>} Active window information
   */
  async getActiveWindow() {
    try {
      const windowInfo = await activeWin();
      
      if (!windowInfo) {
        return null;
      }
      
      this.lastActiveWindow = {
        app: windowInfo.owner.name,
        title: windowInfo.title
      };
      
      return this.lastActiveWindow;
    } catch (error) {
      console.error('Error getting active window:', error);
      return this.lastActiveWindow || null;
    }
  }

  /**
   * Get data for the heartbeat
   * @returns {Promise<{appWindow: {app: string, title: string} | null}>}
   */
  async getHeartbeatData() {
    const activeWindow = await this.getActiveWindow();
    return { appWindow: activeWindow };
  }

  /**
   * Clean up resources used by the watcher
   */
  cleanup() {
    this.lastActiveWindow = null;
  }
}

module.exports = ActiveWindowWatcher; 