// Pure geometry helpers for the day timeline (hour height, visible hour range,
// event position, half-hour marker). Pinned by timelineGeometry.test.js — the
// timeline feeds billing, so keep behavior stable. getHourHeight and getHourRange
// are unchanged from the original DayOverview.js; getEventGeometry follows the
// Figma rules (1px offset below the hour line, full-duration height).

// Hour height scales inversely with the aggregation interval so that a single
// interval block always gets at least MIN_BLOCK_HEIGHT px — finer zoom (5 min)
// makes the hours taller, leaving enough room to display short blocks.
export const MIN_BLOCK_HEIGHT = 24;
export const getHourHeight = (intervalMin) => MIN_BLOCK_HEIGHT * (60 / intervalMin);

// Offset of the half-hour marker line from the top of an hour row.
export const getHalfHourOffset = (hourHeight) => Math.round(hourHeight / 2);

// Events sit 1px below the hour line; the visual gap between adjacent events
// comes from a 1px border on each event, not from reducing the height.
export const EVENT_OFFSET_Y = 1;
export const MIN_EVENT_HEIGHT = 14;

// Determine the hour range to display.
// events: [{ timestamp, duration }], trackingBlock: { timestamp, duration } | null
export function getHourRange({ events, trackingBlock, isToday }) {
  let minHour, maxHour;
  if (events.length === 0) {
    if (isToday && trackingBlock) {
      const blockStartHour = new Date(trackingBlock.timestamp).getHours();
      minHour = Math.max(0, blockStartHour - 1);
      maxHour = Math.min(23, blockStartHour + 2);
    } else {
      minHour = 8;
      maxHour = 12;
    }
  } else {
    const eventStartHours = events.map((e) => new Date(e.timestamp).getHours());
    const eventEndHours = events.map((e) => new Date(e.timestamp + e.duration).getHours() + 1);

    let eventMinHour = Math.max(0, Math.min(...eventStartHours) - 1);
    let eventMaxHour = Math.min(23, Math.max(...eventEndHours));

    if (isToday && trackingBlock) {
      const blockStartHour = new Date(trackingBlock.timestamp).getHours();
      minHour = Math.min(eventMinHour, Math.max(0, blockStartHour - 1));
      maxHour = Math.max(eventMaxHour, Math.min(23, blockStartHour + 2));
    } else {
      minHour = eventMinHour;
      maxHour = eventMaxHour;
    }

    const longestEventDuration = Math.max(...events.map((e) => e.duration));
    const longestEventHours = Math.ceil(longestEventDuration / (60 * 60 * 1000));
    if (longestEventHours > 4) {
      maxHour = Math.min(23, maxHour + Math.floor(longestEventHours / 2));
    }
  }

  minHour = Math.max(0, minHour);
  maxHour = Math.min(23, maxHour);
  maxHour = Math.max(maxHour, minHour + 3);
  maxHour = Math.min(23, maxHour);

  return { minHour, maxHour };
}

// Position helper (top/height in px relative to the first displayed hour).
export function getEventGeometry(event, minHour, pxPerMin) {
  const start = new Date(event.timestamp);
  const startMinFromMidnight = start.getHours() * 60 + start.getMinutes();
  const top = (startMinFromMidnight - minHour * 60) * pxPerMin + EVENT_OFFSET_Y;
  const height = Math.max(MIN_EVENT_HEIGHT, (event.duration / 60000) * pxPerMin);
  return { top, height };
}
