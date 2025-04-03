/**
 * Mock data for development and testing
 * Provides sample data for the current and previous day
 */

const generateMockData = () => {
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);

  // Format dates as YYYY-MM-DD
  const todayKey = formatDate(now);
  const yesterdayKey = formatDate(yesterday);

  // Generate activity data for both days
  return {
    version: 1,
    startTime: yesterday.getTime() - (8 * 60 * 60 * 1000), // 8 hours before yesterday
    lastCleanup: now.getTime() - (24 * 60 * 60 * 1000),    // 24 hours ago
    days: {
      [yesterdayKey]: generateMockDay(yesterday),
      [todayKey]: generateMockDay(now)
    }
  };
};

/**
 * Format date as YYYY-MM-DD
 * @param {Date} date - Date to format
 * @returns {string} Formatted date
 */
const formatDate = (date) => {
  return date.toISOString().split('T')[0];
};

/**
 * Generate mock data for a single day
 * @param {Date} date - Date to generate data for
 * @returns {Object} Day data with heartbeats and aggregated information
 */
const generateMockDay = (date) => {
  // Create a starting time at 8:00 AM on the given date
  const startOfDay = new Date(date);
  startOfDay.setHours(8, 0, 0, 0);
  
  // Create heartbeats from 8:00 AM to 5:00 PM
  const heartbeats = generateMockHeartbeats(startOfDay);

  // Generate timeline events
  const timelineEvents = generateMockTimelineEvents(startOfDay);
  
  // Create summary data
  const summary = {
    activeTrackingDuration: 9 * 60 * 60 * 1000, // 9 hours
    totalActiveDuration: 7 * 60 * 60 * 1000,    // 7 hours
    totalInactiveDuration: 1 * 60 * 60 * 1000,  // 1 hour
    totalMeetingDuration: 1 * 60 * 60 * 1000    // 1 hour
  };

  return {
    heartbeats,
    aggregated: {
      summary,
      timelineOverview: timelineEvents
    }
  };
};

/**
 * Generate mock heartbeats for a day
 * @param {Date} startTime - Start time for heartbeats
 * @returns {Array} Array of heartbeat objects
 */
const generateMockHeartbeats = (startTime) => {
  const heartbeats = [];
  const endTime = new Date(startTime);
  endTime.setHours(17, 0, 0, 0); // 5:00 PM
  
  // Generate a heartbeat every 30 seconds
  for (let time = startTime.getTime(); time <= endTime.getTime(); time += 30000) {
    heartbeats.push(generateMockHeartbeat(time));
  }
  
  return heartbeats;
};

/**
 * Generate a mock heartbeat
 * @param {number} timestamp - Timestamp for the heartbeat
 * @returns {Object} Heartbeat object
 */
const generateMockHeartbeat = (timestamp) => {
  const date = new Date(timestamp);
  const hour = date.getHours();
  const minute = date.getMinutes();
  
  // Determine activity based on time
  let data = {};
  
  // Teams meeting from 10:00-11:00
  if (hour === 10) {
    data = {
      teamsMeeting: {
        title: 'Daily Standup',
        status: 'active'
      },
      userActivity: 'active',
      appWindow: {
        app: 'Microsoft Teams',
        title: 'Daily Standup | Microsoft Teams'
      }
    };
  }
  // Lunch break / inactive from 12:00-13:00
  else if (hour === 12) {
    data = {
      teamsMeeting: false,
      userActivity: 'inactive',
      appWindow: {
        app: 'Chrome',
        title: 'YouTube'
      }
    };
  }
  // Coding in the morning
  else if (hour < 12) {
    data = {
      teamsMeeting: false,
      userActivity: 'active',
      appWindow: {
        app: 'VS Code',
        title: 'ActivityStore.js - Focus2'
      }
    };
  }
  // Emails in the afternoon
  else if (hour >= 14 && hour < 16) {
    data = {
      teamsMeeting: false,
      userActivity: 'active',
      appWindow: {
        app: 'Outlook',
        title: 'Inbox - username@example.com'
      }
    };
  }
  // End of day documentation
  else {
    data = {
      teamsMeeting: false,
      userActivity: 'active',
      appWindow: {
        app: 'Word',
        title: 'Project Documentation - Word'
      }
    };
  }
  
  return {
    timestamp,
    data
  };
};

/**
 * Generate mock timeline events
 * @param {Date} startTime - Start time for timeline
 * @returns {Array} Array of timeline event objects
 */
const generateMockTimelineEvents = (startTime) => {
  const events = [];
  const endTime = new Date(startTime);
  endTime.setHours(17, 0, 0, 0); // 5:00 PM
  
  // VS Code from 8:00-10:00
  events.push({
    timestamp: new Date(startTime).setHours(8, 0, 0, 0),
    duration: 2 * 60 * 60 * 1000,
    type: 'appWindow',
    data: {
      app: 'VS Code',
      title: 'ActivityStore.js - Focus2'
    }
  });
  
  // Teams meeting from 10:00-11:00
  events.push({
    timestamp: new Date(startTime).setHours(10, 0, 0, 0),
    duration: 1 * 60 * 60 * 1000,
    type: 'teamsMeeting',
    data: {
      title: 'Daily Standup',
      status: 'active'
    }
  });
  
  // VS Code from 11:00-12:00
  events.push({
    timestamp: new Date(startTime).setHours(11, 0, 0, 0),
    duration: 1 * 60 * 60 * 1000,
    type: 'appWindow',
    data: {
      app: 'VS Code',
      title: 'ActivityStore.js - Focus2'
    }
  });
  
  // Inactive from 12:00-13:00
  events.push({
    timestamp: new Date(startTime).setHours(12, 0, 0, 0),
    duration: 1 * 60 * 60 * 1000,
    type: 'inactive',
    data: {
      reason: 'User inactive'
    }
  });
  
  // Outlook from 13:00-16:00
  events.push({
    timestamp: new Date(startTime).setHours(13, 0, 0, 0),
    duration: 3 * 60 * 60 * 1000,
    type: 'appWindow',
    data: {
      app: 'Outlook',
      title: 'Inbox - username@example.com'
    }
  });
  
  // Word from 16:00-17:00
  events.push({
    timestamp: new Date(startTime).setHours(16, 0, 0, 0),
    duration: 1 * 60 * 60 * 1000,
    type: 'appWindow',
    data: {
      app: 'Word',
      title: 'Project Documentation - Word'
    }
  });
  
  return events;
};

module.exports = {
  generateMockData
}; 