/**
 * Callback-Typ für den Tageswechsel
 */
export type DayChangeHandler = (oldDateKey: string, newDateKey: string) => void;

/**
 * Verwaltet datumsbezogene Funktionalitäten und Tageswechsel.
 * Stellt Funktionen für die Datumskonvertierung und Tagesüberwachung bereit.
 */
export class DateManager {
  private currentDayKey: string;
  private dayChangeChecker: NodeJS.Timeout | null = null;
  private onDayChangeHandler: DayChangeHandler | null = null;

  constructor() {
    this.currentDayKey = this.getDateKey(Date.now());
  }

  /**
   * Generiert einen Datums-Key (YYYY-MM-DD) aus einem Zeitstempel.
   * WICHTIG: Verwendet die *lokalen* Datumskomponenten (Jahr, Monat, Tag) des Zeitstempels.
   * Dies stellt sicher, dass Heartbeats aus Benutzersicht dem richtigen Kalendertag zugeordnet werden,
   * auch wenn der Zeitstempel kurz nach Mitternacht Ortszeit, aber vor Mitternacht UTC auftritt.
   * Rohe Zeitstempel werden in UTC gespeichert (Millisekunden seit Epoche), die Gruppierung erfolgt jedoch nach lokalem Tag.
   * @param timestamp Zeitstempel in Millisekunden seit Epoche (UTC).
   * @returns Der Datums-Key als String im Format YYYY-MM-DD basierend auf der lokalen Zeit.
   */
  getDateKey(timestamp: number): string {
    const date = new Date(timestamp);
    // Verwende lokale Datumskomponenten, um Zeitzonen-Probleme um Mitternacht zu vermeiden
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0'); // getMonth() ist 0-indiziert
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  /**
   * Gibt den aktuellen Datums-Key zurück.
   * @returns Der aktuelle Datums-Key im Format YYYY-MM-DD.
   */
  getCurrentDayKey(): string {
    return this.currentDayKey;
  }

  /**
   * Aktualisiert den aktuellen Datums-Key basierend auf der aktuellen Zeit.
   */
  updateCurrentDayKey(): void {
    this.currentDayKey = this.getDateKey(Date.now());
  }

  /**
   * Startet die Überwachung von Tageswechseln und benachrichtigt Listener, wenn sich der Tag ändert.
   * Sollte einmal während der Anwendungsinitialisierung aufgerufen werden.
   * @param dayChangeHandler Optionale Callback-Funktion, um Tageswechsel zu behandeln
   */
  startDayChangeMonitoring(dayChangeHandler?: DayChangeHandler): void {
    // Prüft, ob bereits ein Intervall läuft
    if (this.dayChangeChecker !== null) {
      return;
    }

    // Speichere den Handler, falls übergeben
    if (dayChangeHandler) {
      this.onDayChangeHandler = dayChangeHandler;
    }

    console.log('[DateManager] Starting day change monitoring');
    this.currentDayKey = this.getDateKey(Date.now());
    
    // Alle 60 Sekunden prüfen, ob der Tag gewechselt hat
    this.dayChangeChecker = setInterval(() => {
      const newDateKey = this.getDateKey(Date.now());
      
      // Wenn sich der Tag geändert hat
      if (newDateKey !== this.currentDayKey) {
        console.log(`[DateManager] Day changed from ${this.currentDayKey} to ${newDateKey}`);
        
        // Rufe den externen Handler auf, falls vorhanden
        if (this.onDayChangeHandler) {
          this.onDayChangeHandler(this.currentDayKey, newDateKey);
        }

        // Aktuellen Tag aktualisieren
        this.currentDayKey = newDateKey;
      }
    }, 60000); // Prüfe einmal pro Minute
  }

  /**
   * Stoppt die Überwachung von Tageswechseln.
   * Sollte während der Anwendungsbereinigung aufgerufen werden.
   */
  stopDayChangeMonitoring(): void {
    if (this.dayChangeChecker !== null) {
      clearInterval(this.dayChangeChecker);
      this.dayChangeChecker = null;
      console.log('[DateManager] Stopped day change monitoring');
    }
  }

  /**
   * Führt Bereinigungsarbeiten durch.
   */
  cleanup(): void {
    this.stopDayChangeMonitoring();
  }
} 