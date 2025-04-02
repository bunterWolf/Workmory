const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);
const os = require('os');
const path = require('path');
const fs = require('fs');

/**
 * Watcher-Modul zur Erkennung von Microsoft Teams Meetings durch Analyse der Fenstertitel.
 */
class TeamsMeetingsWatcher {
  constructor() {
    this.platform = os.platform();
    this.isNewTeams = false; // Flag für die neue Teams-Version (Teams 2.0)
  }

  /**
   * Initialisiert den Watcher
   */
  async init() {
    console.log('TeamsMeetingsWatcher initialized');
    
    // Überprüfe, ob die neue Teams-Version verwendet wird
    if (this.platform === 'win32') {
      try {
        const { stdout } = await execAsync('powershell -command "Get-Process | Where-Object { $_.Name -like \"*teams*\" } | Select-Object Name | Format-Table -HideTableHeaders"');
        const processNames = stdout.trim().split(/\r?\n/).map(name => name.trim().toLowerCase());
        
        // Typische Prozessnamen für Teams 2.0
        this.isNewTeams = processNames.some(name => 
          name.includes('teams.exe') || 
          name.includes('ms-teams') || 
          name.includes('msteams'));
          
        console.log('Teams-Version-Erkennung:', this.isNewTeams ? 'Neue Teams-Version (2.0) erkannt' : 'Klassisches Teams erkannt');
      } catch (error) {
        console.error('Fehler bei der Teams-Versionserkennung:', error.message);
      }
    }
    
    return Promise.resolve();
  }

  /**
   * Ermittelt die Fenstertitel aller Teams-Fenster basierend auf dem Betriebssystem.
   * @returns {Promise<string[]>} Liste der Fenstertitel
   */
  async getTeamsWindowTitles() {
    try {
      if (this.platform === 'win32') {
        if (this.isNewTeams) {
          return await this.getNewTeamsWindowTitles();
        }
        
        // Erweiterter PowerShell-Befehl, der auch minimierte Fenster erfasst
        const command = `
          Add-Type @"
            using System;
            using System.Runtime.InteropServices;
            public class Win32 {
              [DllImport("user32.dll")] public static extern bool EnumWindows(EnumWindowsProc enumProc, IntPtr lParam);
              [DllImport("user32.dll")] public static extern int GetWindowText(IntPtr hWnd, System.Text.StringBuilder lpString, int nMaxCount);
              [DllImport("user32.dll")] public static extern int GetWindowTextLength(IntPtr hWnd);
              [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);
              public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);
            }
"@

          # Suche nach verschiedenen möglichen Teams-Prozessnamen
          $teamsProcesses = @(
            Get-Process Teams -ErrorAction SilentlyContinue
            Get-Process "ms-teams" -ErrorAction SilentlyContinue
            Get-Process "Microsoft Teams" -ErrorAction SilentlyContinue
            Get-Process "Teams.exe" -ErrorAction SilentlyContinue
          ) | Where-Object { $_ -ne $null }
          
          if ($teamsProcesses) {
            $teamsProcessIds = $teamsProcesses | ForEach-Object { $_.Id }
            $titles = New-Object System.Collections.ArrayList

            $enumWindowsCallback = {
              param([IntPtr]$hwnd, [IntPtr]$lparam)
              
              $processId = 0
              [Win32]::GetWindowThreadProcessId($hwnd, [ref]$processId)
              
              if ($teamsProcessIds -contains $processId) {
                $length = [Win32]::GetWindowTextLength($hwnd)
                if ($length -gt 0) {
                  $title = New-Object System.Text.StringBuilder($length + 1)
                  [Win32]::GetWindowText($hwnd, $title, $title.Capacity)
                  if ($title.Length -gt 0) {
                    $titles.Add($title.ToString()) | Out-Null
                  }
                }
              }
              return $true
            }

            $null = [Win32]::EnumWindows($enumWindowsCallback, [IntPtr]::Zero)
            $titles | Where-Object { $_ -ne "" }
          }
        `.replace(/\n/g, ' ');
        
        const { stdout } = await execAsync(`powershell -command "${command}"`);
        return stdout.trim().split(/\r?\n/).filter(title => title.trim() !== '');
      } else if (this.platform === 'darwin') {
        // Erweiterter AppleScript-Befehl, der auch minimierte Fenster erfasst
        const command = `osascript -e '
          tell application "System Events"
            set teamsList to {}
            set teamsProcess to first process whose name is "Microsoft Teams"
            repeat with w in (windows of teamsProcess)
              set windowTitle to name of w
              if windowTitle is not "" then
                copy windowTitle to end of teamsList
              end if
            end repeat
            return teamsList
          end tell'`;
        const { stdout } = await execAsync(command);
        return stdout.trim().split(', ').map(title => title.trim()).filter(title => title.trim() !== '');
      }
      
      console.warn('Teams-Meeting-Erkennung wird auf dieser Plattform nicht unterstützt:', this.platform);
      return [];
    } catch (error) {
      if (!error.message.includes('cannot find a process') && !error.message.includes('No matching processes')) {
        console.error(`Fehler beim Abrufen der Teams-Fenstertitel auf ${this.platform}:`, error.message);
      }
      return [];
    }
  }

