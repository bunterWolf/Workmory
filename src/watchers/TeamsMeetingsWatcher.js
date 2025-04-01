const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);
const path = require('path');
const fs = require('fs');
const os = require('os');

/**
 * Watcher module that detects Microsoft Teams meetings
 */
class TeamsMeetingsWatcher {
  constructor() {
    this.isInMeeting = false;
    this.meetingInfo = null;
    this.pollInterval = null;
    this.platform = os.platform();
  }

  /**
   * Initialize the watcher
   */
  init() {
    // Start the polling mechanism
    return this.startPolling()
      .then(() => {
        console.log('TeamsMeetingsWatcher initialized');
        return Promise.resolve();
      })
      .catch(error => {
        console.error('Error initializing TeamsMeetingsWatcher:', error);
        return Promise.reject(error);
      });
  }

  /**
   * Start polling for Teams meeting status
   */
  startPolling() {
    // Clear any existing interval
    this.stopPolling();

    // Poll every 15 seconds
    this.pollInterval = setInterval(() => {
      this.checkTeamsMeetingStatus();
    }, 15000);

    // Perform an immediate check
    return this.checkTeamsMeetingStatus();
  }

  /**
   * Stop polling for Teams meeting status
   */
  stopPolling() {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  }

  /**
   * Check if user is currently in a Teams meeting
   * @returns {Promise<void>}
   */
  async checkTeamsMeetingStatus() {
    try {
      // Different approaches based on OS
      if (this.platform === 'darwin') {
        await this.checkTeamsMeetingMacOS();
      } else if (this.platform === 'win32') {
        await this.checkTeamsMeetingWindows();
      } else {
        // Default to no meeting for unsupported platforms
        this.isInMeeting = false;
        this.meetingInfo = null;
      }
    } catch (error) {
      console.error('Error checking Teams meeting status:', error);
      // In case of error, assume no meeting
      this.isInMeeting = false;
      this.meetingInfo = null;
    }
  }

  /**
   * Check Teams meeting status on macOS
   * @returns {Promise<void>}
   */
  async checkTeamsMeetingMacOS() {
    try {
      // Check if Teams is running
      const { stdout: psOutput } = await execAsync('ps -ax | grep "Microsoft Teams" | grep -v grep');
      
      if (!psOutput || psOutput.trim() === '') {
        this.isInMeeting = false;
        this.meetingInfo = null;
        return;
      }
      
      // Check for meeting indicators in Teams process or logs
      const { stdout: logOutput } = await execAsync('defaults read com.microsoft.teams | grep "meetingState" | grep -v grep');
      
      if (logOutput && logOutput.includes('inMeeting')) {
        // Extract meeting title from Teams app if possible
        const { stdout: titleOutput } = await execAsync('defaults read com.microsoft.teams | grep "meetingTitle" | grep -v grep');
        
        this.isInMeeting = true;
        this.meetingInfo = {
          title: titleOutput ? this.extractMeetingTitle(titleOutput) : 'Teams Meeting',
          status: 'active'
        };
      } else {
        this.isInMeeting = false;
        this.meetingInfo = null;
      }
    } catch (error) {
      // If error occurs, assume no meeting
      this.isInMeeting = false;
      this.meetingInfo = null;
    }
  }
  
  /**
   * Extract meeting title from output string
   * @param {string} output 
   * @returns {string}
   */
  extractMeetingTitle(output) {
    const match = output.match(/"([^"]+)"/);
    return match ? match[1] : 'Teams Meeting';
  }

  /**
   * Check Teams meeting status on Windows
   * @returns {Promise<void>}
   */
  async checkTeamsMeetingWindows() {
    try {
      // Check if Teams is running
      const { stdout: tasksOutput } = await execAsync('tasklist /FI "IMAGENAME eq Teams.exe" /NH');
      
      if (!tasksOutput || !tasksOutput.includes('Teams.exe')) {
        this.isInMeeting = false;
        this.meetingInfo = null;
        return;
      }
      
      // Check Teams logs for meeting indicators
      const appDataPath = process.env.APPDATA;
      const teamsLogsPath = path.join(appDataPath, 'Microsoft', 'Teams', 'logs.txt');
      
      if (fs.existsSync(teamsLogsPath)) {
        // Read last 1000 bytes of log file to check for recent meeting activity
        const fileBuffer = fs.readFileSync(teamsLogsPath);
        const logTail = fileBuffer.slice(Math.max(0, fileBuffer.length - 1000)).toString();
        
        if (logTail.includes('meetingStateChanged') && logTail.includes('isInMeeting: true')) {
          // Try to extract meeting title
          const titleMatch = logTail.match(/meetingTitle: "([^"]+)"/);
          
          this.isInMeeting = true;
          this.meetingInfo = {
            title: titleMatch ? titleMatch[1] : 'Teams Meeting',
            status: 'active'
          };
        } else {
          this.isInMeeting = false;
          this.meetingInfo = null;
        }
      } else {
        this.isInMeeting = false;
        this.meetingInfo = null;
      }
    } catch (error) {
      // If error occurs, assume no meeting
      this.isInMeeting = false;
      this.meetingInfo = null;
    }
  }

  /**
   * Get data for the heartbeat
   * @returns {Promise<{teamsMeeting: false | {title: string, status: string}}>}
   */
  async getHeartbeatData() {
    // Refresh status before returning data
    await this.checkTeamsMeetingStatus();
    
    return {
      teamsMeeting: this.isInMeeting ? this.meetingInfo : false
    };
  }

  /**
   * Clean up resources used by the watcher
   */
  cleanup() {
    this.stopPolling();
    this.isInMeeting = false;
    this.meetingInfo = null;
  }
}

module.exports = TeamsMeetingsWatcher; 