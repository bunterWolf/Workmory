// Figma: .Event-Master 2007:199 (variants: Inactive 84653:1247, Tracking 84722:2213)
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import TrackingDot from '../ui/TrackingDot';
import useAppIcon from './useAppIcon';
import { eventPalette, readCssColorVar, readEventPaletteTokens, resolveAppColor } from './eventColors';
import { useColorScheme } from './useColorScheme';
import './TimelineEvent.css';

// Logged once instead of on every render. A render must never throw (there is no error
// boundary), so invalid tokens only degrade the event to the neutral styling from the CSS.
let reportedInvalidPalette = false;
function reportInvalidPalette(brandColor) {
  if (reportedInvalidPalette) return;
  reportedInvalidPalette = true;
  console.error(`Invalid event palette tokens or color ${JSON.stringify(brandColor)}; using the neutral event style.`);
}

function getAppPalette(iconColor) {
  const brandColor = resolveAppColor(iconColor, readCssColorVar('--event-default'));
  const palette = eventPalette(brandColor, readEventPaletteTokens());
  if (!palette) reportInvalidPalette(brandColor);
  return palette;
}

// One timeline block. App windows (and legacy Teams meetings) get colors computed from the
// app's hue; inactive and the running block use --surface.
export default function TimelineEvent({ event, geometry, formatDuration, currentActivityTitle = null }) {
  const { t } = useTranslation();
  const isTracking = event.type === 'tracking';
  const isInactive = event.type === 'inactive';
  const isApp = !isTracking && !isInactive;

  // Hooks run on every render, before any branch.
  const iconData = useAppIcon(isApp ? event.data?.path : null);
  const colorScheme = useColorScheme();
  // Token values change with the theme, so re-read them when the scheme flips.
  const palette = useMemo(
    () => (isApp ? getAppPalette(iconData?.color) : null),
    [isApp, iconData, colorScheme]
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
    if (palette) {
      style.background = palette.background;
      style.color = palette.text;
    }
    title = event.type === 'teamsMeeting'
      ? (event.data?.title || t('teamsMeeting'))
      : (event.data?.title || event.data?.app || '');
  }

  return (
    <div className={`wm-timeline-event wm-timeline-event--${variant}`} style={style}>
      <div className="wm-timeline-event-inner">
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
