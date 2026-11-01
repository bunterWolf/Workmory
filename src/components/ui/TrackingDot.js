// Figma: Tracking dot 84678:838
import React from 'react';
import './TrackingDot.css';

// Pulsing dot for the running block: a static dot with a growing, fading dot on top.
export default function TrackingDot() {
  return (
    <span className="wm-tracking-dot" aria-hidden="true">
      <span className="wm-tracking-dot-base" />
      <span className="wm-tracking-dot-pulse" />
    </span>
  );
}