  /**
   * Ermittelt die Fenstertitel für die neue Teams-Version (Teams 2.0)
   * @returns {Promise<string[]>} Liste der Fenstertitel
   */
  async getNewTeamsWindowTitles() {
    try {
      // Für neue Teams-Version einen angepassten Befehl verwenden
      const command = `
        Add-Type @"
          using System;
          using System.Runtime.InteropServices;
          public class Win32 {
            [DllImport("user32.dll")] public static extern bool EnumWindows(EnumWindowsProc enumProc, IntPtr lParam);
            [DllImport("user32.dll")] public static extern int GetWindowText(IntPtr hWnd, System.Text.StringBuilder lpString, int nMaxCount);
            [DllImport("user32.dll")] public static extern int GetWindowTextLength(IntPtr hWnd);
            [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);
            [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr hWnd);
            public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);
          }
"@

        # Für Teams 2.0 mehrere mögliche Prozessnamen abfragen
        $processNames = @("Teams", "ms-teams", "msteams", "Microsoft Teams")
        $teamsProcesses = Get-Process | Where-Object { $processNames -contains $_.Name }
        
        if ($teamsProcesses) {
          $teamsProcessIds = $teamsProcesses | ForEach-Object { $_.Id }
          $titles = New-Object System.Collections.ArrayList

          $enumWindowsCallback = {
            param([IntPtr]$hwnd, [IntPtr]$lparam)
            
            $processId = 0
            [Win32]::GetWindowThreadProcessId($hwnd, [ref]$processId)
            
            if ($teamsProcessIds -contains $processId -and [Win32]::IsWindowVisible($hwnd)) {
              $length = [Win32]::GetWindowTextLength($hwnd)
              if ($length -gt 0) {
                $title = New-Object System.Text.StringBuilder($length + 1)
                [Win32]::GetWindowText($hwnd, $title, $title.Capacity)
                if ($title.Length -gt 0) {
                  $titles.Add($title.ToString()) | Out-Null
                }
              }
            }
            return $true
          }

          $null = [Win32]::EnumWindows($enumWindowsCallback, [IntPtr]::Zero)
          $titles | Where-Object { $_ -ne "" }
        }
      `.replace(/\n/g, ' ');
      
      const { stdout } = await execAsync(`powershell -command "${command}"`);
      const titles = stdout.trim().split(/\r?\n/).filter(title => title.trim() !== '');
      
      console.log('Neue Teams-Version Fenstertitel:', titles);
      return titles;
    } catch (error) {
      console.error('Fehler beim Abrufen der Fenstertitel für die neue Teams-Version:', error.message);
      return [];
    }
  }

