import { ipcMain, BrowserWindow, IpcMainInvokeEvent, IpcMainEvent } from 'electron';
import ActivityStore from './ActivityStore'; // Import ActivityStore to use its methods
import { DayData } from './ActivityStore'; 
import { AggregationIntervalMinutes } from './TimelineGenerator'; 

/**
 * Handles IPC communication related to the ActivityStore.
 * Registers handlers for requests from the renderer process and sends notifications.
 */
export class ActivityIpc {
    private activityStore: ActivityStore;

    /**
     * Creates an instance of ActivityIpc.
     * @param activityStore The ActivityStore instance to interact with.
     */
    constructor(activityStore: ActivityStore) {
        if (!activityStore) {
            throw new Error("ActivityIpc requires a valid ActivityStore instance.");
        }
        this.activityStore = activityStore;
    }

    /**
     * Registers all IPC handlers for the ActivityStore.
     */
    registerHandlers(): void {
        console.log('[IPC] Registering ActivityStore IPC handlers...');

        ipcMain.handle('get-day-data', (event: IpcMainInvokeEvent, date: string | null | undefined): DayData | null => {
            // Delegate directly to the activityStore method
            return this.activityStore.getDayData(date);
        });

        ipcMain.handle('get-available-dates', (): string[] => {
            return this.activityStore.getAvailableDates();
        });

        ipcMain.handle('get-aggregation-interval', (): AggregationIntervalMinutes | null => {
             return this.activityStore.getAggregationInterval();
        });

         ipcMain.handle('set-aggregation-interval', async (event: IpcMainInvokeEvent, interval: number): Promise<void> => {
            // Validate and cast interval before passing to store
             if ([5, 10, 15].includes(interval)) {
                this.activityStore.setAggregationInterval(interval as AggregationIntervalMinutes);
             } else {
                 console.error(`[IPC] Invalid aggregation interval received: ${interval}`);
                 // Optional: throw error back to renderer?
                 // throw new Error(`Invalid aggregation interval: ${interval}`);
             }
        });

        // Note: start/pause tracking are still handled via ipcMain.on as they don't return values directly
        ipcMain.on('start-tracking', (event: IpcMainEvent): void => {
            this.activityStore.startTracking();
        });

        ipcMain.on('pause-tracking', (event: IpcMainEvent): void => {
            this.activityStore.pauseTracking();
        });

        console.log('[IPC] ActivityStore IPC handlers registered.');
    }

    /**
     * Sends a notification to all renderer windows that activity data for a specific day has been updated.
     * @param dateKey The date key (YYYY-MM-DD) of the updated day.
     */
    notifyDataUpdate(dateKey: string): void {
        const windows = BrowserWindow.getAllWindows();
        if (windows.length === 0) return;

        // console.log(`[IPC] Notifying renderer(s) of update for date: ${dateKey}`); // Debug log
        windows.forEach((window: BrowserWindow) => {
            if (window && !window.isDestroyed() && window.webContents) {
                try {
                    window.webContents.send('activity-data-updated', dateKey);
                } catch (sendError) {
                    console.warn(`[IPC] Failed to send activity-data-updated to window ${window.id}:`, sendError);
                }
            }
        });
    }

    /**
     * Sends a notification to all renderer windows about tracking status changes.
     * @param isTracking The current tracking status.
     */
    notifyTrackingStatusChange(isTracking: boolean): void {
        const windows = BrowserWindow.getAllWindows();
        if (windows.length === 0) return;

        // console.log(`[IPC] Notifying renderer(s) of tracking status change: ${isTracking}`); // Debug log
        windows.forEach((window: BrowserWindow) => {
            if (window && !window.isDestroyed() && window.webContents) {
                try {
                    window.webContents.send('tracking-status-changed', isTracking);
                } catch (sendError) {
                    console.warn(`[IPC] Failed to send tracking-status-changed to window ${window.id}:`, sendError);
                }
            }
        });
    }


    /**
     * Removes all registered IPC handlers. Should be called during cleanup.
     */
    cleanup(): void {
        console.log('[IPC] Removing ActivityStore IPC handlers...');
        ipcMain.removeHandler('get-day-data');
        ipcMain.removeHandler('get-available-dates');
        ipcMain.removeHandler('get-aggregation-interval'); // Remove new handler
        ipcMain.removeHandler('set-aggregation-interval'); // Remove new handler
        // Ensure listeners for 'on' events are also removed
        ipcMain.removeAllListeners('start-tracking');
        ipcMain.removeAllListeners('pause-tracking');
        console.log('[IPC] ActivityStore IPC handlers removed.');
    }
}