import { ipcMain, BrowserWindow } from 'electron';
import { ActivityFacade } from './ActivityFacade';

/**
 * Verwaltet IPC-Kommunikation für ActivityFacade
 * Stellt Methoden für das Senden und Empfangen von Nachrichten zwischen Renderer- und Hauptprozess bereit.
 */
export class ActivityFacadeIpc {
  private facade: ActivityFacade;

  constructor(facade: ActivityFacade) {
    this.facade = facade;
  }

  /**
   * Registriert IPC-Handler für ActivityFacade-bezogene Operationen.
   */
  registerHandlers(): void {
    console.log('[IPC] Registering ActivityFacade IPC handlers...');

    // Tracking starten/pausieren
    ipcMain.handle('activity:startTracking', () => {
      console.log('[IPC] Received request to start tracking');
      this.facade.startTracking();
      return { success: true };
    });

    ipcMain.handle('activity:pauseTracking', () => {
      console.log('[IPC] Received request to pause tracking');
      this.facade.pauseTracking();
      return { success: true };
    });

    // Datenabruf
    ipcMain.handle('activity:getDayData', (_, dateKey: string | null) => {
      console.log(`[IPC] Received request to get day data for ${dateKey || 'today'}`);
      return this.facade.getDayData(dateKey);
    });

    ipcMain.handle('activity:getAvailableDates', () => {
      console.log('[IPC] Received request to get available dates');
      return this.facade.getAvailableDates();
    });

    // Einstellungen
    ipcMain.handle('activity:getAggregationInterval', () => {
      console.log('[IPC] Received request to get aggregation interval');
      return this.facade.getAggregationInterval();
    });

    ipcMain.handle('activity:setAggregationInterval', (_, interval: 5 | 10 | 15) => {
      console.log(`[IPC] Received request to set aggregation interval to ${interval}`);
      this.facade.setAggregationInterval(interval);
      return { success: true };
    });

    ipcMain.handle('activity:updateStoragePath', (_, newPath: string | null) => {
      console.log(`[IPC] Received request to update storage path to ${newPath || 'default'}`);
      return { success: this.facade.updateStoragePath(newPath) };
    });

    ipcMain.handle('activity:useExistingStoreFile', (_, path: string) => {
      console.log(`[IPC] Received request to use existing store file at ${path}`);
      return { success: this.facade.useExistingStoreFile(path) };
    });

    console.log('[IPC] ActivityFacade IPC handlers registered');
  }

  /**
   * Benachrichtigt den Renderer-Prozess über Datenaktualisierungen.
   * @param dateKey Der Datums-Key, für den Daten aktualisiert wurden.
   */
  notifyDataUpdate(dateKey: string): void {
    console.log(`[IPC] Notifying renderer about data update for ${dateKey}`);
    this.sendToAllWindows('activity:dataUpdated', dateKey);
  }

  /**
   * Benachrichtigt den Renderer-Prozess über Änderungen des Tracking-Status.
   * @param isTracking Der aktuelle Tracking-Status.
   */
  notifyTrackingStatusChange(isTracking: boolean): void {
    console.log(`[IPC] Notifying renderer about tracking status change: ${isTracking}`);
    this.sendToAllWindows('activity:trackingStatusChanged', isTracking);
  }

  /**
   * Sendet eine Nachricht an alle geöffneten Fenster.
   * @param channel Der IPC-Kanal.
   * @param data Die zu sendenden Daten.
   */
  private sendToAllWindows(channel: string, data: any): void {
    BrowserWindow.getAllWindows().forEach(window => {
      if (window && !window.isDestroyed()) {
        window.webContents.send(channel, data);
      }
    });
  }
} 