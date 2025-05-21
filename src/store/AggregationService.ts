import TimelineGenerator, { AggregationIntervalMinutes } from './TimelineGenerator';
import { ActivityStorage } from './ActivityStorage';
import { DayData, AggregatedData } from './ActivityStore';

/**
 * Verwaltet die Aggregation von Aktivitätsdaten.
 * Verantwortlich für Erzeugung von Zeitleisten und Zusammenfassungen.
 */
export class AggregationService {
  private timelineGenerator: TimelineGenerator;
  private activityStorage: ActivityStorage;
  private aggregationCache: Map<string, AggregatedData> = new Map();
  
  /**
   * Erstellt eine Instanz des AggregationService.
   * @param activityStorage ActivityStorage-Instanz für Datenzugriff.
   */
  constructor(activityStorage: ActivityStorage) {
    this.activityStorage = activityStorage;
    this.timelineGenerator = new TimelineGenerator();
  }
  
  /**
   * Löscht den Aggregations-Cache.
   */
  clearCache(): void {
    this.aggregationCache.clear();
    console.log("[AggregationService] Aggregation cache cleared.");
  }
  
  /**
   * Gibt das aktuelle Aggregationsintervall zurück.
   * @returns Das Aggregationsintervall in Minuten (5, 10 oder 15).
   */
  getAggregationInterval(): AggregationIntervalMinutes {
    return this.timelineGenerator.aggregationInterval;
  }
  
  /**
   * Setzt das Aggregationsintervall.
   * @param interval Das neue Intervall in Minuten (5, 10 oder 15).
   */
  setAggregationInterval(interval: AggregationIntervalMinutes): void {
    if (![5, 10, 15].includes(interval)) {
      console.error('[AggregationService] Invalid interval passed:', interval);
      return;
    }
    
    console.log(`[AggregationService] Setting aggregation interval to ${interval} minutes.`);
    this.timelineGenerator.setAggregationInterval(interval);
    this.clearCache();
  }
  
  /**
   * Aggregiert die Daten für einen Tag.
   * Speichert die aggregierten Daten im Cache.
   * @param dateKey Der Datums-Key für den Tag.
   * @returns true, wenn die Aggregation Daten produziert hat, sonst false.
   */
  aggregateDay(dateKey: string): boolean {
    console.log(`[AggregationService] Aggregating data for ${dateKey}...`);
    
    // Lade Daten für den Tag
    const dayData = this.activityStorage.getDayData(dateKey);
    if (!dayData || dayData.heartbeats.length === 0) {
      console.log(`[AggregationService] No heartbeats found for ${dateKey}, clearing cache entry.`);
      this.aggregationCache.delete(dateKey);
      return false;
    }
    
    // Aggregiere die Daten
    try {
      // Generiere Timeline-Events
      const timelineEvents = this.timelineGenerator.generateTimelineEvents(dayData.heartbeats);
      
      // Berechne Zusammenfassung
      const summary = this.timelineGenerator.calculateSummary(timelineEvents);
      
      // Erstelle das aggregierte Datenpaket
      const aggregatedData: AggregatedData = {
        summary,
        timelineOverview: timelineEvents
      };
      
      // Speichere im Cache
      this.aggregationCache.set(dateKey, aggregatedData);
      console.log(`[AggregationService] Aggregation for ${dateKey} successful.`);
      return true;
    } catch (error) {
      console.error(`[AggregationService] Error aggregating data for ${dateKey}:`, error);
      return false;
    }
  }
  
  /**
   * Ruft die aggregierten Daten für einen Tag ab.
   * Versucht zuerst den Cache zu verwenden, aggregiert bei Bedarf neu.
   * @param dateKey Der Datums-Key für den Tag.
   * @returns Die aggregierten Daten oder undefined, wenn keine Daten existieren.
   */
  getAggregatedData(dateKey: string): AggregatedData | undefined {
    // Prüfe, ob die Daten im Cache sind
    if (this.aggregationCache.has(dateKey)) {
      return this.aggregationCache.get(dateKey);
    }
    
    // Wenn nicht, aggregiere die Daten neu
    if (this.aggregateDay(dateKey)) {
      return this.aggregationCache.get(dateKey);
    }
    
    return undefined;
  }
  
  /**
   * Ruft die Daten für einen Tag mit aggregierten Daten ab.
   * @param dateKey Der Datums-Key für den Tag.
   * @returns Ein DayData-Objekt mit Heartbeats und aggregierten Daten, oder null.
   */
  getDayDataWithAggregation(dateKey?: string | null): DayData | null {
    // Wenn kein Datums-Key angegeben ist, verwende den aktuellen Tag
    const effectiveDateKey = dateKey || this.getCurrentDateKey();
    
    // Lade Basisdaten
    const dayData = this.activityStorage.getDayData(effectiveDateKey);
    if (!dayData) {
      return null;
    }
    
    // Füge aggregierte Daten hinzu, wenn vorhanden
    const aggregated = this.getAggregatedData(effectiveDateKey);
    if (aggregated) {
      dayData.aggregated = aggregated;
    }
    
    return dayData;
  }
  
  /**
   * Hilfsmethode zum Abrufen des aktuellen Datums-Keys.
   * @returns Der aktuelle Datums-Key.
   */
  private getCurrentDateKey(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const day = now.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
} 