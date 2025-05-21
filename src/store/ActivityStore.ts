/**
 * @fileoverview
 * Enthält nur die früheren Typdefinitionen aus ActivityStore für Kompatibilität.
 * Diese Datei ist für den Übergang zur neuen modularen Architektur.
 * Neue Code sollte die Klassen im neuen Modell direkt verwenden.
 */

// ---- TYPE DEFINITIONS ----

// Export this type so it can be shared
export interface AppWindowData {
  app: string;
  title: string;
}

export interface HeartbeatData {
  userActivity?: 'active' | 'may_be_inactive' | 'inactive';
  appWindow?: AppWindowData | null;
}

export interface Heartbeat {
  timestamp: number;
  data: HeartbeatData;
}

export interface TimelineEvent {
    timestamp: number;
    duration: number;
    type: string; // 'teamsMeeting', 'inactive', 'appWindow' etc.
    data: any; // Specific data depends on 'type'
}

export interface AggregationSummary {
    activeTrackingDuration: number;
    totalActiveDuration: number;
    totalInactiveDuration: number;
    totalMeetingDuration: number;
    appUsage: { [appName: string]: number };
}

export interface AggregatedData {
    summary: AggregationSummary;
    timelineOverview: TimelineEvent[];
}

export interface DayData {
  heartbeats: Heartbeat[];
  aggregated?: AggregatedData;
}

export interface StoreData {
  version: number;
  startTime: number;
  lastCleanup: number;
  aggregationInterval: 5 | 10 | 15;
  days: { [dateKey: string]: Pick<DayData, 'heartbeats'> };
}

export interface StoreOptions {
  useMockData: boolean;
  storagePath: string | null;
}