const activeWin = require('active-win');

class ActiveWindowWatcher {
  constructor(activityStore) {
    this.activityStore = activityStore;
    this.interval = null;
    this.lastSampledWindow = null;
    this.sampleInterval = 5000; // 5 seconds
  }
  
  // Start monitoring active windows
  start() {
    if (this.interval) return;
    
    this.interval = setInterval(async () => {
      try {
        await this.sampleActiveWindow();
      } catch (error) {
        console.error('Error sampling active window:', error);
      }
    }, this.sampleInterval);
  }
  
  // Stop monitoring active windows
  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }
  
  // Sample the current active window and process it
  async sampleActiveWindow() {
    try {
      const activeWindow = await activeWin();
      
      if (!activeWindow) return;
      
      const timestamp = Date.now();
      const appName = activeWindow.owner?.name || activeWindow.title || 'Unknown';
      const title = activeWindow.title || 'Unknown';
      
      // Store the window data
      this.activityStore.storeActiveWindowEvent({
        timestamp,
        appName,
        title,
        duration: this.sampleInterval
      });
      
      // Update last sampled window
      this.lastSampledWindow = {
        timestamp,
        appName,
        title
      };
    } catch (error) {
      console.error('Failed to get active window:', error);
    }
  }
}

module.exports = ActiveWindowWatcher; 