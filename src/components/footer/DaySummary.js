// Figma: Status Bar 2052:157
import React from 'react';

// items: [{ value, label }] in display order (value is the already formatted duration).
export default function DaySummary({ items }) {
  return (
    <div className="wm-day-summary">
      {items.map(({ value, label }) => (
        <div className="wm-day-summary-item" key={label}>
          <span className="wm-day-summary-value text-m-primary tnum">{value}</span>
          <span className="wm-day-summary-label text-m-default">{label}</span>
        </div>
      ))}
    </div>
  );
}