  /**
   * Prüft anhand der Fenstertitel, ob der Benutzer sich in einem Teams-Meeting befindet.
   * @returns {Promise<{isInMeeting: boolean, meetingInfo: {title: string, status: string} | null}>}
   */
  async checkTeamsMeetingStatus() {
    const windowTitles = await this.getTeamsWindowTitles();

    // Debug-Ausgabe der gefundenen Fenstertitel
    console.log('Teams Fenstertitel gefunden:', windowTitles);

    // Wenn keine Fenster gefunden wurden, ist kein Meeting aktiv
    if (windowTitles.length === 0) {
      console.log('Keine Teams-Fenster gefunden');
      return { isInMeeting: false, meetingInfo: null };
    }

    // Schlüsselwörter die auf ein Meeting/einen Anruf hinweisen
    const meetingKeywords = [
      'meeting', 'besprechung', 'meeting beigetreten', 'joined', 'teilnehmer', 
      'call', 'anruf', 'konferenz', 'conference', 'conversation', 'unterhaltung',
      '|', 'gestartet', 'started', 'chat', 'besprechungschat'
    ];
    
    // Schlüsselwörter die darauf hinweisen, dass es sich NICHT um ein Meeting handelt
    const nonMeetingKeywords = [
      'chat and channels', 'chat und kanäle', 'calendar', 'kalender', 
      'activity', 'aktivitäten', 'teams', 'files', 'dateien'
    ];

    // Erste Prüfung: Suche nach Meeting-spezifischen Fenstertiteln
    for (const title of windowTitles) {
      const lowerTitle = title.toLowerCase();
      
      // Prüfe ob der Titel auf ein Meeting hinweist
      const isLikelyMeeting = meetingKeywords.some(keyword => lowerTitle.includes(keyword));
      const isNonMeeting = nonMeetingKeywords.some(keyword => lowerTitle === keyword);
      
      if (isLikelyMeeting && !isNonMeeting) {
        // Bereinige den Titel wenn nötig
        const meetingTitle = title.includes('|') ? title.split('|')[0].trim() : title;
        
        console.log('Teams-Meeting erkannt:', meetingTitle);
        
        return {
          isInMeeting: true,
          meetingInfo: {
            title: meetingTitle,
            status: 'active'
          }
        };
      }
    }
    
    // Zweite Prüfung: Gibt es ein Fenster mit einem langen Titel, der kein Standard-Teams-Fenster ist?
    for (const title of windowTitles) {
      const lowerTitle = title.toLowerCase();
      
      // Lange Titel, die nicht mit Standard-Teams-Keywords beginnen, sind wahrscheinlich Meetings
      const isLongNonStandardTitle = title.length > 20 && 
                                   !nonMeetingKeywords.some(keyword => lowerTitle.includes(keyword)) &&
                                   !lowerTitle.startsWith('microsoft teams');
      
      if (isLongNonStandardTitle) {
        console.log('Teams-Meeting über Titellänge erkannt:', title);
        
        return {
          isInMeeting: true,
          meetingInfo: {
            title: title,
            status: 'active'
          }
        };
      }
    }

    console.log('Kein Teams-Meeting in den gefundenen Fenstern erkannt');
    return { isInMeeting: false, meetingInfo: null };
  }

  /**
   * Liefert die aktuellen Meeting-Daten für den Heartbeat
   * @returns {Promise<{teamsMeeting: false | {title: string, status: string}}>}
   */
  async getHeartbeatData() {
    const { isInMeeting, meetingInfo } = await this.checkTeamsMeetingStatus();
    return {
      teamsMeeting: isInMeeting ? meetingInfo : false
    };
  }

  /**
   * Räumt Ressourcen auf
   */
  cleanup() {
    // Keine spezielle Bereinigung notwendig
  }
}

module.exports = TeamsMeetingsWatcher; 