// Figma: none yet (appearance setting) — built from existing tokens; add a Figma component later.
import React from 'react';
import './SegmentedControl.css';

// Single-choice segmented control. options: [{ value, label }].
export default function SegmentedControl({ options, value, onChange, ariaLabel }) {
  return (
    <div className="wm-segmented" role="radiogroup" aria-label={ariaLabel}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            className={'wm-segmented-option text-m-primary' + (selected ? ' wm-segmented-option-selected' : '')}
            onClick={() => !selected && onChange(option.value)}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
