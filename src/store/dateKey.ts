/**
 * Date key (YYYY-MM-DD) of the local day a timestamp (ms since epoch) falls on.
 * Uses local date components to avoid timezone issues around midnight.
 */
export function toLocalDateKey(timestamp: number): string {
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0'); // getMonth() is 0-indexed
  const day = date.getDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
}
