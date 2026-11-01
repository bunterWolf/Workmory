// Figma: Entry 2005:793 (row 84783:3209, label 84783:3210, half-hour marker 84783:3213)
import React from 'react';
import { getHalfHourOffset } from './timelineGeometry';

// One absolutely positioned hour label (with its hour line) per hour, plus a
// half-hour marker. Positions are relative to the timeline content box.
export default function TimelineHourGrid({ hours, hourHeight, formatHour }) {
  const halfHourOffset = getHalfHourOffset(hourHeight);
  return hours.map((hour, i) => (
    <React.Fragment key={hour}>
      <div className="wm-timeline-hour" style={{ top: i * hourHeight }}>
        <div className="wm-timeline-hour-label text-m-default">{formatHour(hour)}</div>
      </div>
      <div className="wm-timeline-half-marker" style={{ top: i * hourHeight + halfHourOffset }} />
    </React.Fragment>
  ));
}
