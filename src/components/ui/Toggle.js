// Figma: Toggle 84699:3534
import React from 'react';
import './Toggle.css';

export default function Toggle({ on, onChange, ariaLabel }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={ariaLabel}
      className={`wm-toggle ${on ? 'wm-toggle-on' : 'wm-toggle-off'}`}
      onClick={() => onChange(!on)}
    >
      <span className="wm-toggle-knob" />
    </button>
  );
}
