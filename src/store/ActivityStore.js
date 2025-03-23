const fs = require('fs');
const path = require('path');
const { app } = require('electron');

class ActivityStore {
  constructor(customStoragePath = null) {
    this.version = 1;
    this.startTime = Date.now();
    this.lastCleanup = Date.now();
    this.days = {};
    this.storagePath = customStoragePath || path.join(app.getPath('userData'), 'activity-data.json');
    
    // Load existing data if available
    this.load();
    
    // Set up auto-save
    this.autoSaveInterval = setInterval(() => this.save(), 5 * 60 * 1000); // Save every 5 minutes
    
    // Clean up old data once a day
    this.cleanupInterval = setInterval(() => this.cleanup(), 24 * 60 * 60 * 1000);
  }
  
  // Load data from storage
  load() {
    try {
      if (fs.existsSync(this.storagePath)) {
        const data = JSON.parse(fs.readFileSync(this.storagePath, 'utf8'));
        
        // Check version and migrate if needed
        if (data.version === this.version) {
          this.days = data.days || {};
          this.startTime = data.startTime || Date.now();
          this.lastCleanup = data.lastCleanup || Date.now();
        } else {
          // Handle version migration if needed
          console.log('Data version mismatch, initializing new data structure');
        }
      }
    } catch (error) {
      console.error('Error loading activity data:', error);
    }
  }
  
  // Save data to storage
  async save() {
    try {
      const data = {
        version: this.version,
        startTime: this.startTime,
        lastCleanup: this.lastCleanup,
        days: this.days
      };
      
      await fs.promises.writeFile(this.storagePath, JSON.stringify(data, null, 2), 'utf8');
    } catch (error) {
      console.error('Error saving activity data:', error);
    }
  }
  
  // Update storage path and move data
  async updateStoragePath(newPath) {
    try {
      // Save current data first
      await this.save();
      
      // Update path
      this.storagePath = newPath;
      
      // Save to new location
      await this.save();
      return true;
    } catch (error) {
      console.error('Error updating storage path:', error);
      return false;
    }
  }
  
