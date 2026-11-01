// Figma: .Event-Master 2007:199 (variants: Inactive 84653:1247, Tracking 84722:2213)
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import TrackingDot from '../ui/TrackingDot';
import useAppIcon from './useAppIcon';
import { blendOver, readCssColorVar } from './eventColors';
import { useColorScheme } from './useColorScheme';
import './TimelineEvent.css';

// One timeline block. App windows (and legacy Teams meetings) get the app-color
// overlay and blended text color; inactive and the running block use --surface.
export default function TimelineEvent({ event, geometry, formatDuration, currentActivityTitle = null }) {
  const { t } = useTranslation();
  const isTracking = event.type === 'tracking';
  const isInactive = event.type === 'inactive';
  const isApp = !isTracking && !isInactive;

  // Hooks run on every render, before any branch.
  const iconData = useAppIcon(isApp ? event.data?.path : null);
  const colorScheme = useColorScheme();
  // Token values change with the theme, so re-read them when the scheme flips.
  const appColor = useMemo(
    () => (isApp ? iconData?.color || readCssColorVar('--ink-3') : null),
    [isApp, iconData, colorScheme]
  );
  const textColor = useMemo(
    () => (appColor ? blendOver(appColor, readCssColorVar('--event-ink-mix')) : null),
    [appColor, colorScheme]
  );

  const style = { top: geometry.top, height: geometry.height };
  let variant;
  let title;
  if (isTracking) {
    variant = 'tracking';
    title = currentActivityTitle ?? t('trackingActivities');
  } else if (isInactive) {
    variant = 'inactive';
    title = t('inactive');
  } else {
    variant = 'app';
    style['--app-color'] = appColor;
    style.color = textColor;
    title = event.type === 'teamsMeeting'
      ? (event.data?.title || t('teamsMeeting'))
      : (event.data?.title || event.data?.app || '');
  }

  return (
    <div className={`wm-timeline-event wm-timeline-event--${variant}`} style={style}>
      <div className="wm-timeline-event-inner">
        {isApp && <div className="wm-timeline-event-overlay" aria-hidden="true" />}
        <div className="wm-timeline-event-header">
          <div className="wm-timeline-event-title-group">
            {isTracking && <TrackingDot />}
            {isApp && iconData?.dataUrl && <img src={iconData.dataUrl} alt="" className="wm-timeline-event-icon" />}
            <span className="wm-timeline-event-title text-m-primary">{title}</span>
          </div>
          {!isTracking && (
            <span className="wm-timeline-event-duration text-m-primary tnum">{formatDuration(event.duration)}</span>
          )}
        </div>
      </div>
    </div>
  );
}
