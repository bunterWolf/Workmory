// Mock activity data for development
const mockData = {
  version: 1,
  startTime: Date.now(),
  lastCleanup: Date.now(),
  days: {
    // Today's data
    [getTodayKey()]: {
      activeTrackingDuration: 28800000, // 8 hours
      totalActiveDuration: 25200000, // 7 hours
      totalInactiveDuration: 3600000, // 1 hour
      daySummary: [
        {
          start: setTime(9, 0),
          end: setTime(10, 30),
          duration: 5400000, // 1.5 hours
          type: 'primaryWindow',
          title: 'VS Code',
          subTitle: 'Focus Project' 
        },
        {
          start: setTime(10, 30),
          end: setTime(11, 0),
          duration: 1800000, // 30 minutes
          type: 'teams_meeting',
          title: 'Daily Standup'
        },
        {
          start: setTime(11, 0),
          end: setTime(12, 30),
          duration: 5400000, // 1.5 hours
          type: 'primaryWindow',
          title: 'Chrome',
          subTitle: 'Research'
        },
        {
          start: setTime(12, 30),
          end: setTime(13, 30),
          duration: 3600000, // 1 hour
          type: 'inactive'
        },
        {
          start: setTime(13, 30),
          end: setTime(15, 0),
          duration: 5400000, // 1.5 hours
          type: 'primaryWindow',
          title: 'VS Code',
          subTitle: 'Focus Project'
        },
        {
          start: setTime(15, 0),
          end: setTime(16, 0),
          duration: 3600000, // 1 hour
          type: 'teams_meeting',
          title: 'Project Planning'
        },
        {
          start: setTime(16, 0),
          end: setTime(17, 0),
          duration: 3600000, // 1 hour
          type: 'primaryWindow',
          title: 'VS Code',
          subTitle: 'Focus Project'
        }
      ],
      allWatcherEvents: {
        'active-window': {
          primaryWindows: [], // This would be populated from the daySummary data
          allActiveWindows: [] // This would contain all window samples
        },
        'inactivity': [
          {
            timestamp: setTime(12, 30),
            duration: 3600000
          }
        ],
        'teams-meetings': [
          {
            title: 'Daily Standup',
            startTime: setTime(10, 30),
            endTime: setTime(11, 0),
            duration: 1800000
          },
          {
            title: 'Project Planning',
            startTime: setTime(15, 0),
            endTime: setTime(16, 0),
            duration: 3600000
          }
        ]
      }
    },
    // Yesterday's data
    [getYesterdayKey()]: {
      activeTrackingDuration: 28800000, // 8 hours
      totalActiveDuration: 21600000, // 6 hours
      totalInactiveDuration: 7200000, // 2 hours
      daySummary: [
        {
          start: setTime(9, 0),
          end: setTime(11, 0),
          duration: 7200000, // 2 hours
          type: 'primaryWindow',
          title: 'Figma',
          subTitle: 'UI Design'
        },
        {
          start: setTime(11, 0),
          end: setTime(12, 0),
          duration: 3600000, // 1 hour
          type: 'teams_meeting',
          title: 'Client Meeting'
        },
        {
          start: setTime(12, 0),
          end: setTime(13, 0),
          duration: 3600000, // 1 hour
          type: 'inactive'
        },
        {
          start: setTime(13, 0),
          end: setTime(14, 0),
          duration: 3600000, // 1 hour
          type: 'primaryWindow',
          title: 'Chrome',
          subTitle: 'Documentation'
        },
        {
          start: setTime(14, 0),
          end: setTime(16, 0),
          duration: 7200000, // 2 hours
          type: 'primaryWindow',
          title: 'VS Code',
          subTitle: 'API Implementation'
        },
        {
          start: setTime(16, 0),
          end: setTime(17, 0),
          duration: 3600000, // 1 hour
          type: 'inactive'
        }
      ],
      allWatcherEvents: {
        'active-window': {
          primaryWindows: [],
          allActiveWindows: []
        },
        'inactivity': [
          {
            timestamp: setTime(12, 0),
            duration: 3600000
          },
          {
            timestamp: setTime(16, 0),
            duration: 3600000
          }
        ],
        'teams-meetings': [
          {
            title: 'Client Meeting',
            startTime: setTime(11, 0),
            endTime: setTime(12, 0),
            duration: 3600000
          }
        ]
      }
    }
  }
};

// Helper function to get today's date in YYYY-MM-DD format
function getTodayKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

// Helper function to get yesterday's date in YYYY-MM-DD format
function getYesterdayKey() {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;
}

// Helper function to set time for today
function setTime(hours, minutes) {
  const date = new Date();
  date.setHours(hours, minutes, 0, 0);
  return date.getTime();
}

module.exports = mockData; 