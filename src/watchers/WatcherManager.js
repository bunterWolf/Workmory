const ActiveWindowWatcher = require('./ActiveWindowWatcher');
const InactivityWatcher = require('./InactivityWatcher');
const TeamsMeetingsWatcher = require('./TeamsMeetingsWatcher');

class WatcherManager {
  constructor(activityStore) {
    this.activityStore = activityStore;
    this.watchers = [];
    this.tracking = false;
    
    // Initialize watchers
    this.initialize();
  }
  
  // Initialize all watchers
  initialize() {
    this.watchers = [
      new ActiveWindowWatcher(this.activityStore),
      new InactivityWatcher(this.activityStore),
      new TeamsMeetingsWatcher(this.activityStore)
    ];
  }
  
  // Start all watchers
  startAll() {
    for (const watcher of this.watchers) {
      watcher.start();
    }
    this.tracking = true;
  }
  
  // Stop all watchers
  stopAll() {
    for (const watcher of this.watchers) {
      watcher.stop();
    }
    this.tracking = false;
  }
  
  // Check if tracking is active
  isTracking() {
    return this.tracking;
  }
  
  // Dispose of all watchers
  dispose() {
    this.stopAll();
    this.watchers = [];
  }
}

module.exports = WatcherManager; 