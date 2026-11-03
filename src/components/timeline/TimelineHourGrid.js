// Figma: Entry 2005:793 (row 84783:3209, label 84783:3210, half-hour marker 84783:3213)
import React from 'react';

// marks: [{ minute, top, isHour }] from getGridMarks. Full hours get the hour line
// with label, :30 marks the short half-hour marker. Positions are relative to the
// timeline content box.
export default function TimelineHourGrid({ marks, formatHour }) {
  return marks.map((mark) =>
    mark.isHour ? (
      <div key={mark.minute} className="wm-timeline-hour" style={{ top: mark.top }}>
        <div className="wm-timeline-hour-label text-m-default">{formatHour(mark.minute / 60)}</div>
      </div>
    ) : (
      <div key={mark.minute} className="wm-timeline-half-marker" style={{ top: mark.top }} />
    )
  );
}
