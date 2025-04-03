/**
 * Handles aggregation of heartbeat data into timeline events
 * Following the rules defined in the spec:
 * - Activities are aggregated in configurable time intervals (5, 10, or 15 minutes)
 * - Activities start/end at fixed times (e.g., XX:00, XX:15, XX:30, XX:45 for 15-min)
 * - Activities require heartbeats for at least half of the interval
 * - Activities are merged when consecutive with same type/content
 */
class TimelineGenerator {
  constructor() {
    // Default interval in minutes - can be 5, 10, or 15
    this.aggregationInterval = 15;
    
    // Interval duration in milliseconds
    this.intervalDuration = this.aggregationInterval * 60 * 1000;
  }
  
  /**
   * Set the aggregation interval
   * @param {number} minutes - The interval size in minutes (5, 10, or 15)
   */
  setAggregationInterval(minutes) {
    if (![5, 10, 15].includes(minutes)) {
      throw new Error('Invalid interval. Must be 5, 10, or 15 minutes.');
    }
    
    this.aggregationInterval = minutes;
    this.intervalDuration = minutes * 60 * 1000;
  }

  /**
   * Generate timeline events from heartbeats for a single day
   * @param {Array} heartbeats - Array of heartbeat objects for a day
   * @param {number} [interval] - Optional interval override in minutes (5, 10, or 15)
   * @returns {Array} Timeline events
   */
  generateTimelineEvents(heartbeats, interval) {
    if (!heartbeats || !Array.isArray(heartbeats) || heartbeats.length === 0) {
      return [];
    }
    
    // Apply temporary interval override if provided
    const originalInterval = this.aggregationInterval;
    
    if (interval && [5, 10, 15].includes(interval)) {
      this.setAggregationInterval(interval);
    }

    // Sort heartbeats by timestamp (ascending)
    heartbeats = [...heartbeats].sort((a, b) => a.timestamp - b.timestamp);

    // Group heartbeats into intervals
    const intervalGroups = this.groupHeartbeatsByInterval(heartbeats);
    
    // Generate activities from interval groups
    const activities = this.generateActivities(intervalGroups);
    
    // Merge consecutive activities with same content
    const result = this.mergeConsecutiveActivities(activities);
    
    // Restore original interval if overridden
    if (interval && interval !== originalInterval) {
      this.setAggregationInterval(originalInterval);
    }
    
    return result;
  }

  /**
   * Group heartbeats into intervals based on current aggregation setting
   * @param {Array} heartbeats - Sorted array of heartbeat objects
   * @returns {Object} Map of interval start timestamps to heartbeats
   */
  groupHeartbeatsByInterval(heartbeats) {
    const intervalGroups = {};

    heartbeats.forEach(heartbeat => {
      // Round down to the nearest interval based on current setting
      const intervalStart = this.roundToNearestInterval(heartbeat.timestamp);
      
      if (!intervalGroups[intervalStart]) {
        intervalGroups[intervalStart] = [];
      }
      
      intervalGroups[intervalStart].push(heartbeat);
    });

    return intervalGroups;
  }

  /**
   * Round timestamp to the nearest interval start time based on current setting
   * @param {number} timestamp - Timestamp in milliseconds
   * @returns {number} Rounded timestamp in milliseconds
   */
  roundToNearestInterval(timestamp) {
    const date = new Date(timestamp);
    const minutes = date.getMinutes();
    const remainder = minutes % this.aggregationInterval;
    
    // Round down to nearest interval
    date.setMinutes(minutes - remainder, 0, 0);
    
    return date.getTime();
  }

  /**
   * Generate activities from interval groups
   * @param {Object} intervalGroups - Map of interval start timestamps to heartbeats
   * @returns {Array} Activities
   */
  generateActivities(intervalGroups) {
    const activities = [];
    const MIN_HEARTBEATS_RATIO = 0.5; // At least half of expected heartbeats must be present

    Object.entries(intervalGroups).forEach(([intervalStart, heartbeats]) => {
      const intervalStartTime = parseInt(intervalStart, 10);
      
      // Calculate expected number of heartbeats in this interval
      // With 30s heartbeats, expect (interval in mins * 2) heartbeats
      const expectedHeartbeats = this.aggregationInterval * 2;
      
      // Only create activity if we have enough heartbeats
      if (heartbeats.length >= expectedHeartbeats * MIN_HEARTBEATS_RATIO) {
        // Determine the dominant activity with its specific data
        const dominantActivity = this.determineDominantActivity(heartbeats);
        
        // Create the activity
        activities.push({
          timestamp: intervalStartTime,
          duration: this.intervalDuration,
          type: dominantActivity.type,
          data: dominantActivity.data
        });
      }
    });

    return activities;
  }

