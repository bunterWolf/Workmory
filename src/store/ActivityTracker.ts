import { DateManager } from './DateManager';
import { ActivityStorage } from './ActivityStorage';
import { AggregationService } from './AggregationService';
import { HeartbeatData } from './ActivityStore';
import { AggregationIntervalMinutes } from './TimelineGenerator';
import { IntervalScheduler } from './IntervalScheduler';

// Export callback types
export type DataUpdateCallback = (dateKey: string) => void;
export type TrackingStatusCallback = (isTracking: boolean) => void;

/**
 * Verantwortlich für das Tracking von Aktivitäten und das Verwalten des Tracking-Status.
 * Koordiniert das Hinzufügen von Heartbeats und die Benachrichtigung anderer Komponenten.
 */
export class ActivityTracker {
  private dateManager: DateManager;
  private activityStorage: ActivityStorage;
  private aggregationService: AggregationService;
  private isTracking: boolean = false;
  private currentDayKey: string;
  private useMockData: boolean = false;
  private scheduler: IntervalScheduler;
  
  // Callback-Funktionen
  private onDataUpdate: DataUpdateCallback | null = null;
  private onTrackingStatusChange: TrackingStatusCallback | null = null;

  /**
   * Erstellt eine neue Instanz des ActivityTrackers.
   * @param dateManager DateManager-Instanz für Datums-Operationen.
   * @param activityStorage ActivityStorage-Instanz für Datenspeicherung.
   * @param aggregationService AggregationService-Instanz für Datenaggregation.
   * @param useMockData Boolean, ob Mock-Daten verwendet werden sollen.
   */
  constructor(
    dateManager: DateManager, 
    activityStorage: ActivityStorage,
    aggregationService: AggregationService,
    useMockData: boolean = false
  ) {
    this.dateManager = dateManager;
    this.activityStorage = activityStorage;
    this.aggregationService = aggregationService;
    this.useMockData = useMockData;
    this.currentDayKey = this.dateManager.getDateKey(Date.now());

    // Erstelle den IntervalScheduler
    const intervalCallback = this.handleIntervalEnd.bind(this);
    const interval = this.aggregationService.getAggregationInterval();
    this.scheduler = new IntervalScheduler(interval, intervalCallback);
  }

  /**
   * Setzt die Callback-Funktionen für Benachrichtigungen.
   * @param dataUpdateCallback Callback für Datenaktualisierungen
   * @param trackingStatusCallback Callback für Tracking-Statusänderungen
   */
  setCallbacks(
    dataUpdateCallback: DataUpdateCallback | null = null,
    trackingStatusCallback: TrackingStatusCallback | null = null
  ): void {
    this.onDataUpdate = dataUpdateCallback;
    this.onTrackingStatusChange = trackingStatusCallback;
  }

  /**
   * Startet das Aktivitäts-Tracking.
   */
  startTracking(): void {
    if (this.isTracking) {
      console.log('[Tracker] Tracking already active.');
      return;
    }
    
    console.log('[Tracker] Starting tracking...');
    this.isTracking = true;
    this.currentDayKey = this.dateManager.getDateKey(Date.now());
    
    // Starte Scheduler nur wenn keine Mock-Daten
    if (!this.useMockData) {
      this.scheduler.start();
    }
    
    // Benachrichtige über Statusänderung
    if (this.onTrackingStatusChange) {
      this.onTrackingStatusChange(this.isTracking);
    }
  }

  /**
   * Pausiert das Aktivitäts-Tracking.
   */
  pauseTracking(): void {
    if (!this.isTracking) {
      console.log('[Tracker] Tracking not active, cannot pause.');
      return;
    }
    
    console.log('[Tracker] Pausing tracking...');
    this.isTracking = false;
    this.scheduler.pause();
    
    // Speichere aktuelle Daten, wenn nicht im Mock-Modus
    if (!this.useMockData) {
      this.activityStorage.saveToDisk();
    }
    
    // Benachrichtige über Statusänderung
    if (this.onTrackingStatusChange) {
      this.onTrackingStatusChange(this.isTracking);
    }
  }

  /**
   * Fügt einen neuen Heartbeat hinzu.
   * @param heartbeatData Daten für den neuen Heartbeat
   */
  addHeartbeat(heartbeatData: HeartbeatData): void {
    // Guard clause: Not tracking
    if (!this.isTracking) {
      return;
    }

    const timestamp = Date.now();
    const newDateKey = this.dateManager.getDateKey(timestamp);

    // Handle Day Change
    if (newDateKey !== this.currentDayKey) {
      this.handleDayChange(newDateKey);
    }

    // Update Heartbeats in Storage
    this.activityStorage.addHeartbeat(timestamp, heartbeatData, this.currentDayKey);
  }

  /**
   * Handler für das Ende eines Intervalls.
   */
  private handleIntervalEnd(): void {
    console.log(`[Tracker] Handling interval end triggered by scheduler.`);
    if (this.isTracking && !this.useMockData) {
      if (this.triggerTodaysAggregation()) {
        this.notifyDataUpdate(this.currentDayKey); 
      }
      this.activityStorage.saveToDisk();
    } else {
      console.log(`[Tracker] Skipping interval actions (tracking: ${this.isTracking}, mock: ${this.useMockData})`);
    }
  }

  /**
   * Löst die Aggregation für den aktuellen Tag aus.
   * @returns true wenn die Aggregation Änderungen enthielt, sonst false
   */
  private triggerTodaysAggregation(): boolean {
    this.currentDayKey = this.dateManager.getDateKey(Date.now());
    console.log(`[Tracker] Triggering aggregation for today (${this.currentDayKey})...`);
    return this.aggregationService.aggregateDay(this.currentDayKey);
  }

  /**
   * Behandelt einen Tageswechsel.
   * @param newDateKey Der neue Datums-Key
   */
  private handleDayChange(newDateKey: string): void {
    console.log(`[Tracker] Day changed during heartbeat addition. Old: ${this.currentDayKey}, New: ${newDateKey}`);
    // Speichere Daten des vorherigen Tages
    if (!this.useMockData) {
      this.activityStorage.saveToDisk();
    }
    this.currentDayKey = newDateKey;
  }

  /**
   * Benachrichtigt über Datenaktualisierungen.
   * @param dateKey Der aktualisierte Datums-Key
   */
  private notifyDataUpdate(dateKey: string): void {
    if (this.onDataUpdate) {
      this.onDataUpdate(dateKey);
    }
  }

  /**
   * Gibt den aktuellen Tracking-Status zurück.
   * @returns true, wenn das Tracking aktiv ist, sonst false
   */
  getTrackingStatus(): boolean {
    return this.isTracking;
  }

  /**
   * Aktualisiert das Aggregationsintervall.
   * @param interval Neues Intervall
   */
  setAggregationInterval(interval: AggregationIntervalMinutes): void {
    this.scheduler.setInterval(interval);
  }

  /**
   * Führt Bereinigungsarbeiten durch.
   */
  cleanup(): void {
    console.log("[Tracker] Cleaning up ActivityTracker...");
    this.scheduler.cleanup();
    console.log("[Tracker] ActivityTracker cleanup complete.");
  }
} 