// Figma: none yet (appearance setting, interval pill) — built from existing tokens; add a Figma component later.
import React, { forwardRef, useImperativeHandle, useRef } from 'react';
import './SegmentedControl.css';

// Single-choice segmented control. options: [{ value, label }].
// Arrow keys move the selection (radio group pattern); only the selected option is a tab stop.
// onChange(value, { viaArrowKey }) tells arrow-key steps apart from a click or Enter.
// className adds a size variant (e.g. the toolbar pill); ref.focus() focuses the selected option.
const SegmentedControl = forwardRef(function SegmentedControl({ options, value, onChange, ariaLabel, className = '' }, ref) {
  const optionRefs = useRef([]);
  const selectedIndex = Math.max(0, options.findIndex((o) => o.value === value));

  useImperativeHandle(ref, () => ({
    focus: () => optionRefs.current[selectedIndex]?.focus(),
  }), [selectedIndex]);

  const handleKeyDown = (event) => {
    const step = { ArrowLeft: -1, ArrowUp: -1, ArrowRight: 1, ArrowDown: 1 }[event.key];
    if (!step) return;
    event.preventDefault();
    const next = selectedIndex + step;
    if (next < 0 || next >= options.length) return;
    optionRefs.current[next]?.focus();
    onChange(options[next].value, { viaArrowKey: true });
  };

  return (
    <div className={`wm-segmented ${className}`.trim()} role="radiogroup" aria-label={ariaLabel} onKeyDown={handleKeyDown}>
      {options.map((option, index) => {
        const selected = index === selectedIndex;
        return (
          <button
            key={option.value}
            ref={(el) => { optionRefs.current[index] = el; }}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={selected ? 0 : -1}
            className={'wm-segmented-option text-m-primary' + (selected ? ' wm-segmented-option-selected' : '')}
            onClick={() => onChange(option.value, { viaArrowKey: false })}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
});

export default SegmentedControl;
