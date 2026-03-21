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
  // Teams context labels (not meeting names)
  'persönlich', 'personal',
  // Teams UI mode descriptors (not meeting names)
  'kompakte besprechungsansicht', 'compact meeting view',
]);

/** Returns true if a window title segment looks like an email address. */
function isEmailAddress(segment: string): boolean {
  return segment.includes('@');
}

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
  private cachedUdpCount: number = 0;
  private udpCacheTimestamp: number = 0;
  private readonly UDP_CACHE_TTL_MS = 5000; // Re-query PowerShell at most every 5 seconds

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

  /** Returns the raw UDP endpoint count for all Teams processes (Windows only).
   *  Result is cached for UDP_CACHE_TTL_MS to avoid spawning PowerShell too frequently. */
  getUdpCount(): number {
    if (this.platform !== 'win32') return -1;
    const now = Date.now();
    if (now - this.udpCacheTimestamp < this.UDP_CACHE_TTL_MS) {
      return this.cachedUdpCount;
    }
    try {
      const output = execSync(
        "powershell -NoProfile -Command \"$pids = (Get-Process -Name '*teams*' -ErrorAction SilentlyContinue).Id; (Get-NetUDPEndpoint -ErrorAction SilentlyContinue | Where-Object { $_.OwningProcess -in $pids }).Count\"",
        { timeout: 3000, encoding: 'utf8' }
      ).trim();
      const count = parseInt(output, 10);
      this.cachedUdpCount = isNaN(count) ? 0 : count;
    } catch {
      this.cachedUdpCount = -1;
    }
    this.udpCacheTimestamp = now;
    return this.cachedUdpCount;
  }

  private hasActiveUdpConnections(): boolean {
    const count = this.getUdpCount();
    // During a meeting Teams binds many UDP ports (WebRTC). Threshold set to >10 to avoid false positives.
    return count > 5;
  }

  private getMeetingTitleWindows(): string | null {
    try {
      const output = execSync(
        "powershell -NoProfile -Command \"Get-Process | Where-Object Name -like '*teams*' | Where-Object MainWindowTitle -like '*| Microsoft Teams' | Select-Object -ExpandProperty MainWindowTitle\"",
        { timeout: 3000, encoding: 'utf8' }
      ).trim();

      if (!output) return null;

      for (const line of output.split('\n')) {
        const stripped = line.replace(/\s*\|\s*Microsoft Teams\s*$/, '').trim();
        if (!stripped) continue;
        // Split into segments and check right-to-left.
        // Handles "Kompakte Besprechungsansicht | Meeting Name" → returns "Meeting Name".
        const segments = stripped.split('|').map(s => s.trim()).reverse();
        let skipNext = false;
        for (const segment of segments) {
          if (skipNext) { skipNext = false; continue; }
          if (isEmailAddress(segment)) { skipNext = true; continue; }
          if (segment && !TEAMS_NAV_TITLES.has(segment.toLowerCase())) {
            return segment;
          }
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
        const stripped = t.replace(/\s*\|\s*Microsoft Teams\s*$/, '').trim();
        if (!stripped) continue;
        // Split into segments and check right-to-left.
        const segments = stripped.split('|').map(s => s.trim()).reverse();
        let skipNext = false;
        for (const segment of segments) {
          if (skipNext) { skipNext = false; continue; }
          if (isEmailAddress(segment)) { skipNext = true; continue; }
          if (segment && !TEAMS_NAV_TITLES.has(segment.toLowerCase())) {
            return { title: segment };
          }
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
