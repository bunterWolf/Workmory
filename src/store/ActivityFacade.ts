import { ActivityStorage } from './ActivityStorage';
import { DateManager, DayChangeHandler } from './DateManager';
import { AggregationService } from './AggregationService';
import { ActivityTracker } from './ActivityTracker';
import { SettingsManager } from './SettingsManager';
import { HeartbeatData, DayData } from './ActivityStore';
import { AggregationIntervalMinutes } from './TimelineGenerator';

/**
 * Zentrale Fassade für alle aktivitätsbezogenen Operationen.
 * Vereinfacht die API für andere Teile der Anwendung und delegiert
 * Anfragen an die entsprechenden spezialisierten Komponenten.
 */
export class ActivityFacade {
  private dateManager: DateManager;
  private activityStorage: ActivityStorage;
  private aggregationService: AggregationService;
  private activityTracker: ActivityTracker;
  private settingsManager: SettingsManager;
  private useMockData: boolean;

  // Callback-Funktionen
  private onDataUpdate: ((dateKey: string) => void) | null = null;
  private onTrackingStatusChange: ((isTracking: boolean) => void) | null = null;

  constructor(options: { useMockData?: boolean; storagePath?: string | null } = {}) {
    this.useMockData = options.useMockData || false;
    
    // Initialisiere SettingsManager
    this.settingsManager = new SettingsManager();
    
    // Initialisiere DateManager
    this.dateManager = new DateManager();
    
    // Initialisiere ActivityStorage
    this.activityStorage = new ActivityStorage({
      useMockData: this.useMockData,
      storagePath: options.storagePath || this.settingsManager.getActivityStoreFilePath()
    }, this.dateManager, this.settingsManager);
    
    // Initialisiere AggregationService
    this.aggregationService = new AggregationService(
      this.activityStorage
    );
    
    // Initialisiere ActivityTracker
    this.activityTracker = new ActivityTracker(
      this.dateManager,
      this.activityStorage,
      this.aggregationService
    );
    
    // Führe initiale Bereinigung durch, wenn keine Mockdaten verwendet werden
    if (!this.useMockData) {
      this.cleanupOldData();
    }
  }

  /**
   * Setzt die Callback-Funktionen für Benachrichtigungen.
   * 
   * @param onDataUpdate Callback für Datenaktualisierungen
   * @param onTrackingStatusChange Callback für Änderungen des Tracking-Status
   */
  setCallbacks(
    onDataUpdate: (dateKey: string) => void,
    onTrackingStatusChange: (isTracking: boolean) => void
  ): void {
    this.onDataUpdate = onDataUpdate;
    this.onTrackingStatusChange = onTrackingStatusChange;
    
    // Setze die Callbacks beim ActivityTracker
    this.activityTracker.setCallbacks(
      (dateKey: string) => {
        if (this.onDataUpdate) this.onDataUpdate(dateKey);
      },
      (isTracking: boolean) => {
        if (this.onTrackingStatusChange) this.onTrackingStatusChange(isTracking);
      }
    );
  }

  // ----- Methoden vom DateManager -----
  
  startDayChangeMonitoring(dayChangeHandler?: DayChangeHandler): void {
    this.dateManager.startDayChangeMonitoring(dayChangeHandler);
  }
  
  stopDayChangeMonitoring(): void {
    this.dateManager.stopDayChangeMonitoring();
  }
  
  getDateKey(timestamp: number): string {
    return this.dateManager.getDateKey(timestamp);
  }
  
  // ----- Methoden vom ActivityTracker -----
  
  startTracking(): void {
    this.activityTracker.startTracking();
  }
  
  pauseTracking(): void {
    this.activityTracker.pauseTracking();
  }
  
  addHeartbeat(heartbeatData: HeartbeatData): void {
    this.activityTracker.addHeartbeat(heartbeatData);
  }
  
  // ----- Methoden vom ActivityStorage -----
  
  saveToDisk(): void {
    this.activityStorage.saveToDisk();
  }
  
  getDayData(dateKey?: string | null): DayData | null {
    return this.activityStorage.getDayData(dateKey || this.dateManager.getDateKey(Date.now()));
  }
  
  getAvailableDates(): string[] {
    return this.activityStorage.getAvailableDates();
  }
  
  cleanupOldData(): void {
    this.activityStorage.cleanupOldData();
  }
  
  updateStoragePath(newDirPath: string | null): boolean {
    return this.activityStorage.updateStoragePath(newDirPath);
  }
  
  useExistingStoreFile(newDirPath: string): boolean {
    return this.activityStorage.useExistingStoreFile(newDirPath);
  }
  
  // ----- Methoden vom AggregationService -----
  
  getAggregationInterval(): AggregationIntervalMinutes {
    return this.aggregationService.getAggregationInterval();
  }
  
  setAggregationInterval(interval: AggregationIntervalMinutes): void {
    this.aggregationService.setAggregationInterval(interval);
    // Der ActivityStorage und ActivityTracker müssen über die 
    // Änderung informiert werden, aber die direkte Methode existiert
    // möglicherweise noch nicht - die Logik sollte in den jeweiligen
    // Komponenten implementiert werden
  }
  
  // ----- Hilfsmethoden -----
  
  getSettingsManager(): SettingsManager {
    return this.settingsManager;
  }
  
  cleanup(): void {
    this.activityTracker.cleanup();
    this.dateManager.cleanup();
    
    if (!this.useMockData) {
      this.saveToDisk();
    }
  }
} 