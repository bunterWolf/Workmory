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
    // Mac detection not yet tested — disabled.
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
    return count > 3;
  }

  private getMeetingTitleWindows(): string | null {
    try {
      // Enumerate ALL Teams windows with their TOPMOST flag and foreground status.
      // WS_EX_TOPMOST (0x8) identifies the compact meeting overlay — language-independent.
      // GetForegroundWindow identifies the currently focused window.
      const psScript = [
        'Add-Type @"',
        'using System;using System.Collections.Generic;using System.Runtime.InteropServices;using System.Text;',
        'public class WE {',
        '  public delegate bool EWP(IntPtr h, IntPtr l);',
        '  [DllImport("user32.dll")] public static extern bool EnumWindows(EWP e, IntPtr l);',
        '  [DllImport("user32.dll")] public static extern int GetWindowText(IntPtr h, StringBuilder s, int n);',
        '  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, out uint p);',
        '  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr h);',
        '  [DllImport("user32.dll")] public static extern int GetWindowLong(IntPtr h, int i);',
        '  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();',
        '  const int GWL_EXSTYLE = -20; const int WS_EX_TOPMOST = 8;',
        '  public static List<string> Titles(int[] pids, string[] fgOut) {',
        '    var r=new List<string>(); var ps=new HashSet<int>(pids);',
        '    IntPtr fgHwnd=GetForegroundWindow(); fgOut[0]="";',
        '    EnumWindows((h,l)=>{',
        '      if(!IsWindowVisible(h))return true;',
        '      uint p; GetWindowThreadProcessId(h,out p);',
        '      if(!ps.Contains((int)p))return true;',
        '      var s=new StringBuilder(512);GetWindowText(h,s,512);',
        '      if(s.Length==0)return true;',
        '      bool topmost=(GetWindowLong(h,GWL_EXSTYLE)&WS_EX_TOPMOST)!=0;',
        '      r.Add((topmost?"TOPMOST:":"")+s.ToString());',
        '      if(h==fgHwnd)fgOut[0]=s.ToString();',
        '      return true;',
        '    },IntPtr.Zero); return r;}',
        '}',
        '"@',
        '$ProgressPreference="SilentlyContinue"',
        '$pids=(Get-Process -Name \'*teams*\' -ErrorAction SilentlyContinue).Id',
        'if($pids){$fgOut=@("");$titles=[WE]::Titles($pids,$fgOut);Write-Output "FG:$($fgOut[0])";$titles}',
      ].join('\n');
      const encoded = Buffer.from(psScript, 'utf16le').toString('base64');
      const output = execSync(
        `powershell -NoProfile -EncodedCommand ${encoded}`,
        { timeout: 5000, encoding: 'utf8' }
      ).trim();

      if (!output) return null;

      const allLines = output.split('\n').map(l => l.trim()).filter(Boolean);
      const fgLine = allLines.find(l => l.startsWith('FG:')) ?? '';
      const fgTitle = fgLine.slice(3).trim();
      const lines = allLines.filter(l => !l.startsWith('FG:'));

      // Pass 1: TOPMOST Teams window = compact meeting overlay (language-independent).
      const topmostLines = lines.filter(l => l.startsWith('TOPMOST:')).map(l => l.slice(8));
      const meetingLines = topmostLines.filter(l => l.includes('| Microsoft Teams'));
      for (const line of meetingLines) {
        const title = this.extractTitleFromTeamsWindow(line);
        if (title) return title;
      }

      // Pass 2: Focused Teams window (user is actively in the meeting window).
      if (fgTitle && fgTitle.includes('| Microsoft Teams')) {
        const title = this.extractTitleFromTeamsWindow(fgTitle);
        if (title) return title;
      }

      // Pass 3: Any non-nav Teams window title.
      for (const line of lines) {
        const raw = line.startsWith('TOPMOST:') ? line.slice(8) : line;
        if (!raw.includes('| Microsoft Teams')) continue;
        const title = this.extractTitleFromTeamsWindow(raw);
        if (title) return title;
      }
      return null;
    } catch {
      return null;
    }
  }

  private extractTitleFromTeamsWindow(windowTitle: string): string | null {
    const stripped = windowTitle.replace(/\s*\|\s*Microsoft Teams\s*$/, '').trim();
    if (!stripped) return null;
    const segments = stripped.split('|').map(s => s.trim()).reverse();
    let skipNext = false;
    for (const segment of segments) {
      if (skipNext) { skipNext = false; continue; }
      if (isEmailAddress(segment)) { skipNext = true; continue; }
      if (segment && !TEAMS_NAV_TITLES.has(segment.toLowerCase())) return segment;
    }
    return null;
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
