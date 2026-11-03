// Renderer date keys, 'YYYY-MM-DD' in LOCAL time. Same semantics as
// ActivityStore.getDateKey (local date parts), so "today" in the UI is the same day
// the store files heartbeats under. Never use toISOString() for this: it is UTC and
// names the wrong day for hours around midnight.
export function toLocalDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Key of the calendar day before `now`, via local date arithmetic (not ms subtraction,
// which is off by an hour on DST days).
export function getYesterdayDateKey(now = new Date()) {
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  return toLocalDateKey(yesterday);
}
