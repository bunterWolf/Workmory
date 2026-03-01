import { execSync } from 'child_process';
import os from 'os';
import { HeartbeatData } from '../store/ActivityStore';

interface MeetingInfo {
  title: string;
}

/**
 * Detects active Microsoft Teams meetings via the process window title.
 * Teams sets MainWindowTitle to "<Meeting Title> | Microsoft Teams" during a call.
 */
export default class TeamsMeetingsWatcher {
  private platform = os.platform();

  async init(): Promise<void> {
    console.log('TeamsMeetingsWatcher initialized.');
  }

  async getHeartbeatData(): Promise<Partial<HeartbeatData>> {
    return { teamsMeeting: this.detectMeeting() };
  }

  private detectMeeting(): MeetingInfo | null {
    if (this.platform === 'win32') {
      return this.detectOnWindows();
    }
    if (this.platform === 'darwin') {
      return this.detectOnMac();
    }
    return null;
  }

  private detectOnWindows(): MeetingInfo | null {
    try {
      const output = execSync(
        "powershell -NoProfile -Command \"Get-Process | Where-Object Name -like '*teams*' | Where-Object MainWindowTitle -like '*| Microsoft Teams' | Select-Object -ExpandProperty MainWindowTitle -First 1\"",
        { timeout: 3000, encoding: 'utf8' }
      ).trim();

      if (!output) return null;

      const title = output.replace(/\s*\|\s*Microsoft Teams\s*$/, '').trim();
      return title ? { title } : null;
    } catch {
      return null;
    }
  }

  private detectOnMac(): MeetingInfo | null {
    try {
      const output = execSync(
        `osascript -e 'tell application "System Events" to tell process "Microsoft Teams" to get name of windows'`,
        { timeout: 3000, encoding: 'utf8' }
      ).trim();

      if (!output) return null;

      const meetingTitle = output
        .split(', ')
        .find(t => t.includes('| Microsoft Teams'));

      if (!meetingTitle) return null;

      const title = meetingTitle.replace(/\s*\|\s*Microsoft Teams\s*$/, '').trim();
      return title ? { title } : null;
    } catch {
      return null;
    }
  }

  cleanup(): void {
    // Nothing to clean up
  }
}