  /**
   * Determine the dominant activity by comparing specific activities with their data
   * @param {Array} heartbeats - Array of heartbeat objects
   * @returns {Object} Object containing dominant type and its associated data
   */
  determineDominantActivity(heartbeats) {
    // Group heartbeats by their specific "fingerprint"
    const activityGroups = {};
    
    heartbeats.forEach(heartbeat => {
      let activityKey;
      let activityData;
      
      if (heartbeat.data.teamsMeeting) {
        // For Teams meetings: combine title and status
        activityKey = `teams:${heartbeat.data.teamsMeeting.title}:${heartbeat.data.teamsMeeting.status}`;
        activityData = {
          type: 'teamsMeeting',
          data: {
            title: heartbeat.data.teamsMeeting.title,
            status: heartbeat.data.teamsMeeting.status
          }
        };
      } else if (heartbeat.data.userActivity === 'inactive') {
        // For inactivity
        activityKey = 'inactive';
        activityData = {
          type: 'inactive',
          data: { reason: 'User inactive' }
        };
      } else if (heartbeat.data.appWindow) {
        // For app windows: combine app and title
        activityKey = `app:${heartbeat.data.appWindow.app}:${heartbeat.data.appWindow.title}`;
        activityData = {
          type: 'appWindow',
          data: {
            app: heartbeat.data.appWindow.app,
            title: heartbeat.data.appWindow.title
          }
        };
      }
      
      if (!activityGroups[activityKey]) {
        activityGroups[activityKey] = {
          count: 0,
          data: activityData
        };
      }
      activityGroups[activityKey].count++;
    });
    
    // Find the most frequent specific activity
    let maxCount = 0;
    let dominantActivity = null;
    
    Object.entries(activityGroups).forEach(([key, group]) => {
      if (group.count > maxCount) {
        maxCount = group.count;
        dominantActivity = group.data;
      }
    });
    
    return dominantActivity || { type: 'appWindow', data: {} };
  }

  /**
   * Merge consecutive activities with same content
   * @param {Array} activities - Array of activity objects
   * @returns {Array} Merged activities
   */
  mergeConsecutiveActivities(activities) {
    if (!activities || activities.length <= 1) {
      return activities;
    }
    
    const result = [];
    let current = activities[0];
    
    for (let i = 1; i < activities.length; i++) {
      const next = activities[i];
      
      // Check if activities are consecutive and have same type and content
      if (current.timestamp + current.duration === next.timestamp && 
          current.type === next.type && 
          this.isSameActivityData(current.data, next.data, current.type)) {
        
        // Merge by extending the duration
        current.duration += next.duration;
      } else {
        // Add the current activity to results and move to next
        result.push(current);
        current = next;
      }
    }
    
    // Add the last activity
    result.push(current);
    
    return result;
  }

  /**
   * Check if activity data objects are equivalent
   * @param {Object} data1 - First activity data
   * @param {Object} data2 - Second activity data
   * @param {string} type - Activity type
   * @returns {boolean} True if data is equivalent
   */
  isSameActivityData(data1, data2, type) {
    if (!data1 || !data2) {
      return false;
    }
    
    switch (type) {
      case 'teamsMeeting':
        return data1.title === data2.title && data1.status === data2.status;
        
      case 'inactive':
        return true; // All inactive periods are considered the same
        
      case 'appWindow':
        return data1.app === data2.app && data1.title === data2.title;
        
      default:
        return false;
    }
  }

  /**
   * Calculate summary statistics from timeline events
   * @param {Array} timelineEvents - Array of timeline events
   * @returns {Object} Summary statistics
   */
  calculateSummary(timelineEvents) {
    const summary = {
      activeTrackingDuration: 0,
      totalActiveDuration: 0,
      totalInactiveDuration: 0,
      totalMeetingDuration: 0
    };
    
    if (!timelineEvents || timelineEvents.length === 0) {
      return summary;
    }
    
    // Calculate total tracking duration (sum of all events)
    timelineEvents.forEach(event => {
      summary.activeTrackingDuration += event.duration;
      
      switch (event.type) {
        case 'teamsMeeting':
          summary.totalMeetingDuration += event.duration;
          summary.totalActiveDuration += event.duration;
          break;
          
        case 'inactive':
          summary.totalInactiveDuration += event.duration;
          break;
          
        case 'appWindow':
          summary.totalActiveDuration += event.duration;
          break;
      }
    });
    
    return summary;
  }
}

module.exports = TimelineGenerator; 