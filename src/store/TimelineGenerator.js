/**
 * Handles aggregation of heartbeat data into timeline events
 * Following the rules defined in the spec:
 * - Activities are aggregated in 15-minute intervals
 * - Activities start/end at fixed times: XX:00, XX:15, XX:30, XX:45
 * - Activities require heartbeats for at least half of the interval
 * - Activities are merged when consecutive with same type/content
 */
class TimelineGenerator {
  /**
   * Generate timeline events from heartbeats for a single day
   * @param {Array} heartbeats - Array of heartbeat objects for a day
   * @returns {Array} Timeline events
   */
  generateTimelineEvents(heartbeats) {
    if (!heartbeats || !Array.isArray(heartbeats) || heartbeats.length === 0) {
      return [];
    }

    // Sort heartbeats by timestamp (ascending)
    heartbeats = [...heartbeats].sort((a, b) => a.timestamp - b.timestamp);

    // Group heartbeats into 15-minute intervals
    const intervalGroups = this.groupHeartbeatsByInterval(heartbeats);
    
    // Generate activities from interval groups
    const activities = this.generateActivities(intervalGroups);
    
    // Merge consecutive activities with same content
    return this.mergeConsecutiveActivities(activities);
  }

  /**
   * Group heartbeats into 15-minute intervals
   * @param {Array} heartbeats - Sorted array of heartbeat objects
   * @returns {Object} Map of interval start timestamps to heartbeats
   */
  groupHeartbeatsByInterval(heartbeats) {
    const intervalGroups = {};

    heartbeats.forEach(heartbeat => {
      // Round down to the nearest 15-minute interval
      const intervalStart = this.roundToNearestInterval(heartbeat.timestamp);
      
      if (!intervalGroups[intervalStart]) {
        intervalGroups[intervalStart] = [];
      }
      
      intervalGroups[intervalStart].push(heartbeat);
    });

    return intervalGroups;
  }

  /**
   * Round timestamp to the nearest 15-minute interval start time
   * @param {number} timestamp - Timestamp in milliseconds
   * @returns {number} Rounded timestamp in milliseconds
   */
  roundToNearestInterval(timestamp) {
    const date = new Date(timestamp);
    const minutes = date.getMinutes();
    const remainder = minutes % 15;
    
    // Round down to nearest 15 minutes
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
    const INTERVAL_DURATION = 15 * 60 * 1000; // 15 minutes in milliseconds
    const MIN_HEARTBEATS_RATIO = 0.5; // At least half of expected heartbeats must be present

    Object.entries(intervalGroups).forEach(([intervalStart, heartbeats]) => {
      const intervalStartTime = parseInt(intervalStart, 10);
      
      // Calculate expected number of heartbeats in this interval
      // With 30s heartbeats, expect 30 heartbeats in 15 min
      const expectedHeartbeats = INTERVAL_DURATION / 30000;
      
      // Only create activity if we have enough heartbeats
      if (heartbeats.length >= expectedHeartbeats * MIN_HEARTBEATS_RATIO) {
        // Determine the dominant activity type
        const activityType = this.determineDominantType(heartbeats);
        
        // Create the activity
        activities.push({
          timestamp: intervalStartTime,
          duration: INTERVAL_DURATION,
          type: activityType,
          data: this.aggregateActivityData(heartbeats, activityType)
        });
      }
    });

    return activities;
  }

  /**
   * Determine the dominant activity type from heartbeats
   * @param {Array} heartbeats - Array of heartbeat objects
   * @returns {string} Dominant activity type
   */
  determineDominantType(heartbeats) {
    const typeCounts = {
      teamsMeeting: 0,
      inactive: 0,
      appWindow: 0
    };

    heartbeats.forEach(heartbeat => {
      if (heartbeat.data.teamsMeeting) {
        typeCounts.teamsMeeting++;
      } else if (heartbeat.data.userActivity === 'inactive') {
        typeCounts.inactive++;
      } else {
        typeCounts.appWindow++;
      }
    });

    // Return the type with the highest count
    if (typeCounts.teamsMeeting >= typeCounts.inactive && 
        typeCounts.teamsMeeting >= typeCounts.appWindow) {
      return 'teamsMeeting';
    } else if (typeCounts.inactive >= typeCounts.appWindow) {
      return 'inactive';
    } else {
      return 'appWindow';
    }
  }

  /**
   * Aggregate activity data from heartbeats
   * @param {Array} heartbeats - Array of heartbeat objects
   * @param {string} activityType - Dominant activity type
   * @returns {Object} Aggregated activity data
   */
  aggregateActivityData(heartbeats, activityType) {
    switch (activityType) {
      case 'teamsMeeting':
        // For meetings, find the most recent meeting info
        const meetingHeartbeats = heartbeats.filter(hb => hb.data.teamsMeeting);
        const latestMeeting = meetingHeartbeats[meetingHeartbeats.length - 1];
        return {
          title: latestMeeting.data.teamsMeeting.title,
          status: latestMeeting.data.teamsMeeting.status
        };
        
      case 'inactive':
        // For inactivity, just return a standard object
        return { reason: 'User inactive' };
        
      case 'appWindow':
        // For app windows, find the most common app and title
        const appCounts = {};
        const titleCounts = {};
        
        heartbeats.forEach(hb => {
          if (hb.data.appWindow) {
            const { app, title } = hb.data.appWindow;
            appCounts[app] = (appCounts[app] || 0) + 1;
            titleCounts[title] = (titleCounts[title] || 0) + 1;
          }
        });
        
        return {
          app: this.getMostFrequent(appCounts),
          title: this.getMostFrequent(titleCounts)
        };
        
      default:
        return {};
    }
  }

  /**
   * Get the most frequent item from a counts object
   * @param {Object} counts - Object mapping items to counts
   * @returns {string} Most frequent item
   */
  getMostFrequent(counts) {
    let maxCount = 0;
    let mostFrequent = '';
    
    Object.entries(counts).forEach(([item, count]) => {
      if (count > maxCount) {
        maxCount = count;
        mostFrequent = item;
      }
    });
    
    return mostFrequent;
  }

  /**
   * Merge consecutive activities with the same content
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