// Figma: Button 84671:1463 (trigger). The open pill has no Figma design yet; it reuses
// ui/SegmentedControl (selected Ink on Surface 2, others Ink 3, as in SliderDropDownText 84672:1736).
// Click opens the pill in place, a choice applies and closes it; outside click or Esc closes.
import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Button from '../ui/Button';
import SegmentedControl from '../ui/SegmentedControl';
import './IntervalPicker.css';

// Pill order: 15m (left) to 5m (right)
const INTERVALS = [15, 10, 5];

export default function IntervalPicker({ value, onChange }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const pillRef = useRef(null);
  // Opened with Enter/Space (click event with detail 0): focus follows into and out of the pill.
  const viaKeyboardRef = useRef(false);
  const label = t('aggregationInterval');

  // Set on close; the button can take focus only once it is visible again (after render).
  const restoreFocusRef = useRef(false);

  const close = (returnFocus) => {
    restoreFocusRef.current = returnFocus && viaKeyboardRef.current;
    setOpen(false);
  };

  // Keyboard users land on the selected option, and back on the button when it closes.
  useLayoutEffect(() => {
    if (open && viaKeyboardRef.current) pillRef.current?.focus();
    if (!open && restoreFocusRef.current) {
      restoreFocusRef.current = false;
      rootRef.current?.querySelector('.wm-button')?.focus();
    }
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (event) => {
      if (!rootRef.current?.contains(event.target)) close(false);
    };
    const onKeyDown = (event) => {
      if (event.key === 'Escape') close(true);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  // A click or Enter applies and closes; arrow keys apply and keep the pill open for the next step.
  const handleSelect = (next, { viaArrowKey } = {}) => {
    if (next !== value && onChange) onChange(next);
    if (!viaArrowKey) close(true);
  };

  return (
    <div className={'wm-interval-picker' + (open ? ' is-open' : '')} ref={rootRef}>
      {/* Stays in the layout while open, so the toolbar does not shift; the pill covers it. */}
      <Button
        label={`${value}m`}
        onClick={(event) => {
          viaKeyboardRef.current = event.detail === 0;
          setOpen(true);
        }}
        ariaLabel={label}
        title={label}
      />
      {open && (
        <div className="wm-interval-pill">
          {/* Names what the choice changes; the radiogroup carries the same text as its aria-label */}
          <span className="wm-interval-pill-label text-m-default" aria-hidden="true">{label}</span>
          <SegmentedControl
            ref={pillRef}
            className="wm-segmented--toolbar"
            ariaLabel={label}
            value={value}
            onChange={handleSelect}
            options={INTERVALS.map((v) => ({ value: v, label: `${v}m` }))}
          />
        </div>
      )}
    </div>
  );
}
