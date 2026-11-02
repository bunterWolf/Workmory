// Figma: Button 84671:1463 (trigger), SliderDropDownText 84672:1736 (marks).
// The flyout itself has no Figma design yet (spec 7.2 TODO): slider and structure are unchanged.
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import Button from '../ui/Button';
import './IntervalPicker.css';

// Slider order: 15m (left) to 5m (right)
const INTERVALS = [15, 10, 5];

export default function IntervalPicker({ value, onChange }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const idx = Math.max(0, INTERVALS.indexOf(value));
  const pct = (idx / (INTERVALS.length - 1)) * 100;
  const label = t('aggregationInterval');

  const handleChange = (next) => {
    if (onChange) onChange(Number(next));
  };

  return (
    <div className="wm-interval-picker">
      <Button
        label={`${value}m`}
        onClick={() => setOpen((o) => !o)}
        ariaLabel={label}
        title={label}
      />
      {open && (
        <>
          <div className="wm-interval-scrim" onClick={() => setOpen(false)} />
          <div className="wm-interval-flyout">
            <span className="wm-interval-flyout-label text-m-default">{label}</span>
            <input
              type="range"
              min={0}
              max={INTERVALS.length - 1}
              step={1}
              value={idx}
              onChange={(e) => handleChange(INTERVALS[Number(e.target.value)])}
              className="wm-interval-slider"
              style={{ '--wm-interval-pct': pct + '%' }}
              aria-label={label}
            />
            <div className="wm-interval-marks">
              {INTERVALS.map((v) => (
                <span
                  key={v}
                  className={'wm-interval-mark text-m-default' + (v === value ? ' is-active' : '')}
                  onClick={() => handleChange(v)}
                >
                  {`${v}m`}
                </span>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
