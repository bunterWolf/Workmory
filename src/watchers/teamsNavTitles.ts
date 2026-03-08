/**
 * Known Teams navigation tab titles (DE + EN).
 * Used to filter out nav tab names from meeting title extraction.
 * These are empirically verified from live testing.
 */
export const TEAMS_NAV_TITLES = new Set([
  'chat',
  'besprechungen', 'meetings',
  'kontakte', 'contacts', 'personen', 'people',
  'communitys', 'communities', 'community',
  'kalender', 'calendar',
  'aktivität', 'aktivitäten', 'activity',
  'dateien', 'files',
  'anrufe', 'calls',
  'teams', 'microsoft teams',
  // Teams UI mode descriptors (not meeting names)
  'kompakte besprechungsansicht', 'compact meeting view',
]);

/**
 * Extracts the meeting title from a Teams window title.
 * Teams window titles follow the pattern: "Meeting Name | Microsoft Teams"
 * or "UI Mode | Meeting Name | Microsoft Teams" (e.g. compact view).
 *
 * Strategy: strip "| Microsoft Teams", split by "|", check segments right-to-left,
 * return the first segment that is not a known nav title.
 */
export function extractMeetingTitle(windowTitle: string): string | null {
  const stripped = windowTitle.replace(/\s*\|\s*Microsoft Teams\s*$/, '').trim();
  if (!stripped) return null;

  const segments = stripped.split('|').map(s => s.trim()).reverse();
  for (const segment of segments) {
    if (segment && !TEAMS_NAV_TITLES.has(segment.toLowerCase())) {
      return segment;
    }
  }
  return null;
}
