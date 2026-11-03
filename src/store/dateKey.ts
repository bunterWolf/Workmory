/**
 * Generates a date key string (YYYY-MM-DD) from a timestamp.
 * IMPORTANT: Uses the *local* date components (year, month, day) of the timestamp.
 * This ensures that heartbeats are assigned to the correct calendar day from the user's perspective,
 * even if the timestamp occurs shortly after midnight local time but before midnight UTC.
 * Raw timestamps are stored in UTC (milliseconds since epoch), but grouping is done by local day.
 * Every day key in the main process (storage, aggregation cache) must come from here.
 * @param timestamp Timestamp in milliseconds since epoch (UTC).
 * @returns The date key string in YYYY-MM-DD format based on local time.
 */
export function toLocalDateKey(timestamp: number): string {
    const date = new Date(timestamp);
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0'); // getMonth() is 0-indexed
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
}