  // Get today's date key in YYYY-MM-DD format
  static getTodayKey() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  }
  
  // Initialize data structure for a new day
  initDay(dateKey) {
    if (!this.days[dateKey]) {
      this.days[dateKey] = {
        activeTrackingDuration: 0,
        totalActiveDuration: 0,
        totalInactiveDuration: 0,
        daySummary: [],
        allWatcherEvents: {
          'active-window': {
            primaryWindows: [],
            allActiveWindows: []
          },
          'inactivity': [],
          'teams-meetings': []
        }
      };
    }
    return this.days[dateKey];
  }
  
  // Process and store an active window event
  storeActiveWindowEvent(eventData) {
    const dateKey = ActivityStore.getTodayKey();
    const dayData = this.initDay(dateKey);
    
    // Add to allActiveWindows list
    dayData.allWatcherEvents['active-window'].allActiveWindows.push({
      timestamp: eventData.timestamp,
      appName: eventData.appName,
      title: eventData.title,
      duration: eventData.duration
    });
    
    // Update primary window if this is the most active in the time period
    this.calculatePrimaryWindows(dateKey);
    
    // Update day summary
    this.updateDaySummary(dateKey);
    
    return true;
  }
  
  // Process and store an inactivity event
  storeInactivityEvent(eventData) {
    const dateKey = ActivityStore.getTodayKey();
    const dayData = this.initDay(dateKey);
    
    // Round to nearest 5 minutes
    const duration = Math.round(eventData.duration / (5 * 60 * 1000)) * 5 * 60 * 1000;
    
    // Add to inactivity list
    dayData.allWatcherEvents['inactivity'].push({
      timestamp: eventData.timestamp,
      duration: duration
    });
    
    // Update tracking metrics
    dayData.totalInactiveDuration += duration;
    
    // Update day summary
    this.updateDaySummary(dateKey);
    
    return true;
  }
  
  // Process and store a Teams meeting event
  storeTeamsMeetingEvent(eventData) {
    const dateKey = ActivityStore.getTodayKey();
    const dayData = this.initDay(dateKey);
    
    // Round to nearest 5 minutes
    const duration = Math.round(eventData.duration / (5 * 60 * 1000)) * 5 * 60 * 1000;
    
    // Add to teams meetings list
    dayData.allWatcherEvents['teams-meetings'].push({
      title: eventData.title,
      startTime: eventData.startTime,
      endTime: eventData.endTime,
      duration: duration
    });
    
    // Update day summary
    this.updateDaySummary(dateKey);
    
    return true;
  }
  
  // Calculate primary windows for 15-minute periods
  calculatePrimaryWindows(dateKey) {
    const dayData = this.days[dateKey];
    if (!dayData) return;
    
    const allWindows = dayData.allWatcherEvents['active-window'].allActiveWindows;
    const periodLength = 15 * 60 * 1000; // 15 minutes in ms
    const primaryWindows = [];
    
    // Group windows by 15-minute periods
    const periods = {};
    
    for (const window of allWindows) {
      const timestamp = window.timestamp;
      const periodStart = Math.floor(timestamp / periodLength) * periodLength;
      
      if (!periods[periodStart]) {
        periods[periodStart] = [];
      }
      
      periods[periodStart].push(window);
    }
    
    // Find most frequent window in each period
    for (const [periodStart, windows] of Object.entries(periods)) {
      const periodEnd = parseInt(periodStart) + periodLength;
      
      // Count app+title combinations
      const counts = {};
      for (const window of windows) {
        const key = `${window.appName}|${window.title}`;
        counts[key] = (counts[key] || 0) + 1;
      }
      
      // Find the most frequent
      let maxCount = 0;
      let primaryWindow = null;
      
      for (const [key, count] of Object.entries(counts)) {
        if (count > maxCount) {
          maxCount = count;
          const [appName, title] = key.split('|');
          primaryWindow = { appName, title };
        }
      }
      
      if (primaryWindow) {
        primaryWindows.push({
          start: parseInt(periodStart),
          end: periodEnd,
          duration: periodLength,
          type: 'primaryWindow',
          title: primaryWindow.appName,
          subTitle: primaryWindow.title
        });
      }
    }
    
    // Combine consecutive identical windows
    const combinedWindows = [];
    let current = null;
    
    for (const window of primaryWindows.sort((a, b) => a.start - b.start)) {
      if (!current) {
        current = { ...window };
      } else if (current.title === window.title && current.subTitle === window.subTitle && current.end === window.start) {
        // Extend the current window
        current.end = window.end;
        current.duration += window.duration;
      } else {
        // Save the current window and start a new one
        combinedWindows.push(current);
        current = { ...window };
      }
    }
    
    if (current) {
      combinedWindows.push(current);
    }
    
    // Update primary windows
    dayData.allWatcherEvents['active-window'].primaryWindows = combinedWindows;
  }
  
  // Update the day summary by combining all watcher events
  updateDaySummary(dateKey) {
    const dayData = this.days[dateKey];
    if (!dayData) return;
    
    // Get all events from different watchers
    const primaryWindows = dayData.allWatcherEvents['active-window'].primaryWindows || [];
    const inactivityEvents = dayData.allWatcherEvents['inactivity'] || [];
    const teamsMeetings = dayData.allWatcherEvents['teams-meetings'] || [];
    
    // Convert inactivity events to timeline format
    const inactivityTimeline = inactivityEvents.map(event => ({
      start: event.timestamp,
      end: event.timestamp + event.duration,
      duration: event.duration,
      type: 'inactive'
    }));
    
    // Convert teams meetings to timeline format
    const meetingsTimeline = teamsMeetings.map(event => ({
      start: event.startTime,
      end: event.endTime,
      duration: event.duration,
      type: 'teams_meeting',
      title: event.title
    }));
    
    // Combine all events
    let allEvents = [
      ...primaryWindows,
      ...inactivityTimeline,
      ...meetingsTimeline
    ].sort((a, b) => a.start - b.start);
    
    // Prioritize events: Teams > Inactivity > Active Window
    const prioritizedEvents = [];
    
    for (const event of allEvents) {
      // Find overlapping events with higher priority
      const highPriorityOverlaps = prioritizedEvents.filter(e => {
        return (
          ((e.start <= event.start && e.end > event.start) || // Event starts during existing
           (e.start < event.end && e.end >= event.end) || // Event ends during existing
           (event.start <= e.start && event.end >= e.end)) && // Event completely contains existing
          ((e.type === 'teams_meeting') || // Teams meeting has highest priority
           (e.type === 'inactive' && event.type === 'primaryWindow')) // Inactivity over active window
        );
      });
      
      if (highPriorityOverlaps.length === 0) {
        // No higher priority events overlap, add this one
        prioritizedEvents.push(event);
      } else {
        // Check if we need to add a truncated version of this event
        for (const overlap of highPriorityOverlaps) {
          if (event.start < overlap.start) {
            // Add the part before overlap
            prioritizedEvents.push({
              ...event,
              end: overlap.start,
              duration: overlap.start - event.start
            });
          }
          
          if (event.end > overlap.end) {
            // Add the part after overlap
            prioritizedEvents.push({
              ...event,
              start: overlap.end,
              duration: event.end - overlap.end
            });
          }
        }
      }
    }
    
    // Sort and clean up events
    const daySummary = prioritizedEvents
      .sort((a, b) => a.start - b.start)
      .filter(e => e.duration > 0);
    
    // Calculate total active and inactive time
    let totalActive = 0;
    let totalInactive = 0;
    
    for (const event of daySummary) {
      if (event.type === 'inactive') {
        totalInactive += event.duration;
      } else {
        totalActive += event.duration;
      }
    }
    
    // Update day data
    dayData.daySummary = daySummary;
    dayData.totalActiveDuration = totalActive;
    dayData.totalInactiveDuration = totalInactive;
    dayData.activeTrackingDuration = totalActive + totalInactive;
  }
  
  // Get activity data for a specific date
  getActivityData(dateKey) {
    if (!dateKey) {
      dateKey = ActivityStore.getTodayKey();
    }
    
    // Initialize day if it doesn't exist
    this.initDay(dateKey);
    
    return this.days[dateKey];
  }
  
  // Clean up data older than 30 days
  cleanup() {
    const now = Date.now();
    const thirtyDaysInMs = 30 * 24 * 60 * 60 * 1000;
    const cutoff = now - thirtyDaysInMs;
    
    for (const dateKey in this.days) {
      const date = new Date(dateKey + 'T00:00:00Z');
      if (date.getTime() < cutoff) {
        delete this.days[dateKey];
      }
    }
    
    this.lastCleanup = now;
    this.save();
  }
  
  // Clean up resources
  dispose() {
    clearInterval(this.autoSaveInterval);
    clearInterval(this.cleanupInterval);
    this.save();
  }
}

module.exports = ActivityStore; 