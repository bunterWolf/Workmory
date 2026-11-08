import type { ActivityState } from './ActivityState';
import type { Heartbeat, HeartbeatData } from './ActivityStore';

export const ABSENCE_THRESHOLD_MS = 10 * 60 * 1000;

/**
 * Behandelt may_be_inactive Heartbeats wenn ein inactive Status erkannt wurde
 * @param {Heartbeat[]} heartbeats - Liste von Heartbeats
 * @param {number} currentTimestamp - Timestamp des aktuellen Heartbeats
 * @param {HeartbeatData} heartbeatData - Daten des aktuellen Heartbeats
 * @returns {Heartbeat[]} Aktualisierte Liste von Heartbeats (kann dieselbe Referenz sein, wenn nichts geändert wurde)
 */
// Add type annotations
export function handleMayBeInactive(heartbeats: Heartbeat[], currentTimestamp: number, heartbeatData: HeartbeatData): Heartbeat[] {
  // Only proceed if the current heartbeat indicates inactivity and there are heartbeats to check
  if (!heartbeats || heartbeats.length === 0 || heartbeatData.userActivity !== 'inactive') {
      return heartbeats;
  }

  // Check if there are any 'may_be_inactive' heartbeats to potentially change
  const hasMayBeInactive = heartbeats.some(hb => hb.data?.userActivity === 'may_be_inactive');
  if (!hasMayBeInactive) {
      return heartbeats; // No changes needed
  }


  // Kopie der Heartbeats erstellen, da wir sie potenziell modifizieren
  const updatedHeartbeats = [...heartbeats];

  // Finde den Index des letzten 'active' Heartbeats *vor* dem aktuellen Inaktivitäts-Timestamp
  let lastActiveIndex = -1;
  for (let i = updatedHeartbeats.length - 1; i >= 0; i--) {
    const hb = updatedHeartbeats[i];
    // Skip heartbeats at or after the current inactive one
    if (hb.timestamp >= currentTimestamp) continue;

    // Found the last active period
    if (hb.data?.userActivity === 'active') {
      lastActiveIndex = i;
        break;
    }
  }

  let changed = false;
  // Alle 'may_be_inactive' Heartbeats *nach* dem letzten 'active' (oder vom Anfang an, falls keiner gefunden wurde)
  // und *vor* dem aktuellen Inaktivitäts-Timestamp zu 'inactive' konvertieren
  for (let i = lastActiveIndex + 1; i < updatedHeartbeats.length; i++) {
    const hb = updatedHeartbeats[i];
    // Stop when we reach the current heartbeat's timestamp
    if (hb.timestamp >= currentTimestamp) break;

    if (hb.data?.userActivity === 'may_be_inactive') {
      // Ensure data exists before spreading
      const existingData = hb.data || {};
      updatedHeartbeats[i] = {
        ...hb, // Spread the original heartbeat
        data: {
          ...existingData, // Spread its data
          userActivity: 'inactive' // Overwrite the status
        }
      };
      changed = true;
    }
  }

  // Return the updated array only if changes were made
  return changed ? updatedHeartbeats : heartbeats;
}


/**
 * Wandelt may_be_inactive vor `untilTs` in inactive um, tageübergreifend:
 * geht die Tage rückwärts und hört nach dem ersten Tag mit einem active davor auf.
 */
export function backfillAbsence(state: ActivityState, untilTs: number): void {
  const days = state.getAvailableDates();
  for (let i = days.length - 1; i >= 0; i--) {
    const heartbeats = state.getHeartbeats(days[i]);
    if (!heartbeats) continue;
    state.setHeartbeats(days[i], handleMayBeInactive([...heartbeats], untilTs, { userActivity: 'inactive' }));
    if (heartbeats.some(hb => hb.data?.userActivity === 'active' && hb.timestamp < untilTs)) return;
  }
}

/** Zeitstempel des letzten active-Heartbeats vor `beforeTs`, über alle Tage, sonst null. */
export function findLastActiveTimestamp(state: ActivityState, beforeTs: number): number | null {
  const days = state.getAvailableDates();
  for (let i = days.length - 1; i >= 0; i--) {
    const heartbeats = state.getHeartbeats(days[i]) ?? [];
    for (let j = heartbeats.length - 1; j >= 0; j--) {
      if (heartbeats[j].data?.userActivity === 'active' && heartbeats[j].timestamp < beforeTs) return heartbeats[j].timestamp;
    }
  }
  return null;
}
