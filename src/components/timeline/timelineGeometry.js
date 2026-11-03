// Pure geometry helpers for the day timeline (hour height, visible time range,
// grid marks, event position, scroll target). Pinned by timelineGeometry.test.js —
// the timeline feeds billing, so keep behavior stable. getEventGeometry follows the
// Figma rules (1px offset below the grid line, full-duration height).

// Hour height scales inversely with the aggregation interval so that a single
// interval block always gets at least MIN_BLOCK_HEIGHT px — finer zoom (5 min)
// makes the hours taller, leaving enough room to display short blocks.
export const MIN_BLOCK_HEIGHT = 24;
export const getHourHeight = (intervalMin) => MIN_BLOCK_HEIGHT * (60 / intervalMin);

// Events sit 1px below the grid line; the visual gap between adjacent events
// comes from a 1px border on each event, not from reducing the height.
export const EVENT_OFFSET_Y = 1;
export const MIN_EVENT_HEIGHT = 14;

// Visible time range: hug the content so nothing scrolls through empty time. The
// range starts at the first block and ends with the last one (running block today
// included); the visual breathing room is the container's own --tl-pad-y.
// Blocks start on interval boundaries and pxPerMin = MIN_BLOCK_HEIGHT / interval,
// so every event and grid line lands on a whole pixel.
export const GRID_STEP_MIN = 30;
const DAY_MIN = 24 * 60;

const minutesOfDay = (timestamp) => {
  const d = new Date(timestamp);
  return d.getHours() * 60 + d.getMinutes();
};

// Range in minutes since local midnight: { startMin, endMin }.
// events: [{ timestamp, duration }], trackingBlock: { timestamp, duration } | null
// viewportContentHeight: scroll viewport height minus its padding (0 = unknown).
// If the content is shorter than the viewport, the range grows in whole-block steps
// (downward, upward once it reaches midnight) until it fills the viewport — never
// beyond it, so filling the window never causes a scroll.
export function getTimeRange({ events, trackingBlock, isToday, pxPerMin, viewportContentHeight }) {
  const blocks = isToday && trackingBlock ? [...events, trackingBlock] : events;
  let startMin = Math.max(0, Math.min(...blocks.map((b) => minutesOfDay(b.timestamp))));
  let endMin = Math.min(DAY_MIN, Math.max(...blocks.map((b) => minutesOfDay(b.timestamp) + b.duration / 60000)));

  const fitMin = (Math.floor(viewportContentHeight / MIN_BLOCK_HEIGHT) * MIN_BLOCK_HEIGHT) / pxPerMin;
  if (fitMin > endMin - startMin) {
    endMin = Math.min(DAY_MIN, startMin + fitMin);
    startMin = Math.max(0, endMin - fitMin);
  }
  return { startMin, endMin };
}

// Grid marks on every :00 (hour line with label) and :30 (half-hour marker) from
// startMin up to (not including) endMin. top is relative to the content box.
export function getGridMarks(startMin, endMin, pxPerMin) {
  const marks = [];
  for (let minute = Math.ceil(startMin / GRID_STEP_MIN) * GRID_STEP_MIN; minute < endMin; minute += GRID_STEP_MIN) {
    marks.push({ minute, top: Math.round((minute - startMin) * pxPerMin), isHour: minute % 60 === 0 });
  }
  return marks;
}

// Position helper (top/height in px relative to the range start, in minutes since midnight).
export function getEventGeometry(event, rangeStartMin, pxPerMin) {
  const top = (minutesOfDay(event.timestamp) - rangeStartMin) * pxPerMin + EVENT_OFFSET_Y;
  const height = Math.max(MIN_EVENT_HEIGHT, (event.duration / 60000) * pxPerMin);
  return { top, height };
}

// scrollTop that brings the running block into view: its bottom edge ends up
// padY above the bottom of the scroll viewport. blockTop is relative to the
// content box (as returned by getEventGeometry), so the container's own
// top/bottom padding (padY) is added on both sides. Never negative.
export function getScrollTarget({ blockTop, blockHeight, viewportHeight, padY }) {
  return Math.max(0, padY + blockTop + blockHeight + padY - viewportHeight);
}
