import { PublicClientApplication, AccountInfo, InteractiveRequest } from '@azure/msal-node';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';
import { HeartbeatData } from '../store/ActivityStore';
import { extractMeetingTitle } from './teamsNavTitles';

// Graph API presence activities that indicate an active meeting/call
const IN_MEETING_ACTIVITIES = new Set([
  'InACall',
  'InAMeeting',
  'InAConferenceCall',
  'InAPresentationMode',
]);

const GRAPH_SCOPES = ['Presence.Read'];

interface PresenceResponse {
  activity: string;
  availability: string;
}

/**
 * Detects active Microsoft Teams meetings via the Microsoft Graph API.
 *
 * Uses /me/presence to check if the user is in a meeting — works regardless
 * of mute status and is more reliable than local signals like UDP or mic registry.
 *
 * Auth: Device Code Flow (MSAL). The user authenticates once via browser;
 * the token is cached on disk and silently refreshed on subsequent starts.
 *
 * Requires Azure app registration with delegated permission: Presence.Read
 * See: https://portal.azure.com → Microsoft Entra ID → App-Registrierungen
 */
export default class GraphTeamsMeetingsWatcher {
  private msalApp: PublicClientApplication | null = null;
  private account: AccountInfo | null = null;
  private tokenCachePath: string;
  private readonly clientId: string;
  private readonly tenantId: string;

  constructor(clientId: string, tenantId: string = 'common') {
    this.clientId = clientId;
    this.tenantId = tenantId;
    this.tokenCachePath = path.join(app.getPath('userData'), 'teams-graph-token-cache.json');
  }

  async init(): Promise<void> {
    if (!this.clientId) {
      console.log('[GraphTeamsMeetingsWatcher] Keine Client ID konfiguriert, wird übersprungen.');
      return;
    }

    this.msalApp = new PublicClientApplication({
      auth: {
        clientId: this.clientId,
        authority: `https://login.microsoftonline.com/${this.tenantId}`,
      },
      cache: {
        cachePlugin: {
          beforeCacheAccess: async (cacheContext) => {
            cacheContext.tokenCache.deserialize(this.loadTokenCache());
          },
          afterCacheAccess: async (cacheContext) => {
            if (cacheContext.cacheHasChanged) {
              this.saveTokenCache(cacheContext.tokenCache.serialize());
            }
          },
        },
      },
    });

    // Try silent auth with cached account
    const accounts = await this.msalApp.getTokenCache().getAllAccounts();
    if (accounts.length > 0) {
      this.account = accounts[0];
      console.log(`[GraphTeamsMeetingsWatcher] Gespeicherter Token für ${this.account.username} gefunden.`);
    } else {
      // Kick off Device Code Flow in background — app continues starting up
      console.log('[GraphTeamsMeetingsWatcher] Kein Token gefunden, starte Authentifizierung...');
      this.runDeviceCodeFlow().catch(err =>
        console.error('[GraphTeamsMeetingsWatcher] Authentifizierung fehlgeschlagen:', err)
      );
    }
  }

  private async runDeviceCodeFlow(): Promise<void> {
    if (!this.msalApp) return;

    const response = await this.msalApp.acquireTokenByDeviceCode({
      scopes: GRAPH_SCOPES,
      deviceCodeCallback: (deviceCodeResponse) => {
        // Shown in the app console — TODO: surface in UI via IPC notification
        console.log('\n[GraphTeamsMeetingsWatcher] ========================================');
        console.log('[GraphTeamsMeetingsWatcher] TEAMS-ANMELDUNG ERFORDERLICH');
        console.log(`[GraphTeamsMeetingsWatcher] ${deviceCodeResponse.message}`);
        console.log('[GraphTeamsMeetingsWatcher] ========================================\n');
      },
    });

    if (response?.account) {
      this.account = response.account;
      console.log(`[GraphTeamsMeetingsWatcher] Authentifizierung erfolgreich für ${this.account.username}`);
    }
  }

  async getHeartbeatData(): Promise<Partial<HeartbeatData>> {
    return { teamsMeeting: await this.detectMeeting() };
  }

  private async detectMeeting(): Promise<{ title: string } | null> {
    if (!this.msalApp || !this.account) return null;

    try {
      // Acquire token silently (auto-refresh if expired)
      const tokenResponse = await this.msalApp.acquireTokenSilent({
        scopes: GRAPH_SCOPES,
        account: this.account,
      });
      if (!tokenResponse) return null;

      const presence = await this.fetchPresence(tokenResponse.accessToken);
      if (!presence || !IN_MEETING_ACTIVITIES.has(presence.activity)) return null;

      const title = this.getMeetingTitleFromWindow() ?? 'Teams Meeting';
      return { title };
    } catch (error) {
      console.error('[GraphTeamsMeetingsWatcher] Fehler beim Präsenz-Check:', error);
      return null;
    }
  }

  private async fetchPresence(accessToken: string): Promise<PresenceResponse | null> {
    try {
      const response = await fetch('https://graph.microsoft.com/v1.0/me/presence', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!response.ok) {
        console.error(`[GraphTeamsMeetingsWatcher] Presence API Fehler: ${response.status}`);
        return null;
      }
      return response.json() as Promise<PresenceResponse>;
    } catch (error) {
      console.error('[GraphTeamsMeetingsWatcher] Netzwerkfehler beim Presence-Abruf:', error);
      return null;
    }
  }

  private getMeetingTitleFromWindow(): string | null {
    if (process.platform !== 'win32') return null;
    try {
      const output = execSync(
        "powershell -NoProfile -Command \"Get-Process | Where-Object Name -like '*teams*' | Where-Object MainWindowTitle -like '*| Microsoft Teams' | Select-Object -ExpandProperty MainWindowTitle\"",
        { timeout: 3000, encoding: 'utf8' }
      ).trim();

      if (!output) return null;

      for (const line of output.split('\n')) {
        const title = extractMeetingTitle(line.trim());
        if (title) return title;
      }
      return null;
    } catch {
      return null;
    }
  }

  private loadTokenCache(): string {
    try {
      if (fs.existsSync(this.tokenCachePath)) {
        return fs.readFileSync(this.tokenCachePath, 'utf8');
      }
    } catch { }
    return '';
  }

  private saveTokenCache(data: string): void {
    try {
      fs.writeFileSync(this.tokenCachePath, data, 'utf8');
    } catch (error) {
      console.error('[GraphTeamsMeetingsWatcher] Fehler beim Speichern des Token-Cache:', error);
    }
  }

  cleanup(): void {
    // Token cache is persisted to disk — nothing else to clean up
  }
}
