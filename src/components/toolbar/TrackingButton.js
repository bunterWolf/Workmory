// Figma: ButtonTracking 84678:1437 (states: Tracking, Paused)
import React from 'react';
import { useTranslation } from 'react-i18next';
import Icon from '../ui/Icon';
import TrackingDot from '../ui/TrackingDot';
import '../ui/Button.css';
import './TrackingButton.css';

// One button element for both states, so keyboard focus survives a toggle. It reuses the
// Button styles (padding, radius, hover layer); only the Tracking face differs.
export default function TrackingButton({ isTracking, onToggle }) {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      className={'wm-button wm-tracking-button' + (isTracking ? ' is-tracking' : '')}
      onClick={onToggle}
      aria-pressed={isTracking}
      title={isTracking ? t('pauseTracking') : t('startTracking')}
    >
      {isTracking ? <TrackingDot /> : <Icon name="pause_circle" size={20} />}
      <span className="wm-button-label text-m-primary">
        {isTracking ? t('tracking') : t('paused')}
      </span>
    </button>
  );
}
