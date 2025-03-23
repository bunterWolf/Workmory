const { screen } = require('electron');

class InactivityWatcher {
  constructor(activityStore) {
    this.activityStore = activityStore;
    this.interval = null;
    this.lastActivityTime = Date.now();
    this.checkInterval = 20000; // 20 seconds
    this.inactivityThreshold = 5 * 60 * 1000; // 5 minutes
    this.inactivityStartTime = null;
    this.isInactive = false;
  }
  
  // Start monitoring inactivity
  start() {
    if (this.interval) return;
    
    // Reset activity time on start
    this.lastActivityTime = Date.now();
    
    // Listen to user input events
    this.setupListeners();
    
    // Set up interval to check for inactivity
    this.interval = setInterval(() => {
      this.checkInactivity();
    }, this.checkInterval);
  }
  
  // Stop monitoring inactivity
  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
      
      // Clean up listeners
      this.removeListeners();
      
      // Record any ongoing inactivity period
      if (this.isInactive) {
        this.recordInactivity();
      }
    }
  }
  
  // Set up user input event listeners
  setupListeners() {
    // Use Electron's screen module to detect cursor position changes
    if (screen) {
      this.cursorPositionListener = setInterval(() => {
        const point = screen.getCursorScreenPoint();
        
        if (this.lastCursorPosition && 
            (this.lastCursorPosition.x !== point.x || 
             this.lastCursorPosition.y !== point.y)) {
          this.updateActivity();
        }
        
        this.lastCursorPosition = point;
      }, 1000);
    }
  }
  
  // Remove user input event listeners
  removeListeners() {
    if (this.cursorPositionListener) {
      clearInterval(this.cursorPositionListener);
      this.cursorPositionListener = null;
    }
  }
  
  // Update last activity time
  updateActivity() {
    const now = Date.now();
    this.lastActivityTime = now;
    
    // If we were inactive, record the inactivity period
    if (this.isInactive) {
      this.recordInactivity();
      this.isInactive = false;
      this.inactivityStartTime = null;
    }
  }
  
  // Check for inactivity
  checkInactivity() {
    const now = Date.now();
    const idleTime = now - this.lastActivityTime;
    
    // If idle time exceeds threshold and not already marked as inactive
    if (idleTime >= this.inactivityThreshold && !this.isInactive) {
      this.isInactive = true;
      this.inactivityStartTime = this.lastActivityTime;
    }
  }
  
  // Record an inactivity period
  recordInactivity() {
    if (!this.inactivityStartTime) return;
    
    const now = Date.now();
    const duration = now - this.inactivityStartTime;
    
    // Only record if duration is significant
    if (duration >= this.inactivityThreshold) {
      this.activityStore.storeInactivityEvent({
        timestamp: this.inactivityStartTime,
        duration: duration
      });
    }
  }
}

module.exports = InactivityWatcher; 