import type { ActivityState } from './ActivityState';
import type { Heartbeat } from './ActivityStore';

export const ABSENCE_THRESHOLD_MS = 10 * 60 * 1000;

// Idle under this counts as `active`, so the input lies within this window before an `active` heartbeat.
export const ACTIVE_WINDOW_MS = 60 * 1000;

// Heartbeats come every 30 s, so a larger gap means Workmory was not running or the PC slept; such a gap does not belong to the absence.
export const MAX_HEARTBEAT_GAP_MS = 2 * 60 * 1000;

/**
 * Wandelt may_be_inactive vor `untilTs` in inactive um, tageübergreifend, in einem Rückwärtslauf
 * (neueste zuerst). Der Lauf endet am ersten active-Heartbeat oder an einer Lücke
 * größer als MAX_HEARTBEAT_GAP_MS (Workmory lief nicht / PC schlief).
 */
export function backfillAbsence(state: ActivityState, untilTs: number): void {
  const days = state.getAvailableDates();
  let previous = untilTs;
  for (let d = days.length - 1; d >= 0; d--) {
    const heartbeats = state.getHeartbeats(days[d]) ?? [];
    let updated: Heartbeat[] | null = null;
    for (let i = heartbeats.length - 1; i >= 0; i--) {
      const hb = heartbeats[i];
      if (hb.timestamp >= untilTs) continue;
      if (previous - hb.timestamp > MAX_HEARTBEAT_GAP_MS || hb.data?.userActivity === 'active') {
        if (updated) state.setHeartbeats(days[d], updated);
        return;
      }
      if (hb.data?.userActivity === 'may_be_inactive') {
        updated ??= [...heartbeats];
        updated[i] = { ...hb, data: { ...hb.data, userActivity: 'inactive' } };
      }
      previous = hb.timestamp;
    }
    if (updated) state.setHeartbeats(days[d], updated);
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
