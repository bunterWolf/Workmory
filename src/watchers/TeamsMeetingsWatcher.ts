import { execSync } from 'child_process';
import os from 'os';
import { HeartbeatData } from '../store/ActivityStore';

interface MeetingInfo {
  title: string;
}

// Teams navigation tab titles are not meetings
const TEAMS_NAV_TITLES = [
  'microsoft teams', 'aktivitäten', 'activity',
  'chat', 'teams', 'besprechungen', 'calendar', 'meetings',
  'anrufe', 'calls', 'dateien', 'files',
];

/**
 * Detects active Microsoft Teams meetings.
 *
 * Primary signal: microphone registry (LastUsedTimeStop = 0 → mic active → in call).
 * Secondary signal: process window title for the meeting name.
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
    if (!this.isMicrophoneActive()) return null;
    return { title: this.getMeetingTitleWindows() ?? 'Teams Meeting' };
  }

  private isMicrophoneActive(): boolean {
    try {
      const output = execSync(
        'reg query "HKCU\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\CapabilityAccessManager\\ConsentStore\\microphone\\MSTeams_8wekyb3d8bbwe" /v LastUsedTimeStop',
        { timeout: 2000, encoding: 'utf8' }
      );
      // LastUsedTimeStop = 0x0 means mic is currently in use
      return output.includes('0x0');
    } catch {
      return false;
    }
  }

  private getMeetingTitleWindows(): string | null {
    try {
      const output = execSync(
        "powershell -NoProfile -Command \"Get-Process | Where-Object Name -like '*teams*' | Where-Object MainWindowTitle -like '*| Microsoft Teams' | Select-Object -ExpandProperty MainWindowTitle\"",
        { timeout: 3000, encoding: 'utf8' }
      ).trim();

      if (!output) return null;

      for (const line of output.split('\n')) {
        const title = line.replace(/\s*\|\s*Microsoft Teams\s*$/, '').trim();
        if (title && !TEAMS_NAV_TITLES.includes(title.toLowerCase())) {
          return title;
        }
      }
      return null;
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

      for (const t of output.split(', ')) {
        if (!t.includes('| Microsoft Teams')) continue;
        const title = t.replace(/\s*\|\s*Microsoft Teams\s*$/, '').trim();
        if (title && !TEAMS_NAV_TITLES.includes(title.toLowerCase())) {
          return { title };
        }
      }
      return null;
    } catch {
      return null;
    }
  }

  cleanup(): void {
    // Nothing to clean up
  }
}
