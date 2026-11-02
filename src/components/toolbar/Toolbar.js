// Figma: Toolbar 2005:832
import React from 'react';
import DateNav from './DateNav';
import IntervalPicker from './IntervalPicker';
import TrackingButton from './TrackingButton';
import './Toolbar.css';

export default function Toolbar({
  selectedDate,
  availableDates,
  onDateChange,
  isTracking,
  onToggleTracking,
  isMockData,
  aggregationInterval = 15,
  onIntervalChange,
}) {
  return (
    <header className="wm-toolbar">
      <DateNav selectedDate={selectedDate} availableDates={availableDates} onDateChange={onDateChange} />
      <div className="wm-toolbar-controls">
        <IntervalPicker value={aggregationInterval} onChange={onIntervalChange} />
        {/* No tracking toggle in mock mode: nothing is being tracked. */}
        {!isMockData && <TrackingButton isTracking={isTracking} onToggle={onToggleTracking} />}
      </div>
    </header>
  );
}
