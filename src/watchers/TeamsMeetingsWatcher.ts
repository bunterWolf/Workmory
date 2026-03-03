import { execSync } from 'child_process';
import os from 'os';
import { HeartbeatData } from '../store/ActivityStore';

interface MeetingInfo {
  title: string;
}

// Known Teams navigation tab titles (DE + EN) — used only to improve title quality,
// not for meeting detection (which relies on UDP connections).
const TEAMS_NAV_TITLES = new Set([
  'chat',
  'besprechungen', 'meetings',
  'kontakte', 'contacts', 'personen', 'people',
  'communitys', 'communities', 'community',
  'kalender', 'calendar',
  'aktivität', 'aktivitäten', 'activity',
  'dateien', 'files',
  'anrufe', 'calls',
  'teams', 'microsoft teams',
]);

/**
 * Detects active Microsoft Teams meetings.
 *
 * Primary signal: UDP connections (Teams binds multiple UDP ports during a call via WebRTC,
 * regardless of mute status. Outside of a call only 1 background socket exists).
 * Secondary signal: process window title for the meeting name.
 *
 * Title filtering: navigation paths containing '|' (e.g. "Kalender | Einstellungen") and
 * known nav tab names (e.g. "Chat", "Kalender") are excluded — the UDP check ensures
 * correct meeting detection regardless.
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
    if (!this.hasActiveUdpConnections()) return null;
    return { title: this.getMeetingTitleWindows() ?? 'Teams Meeting' };
  }

  private hasActiveUdpConnections(): boolean {
    try {
      const output = execSync(
        "powershell -NoProfile -Command \"$pids = (Get-Process -Name '*teams*' -ErrorAction SilentlyContinue).Id; (Get-NetUDPEndpoint -ErrorAction SilentlyContinue | Where-Object { $_.OwningProcess -in $pids }).Count\"",
        { timeout: 3000, encoding: 'utf8' }
      ).trim();
      const count = parseInt(output, 10);
      // During a meeting Teams binds many UDP ports (WebRTC). Outside of a meeting only 1 exists.
      return !isNaN(count) && count > 1;
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
        // Navigation paths contain '|' (e.g. "Kalender | Einstellungen"), meeting titles do not
        if (title && !title.includes('|') && !TEAMS_NAV_TITLES.has(title.toLowerCase())) {
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
        // Navigation paths contain '|', meeting titles do not
        if (title && !title.includes('|') && !TEAMS_NAV_TITLES.has(title.toLowerCase())) {
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
