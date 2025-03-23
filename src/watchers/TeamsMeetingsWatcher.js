const activeWin = require('active-win');

class TeamsMeetingsWatcher {
  constructor(activityStore) {
    this.activityStore = activityStore;
    this.interval = null;
    this.checkInterval = 30000; // 30 seconds
    this.meetingThreshold = 5 * 60 * 1000; // 5 minutes
    this.activeMeeting = null;
  }
  
  // Start monitoring Teams meetings
  start() {
    if (this.interval) return;
    
    this.interval = setInterval(async () => {
      try {
        await this.checkForTeamsMeeting();
      } catch (error) {
        console.error('Error checking for Teams meeting:', error);
      }
    }, this.checkInterval);
  }
  
  // Stop monitoring Teams meetings
  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
      
      // Record any ongoing meeting
      if (this.activeMeeting) {
        this.endMeeting();
      }
    }
  }
  
  // Check for an active Teams meeting
  async checkForTeamsMeeting() {
    try {
      const activeWindow = await activeWin();
      
      if (!activeWindow) return;
      
      const isTeams = this.isTeamsWindow(activeWindow);
      const isInMeeting = this.isInMeeting(activeWindow);
      const meetingTitle = this.extractMeetingTitle(activeWindow);
      
      if (isTeams && isInMeeting) {
        // Teams meeting is active
        if (!this.activeMeeting) {
          // Start of a new meeting
          this.startMeeting(meetingTitle);
        } else if (this.activeMeeting.title !== meetingTitle) {
          // Changed to a different meeting
          this.endMeeting();
          this.startMeeting(meetingTitle);
        }
      } else if (this.activeMeeting) {
        // Check if we should end the meeting or just temporarily out of Teams
        if (this.timeSinceLastUpdate() > 2 * 60 * 1000) { // 2 minutes
          this.endMeeting();
        }
      }
    } catch (error) {
      console.error('Failed to check for Teams meeting:', error);
    }
  }
  
  // Start tracking a new meeting
  startMeeting(title) {
    this.activeMeeting = {
      title: title || 'Unnamed Meeting',
      startTime: Date.now(),
      lastUpdate: Date.now()
    };
  }
  
  // End tracking for the current meeting
  endMeeting() {
    if (!this.activeMeeting) return;
    
    const endTime = Date.now();
    const duration = endTime - this.activeMeeting.startTime;
    
    // Only record meetings that exceed the threshold
    if (duration >= this.meetingThreshold) {
      this.activityStore.storeTeamsMeetingEvent({
        title: this.activeMeeting.title,
        startTime: this.activeMeeting.startTime,
        endTime: endTime,
        duration: duration
      });
    }
    
    this.activeMeeting = null;
  }
  
  // Check how long since the meeting was last updated
  timeSinceLastUpdate() {
    if (!this.activeMeeting) return Infinity;
    return Date.now() - this.activeMeeting.lastUpdate;
  }
  
  // Update the last seen time for the active meeting
  updateMeeting() {
    if (this.activeMeeting) {
      this.activeMeeting.lastUpdate = Date.now();
    }
  }
  
  // Check if the window is Microsoft Teams
  isTeamsWindow(window) {
    const title = window.title || '';
    const owner = window.owner?.name || '';
    return owner.toLowerCase().includes('teams') || title.toLowerCase().includes('microsoft teams');
  }
  
  // Check if the Teams window indicates an active meeting
  isInMeeting(window) {
    const title = window.title || '';
    return title.includes('| Meeting') || 
           title.includes('| Call') || 
           title.includes('- Meeting') ||
           title.match(/\[\d+\]/g); // Participant count indicator
  }
  
  // Extract the meeting title from the window title
  extractMeetingTitle(window) {
    const title = window.title || '';
    
    // Try different patterns to extract meeting name
    const patterns = [
      /(.+?)(?:\s*\|\s*Meeting)/i,
      /(.+?)(?:\s*\|\s*Call)/i,
      /(.+?)(?:\s*\-\s*Meeting)/i,
      /(.+?)(?:\s*\[\d+\])/i
    ];
    
    for (const pattern of patterns) {
      const match = title.match(pattern);
      if (match && match[1]) {
        return match[1].trim();
      }
    }
    
    return 'Teams Meeting';
  }
}

module.exports = TeamsMeetingsWatcher; 