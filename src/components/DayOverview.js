import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ipcRenderer } from 'electron';
import ravenLogo from '../assets/logo/rabe-raven.png';
import './DayOverview.css';

// Fixed, comfortable hour height for the redesigned timeline (design spec).
// Hour height scales inversely with the aggregation interval so that a single
// interval block always gets at least MIN_BLOCK_HEIGHT px — finer zoom (5 min)
// makes the hours taller, leaving enough room to display short blocks.
const MIN_BLOCK_HEIGHT = 24;
const getHourHeight = (intervalMin) => MIN_BLOCK_HEIGHT * (60 / intervalMin);

// Neutral tint for events without a resolvable icon (Teams meetings, unknown apps).
const NEUTRAL_COLOR = '#737373';

// Resolve real OS app icons via the main process, memoized by executable path.
const iconCache = new Map(); // path -> { dataUrl, color } | null
const iconPending = new Map(); // path -> Promise

function useAppIcon(path) {
  const [icon, setIcon] = useState(() => (path && iconCache.has(path) ? iconCache.get(path) : null));
  useEffect(() => {
    if (!path) { setIcon(null); return; }
    if (iconCache.has(path)) { setIcon(iconCache.get(path)); return; }
    let cancelled = false;
    let pending = iconPending.get(path);
    if (!pending) {
      pending = ipcRenderer
        .invoke('get-app-icon', path)
        .then((res) => { iconCache.set(path, res || null); iconPending.delete(path); return res || null; })
        .catch(() => { iconPending.delete(path); return null; });
      iconPending.set(path, pending);
    }
    pending.then((res) => { if (!cancelled) setIcon(res || null); });
    return () => { cancelled = true; };
  }, [path]);
  return icon;
}

const DayOverview = ({ activityData, isLoading, formatDuration, aggregationInterval = 15, isTracking = false, displayedDate }) => {
  const { t } = useTranslation();
  const [currentTrackingBlock, setCurrentTrackingBlock] = useState(null);

  const getTodayDateKey = () => new Date().toISOString().split('T')[0];

  // Format hour for the gutter labels (locale-aware)
  const formatHour = (hour) => {
    const date = new Date();
    date.setHours(hour, 0, 0, 0);
    return t('timeFormats.time', { time: date });
  };

  // Update tracking block every minute, only when tracking today
  useEffect(() => {
    const todayDateKey = getTodayDateKey();
    if (!isTracking || displayedDate !== todayDateKey) {
      if (currentTrackingBlock) setCurrentTrackingBlock(null);
      return;
    }

    const updateTrackingBlock = () => {
      if (displayedDate === getTodayDateKey()) {
        const now = new Date();
        const minutes = now.getMinutes();
        const intervalStart = Math.floor(minutes / aggregationInterval) * aggregationInterval;

        const blockStart = new Date(now);
        blockStart.setMinutes(intervalStart);
        blockStart.setSeconds(0);
        blockStart.setMilliseconds(0);

        setCurrentTrackingBlock({
          timestamp: blockStart.getTime(),
          duration: aggregationInterval * 60 * 1000,
          type: 'tracking'
        });
      } else {
        setCurrentTrackingBlock(null);
      }
    };

    updateTrackingBlock();
    const interval = setInterval(updateTrackingBlock, 60000);
    return () => clearInterval(interval);
  }, [isTracking, aggregationInterval, displayedDate, t]);

  if (isLoading) {
    return <div className="loading">{t('loading')}</div>;
  }

  const timelineEvents = activityData?.aggregated?.timelineOverview || [];
  const todayDateKey = getTodayDateKey();
  const isToday = displayedDate === todayDateKey;

  // Empty state — no events and nothing being tracked
  if (timelineEvents.length === 0 && !currentTrackingBlock) {
    return (
      <div className="wmk-empty">
        <img src={ravenLogo} alt="" className="wmk-empty-icon" />
        <div className="wm-h2" style={{ marginBottom: 8 }}>{t('noActivity')}</div>
        <div className="wm-body-sm" style={{ color: 'var(--fg-3)' }}>{t('noActivitySub')}</div>
      </div>
    );
  }

  // ---- Determine the hour range to display ----
  let minHour, maxHour;
  if (timelineEvents.length === 0) {
    if (isToday && currentTrackingBlock) {
      const blockStartHour = new Date(currentTrackingBlock.timestamp).getHours();
      minHour = Math.max(0, blockStartHour - 1);
      maxHour = Math.min(23, blockStartHour + 2);
    } else {
      minHour = 8;
      maxHour = 12;
    }
  } else {
    const eventStartHours = timelineEvents.map((e) => new Date(e.timestamp).getHours());
    const eventEndHours = timelineEvents.map((e) => new Date(e.timestamp + e.duration).getHours() + 1);

    let eventMinHour = Math.max(0, Math.min(...eventStartHours) - 1);
    let eventMaxHour = Math.min(23, Math.max(...eventEndHours));

    if (isToday && currentTrackingBlock) {
      const blockStartHour = new Date(currentTrackingBlock.timestamp).getHours();
      minHour = Math.min(eventMinHour, Math.max(0, blockStartHour - 1));
      maxHour = Math.max(eventMaxHour, Math.min(23, blockStartHour + 2));
    } else {
      minHour = eventMinHour;
      maxHour = eventMaxHour;
    }

    const longestEventDuration = Math.max(...timelineEvents.map((e) => e.duration));
    const longestEventHours = Math.ceil(longestEventDuration / (60 * 60 * 1000));
    if (longestEventHours > 4) {
      maxHour = Math.min(23, maxHour + Math.floor(longestEventHours / 2));
    }
  }

  minHour = Math.max(0, minHour);
  maxHour = Math.min(23, maxHour);
  maxHour = Math.max(maxHour, minHour + 3);
  maxHour = Math.min(23, maxHour);

  const timelineHours = Array.from({ length: maxHour - minHour + 1 }, (_, i) => i + minHour);

  // Interval-aware sizing: finer zoom → taller hours → roomier short blocks.
  const hourHeight = getHourHeight(aggregationInterval);
  const pxPerMin = hourHeight / 60;
  const totalHeight = timelineHours.length * hourHeight;

  // Position helper (top/height in px relative to first hour)
  const getEventGeometry = (event) => {
    const start = new Date(event.timestamp);
    const startMinFromMidnight = start.getHours() * 60 + start.getMinutes();
    const top = (startMinFromMidnight - minHour * 60) * pxPerMin;
    const height = Math.max(14, (event.duration / 60000) * pxPerMin - 2);
    return { top, height };
  };

  return (
    <div className="wmk-tl">
      <div className="wmk-tl-gutter" style={{ height: totalHeight }}>
        {timelineHours.map((h) => (
          <div key={h} className="wmk-tl-hr" style={{ height: hourHeight }}>
            <span className="wm-tnum">{formatHour(h)}</span>
          </div>
        ))}
      </div>

      <div className="wmk-tl-lane" style={{ height: totalHeight }}>
        {timelineHours.map((h) => (
          <div key={h} className="wmk-tl-tick" style={{ top: (h - minHour) * hourHeight }} />
        ))}
        <div className="wmk-tl-events">
          {timelineEvents.map((event, index) => {
            const geo = getEventGeometry(event);
            return (
              <EventBlock
                key={event.id != null ? event.id : index}
                event={event}
                style={{ top: geo.top, height: geo.height }}
                formatDuration={formatDuration}
                t={t}
              />
            );
          })}
          {currentTrackingBlock && (() => {
            const geo = getEventGeometry(currentTrackingBlock);
            return (
              <EventBlock
                event={currentTrackingBlock}
                style={{ top: geo.top, height: geo.height }}
                formatDuration={formatDuration}
                t={t}
              />
            );
          })()}
        </div>
      </div>
    </div>
  );
};

// Single timeline event block. One consistent layout/type scale for every block,
// regardless of height.
function EventBlock({ event, style, formatDuration, t }) {
  // Real OS icon (app windows only); hook runs every render before any branch.
  const iconData = useAppIcon(event.type === 'appWindow' ? event.data?.path : null);

  if (event.type === 'tracking') {
    return (
      <div className="wmk-ev wmk-ev-tracking" style={style}>
        <div className="wmk-ev-l">
          <div className="wmk-ev-title">
            <span className="wmk-ev-ttl-txt">{t('trackingActivities')}</span>
          </div>
        </div>
        <div className="wmk-ev-dur wm-tnum">{formatDuration(event.duration)}</div>
      </div>
    );
  }

  if (event.type === 'inactive') {
    return (
      <div className="wmk-ev wmk-ev-inactive" style={style}>
        <div className="wmk-ev-l">
          <div className="wmk-ev-title">
            <span className="wmk-ev-ttl-txt">{t('inactive')}</span>
          </div>
        </div>
        <div className="wmk-ev-dur wm-tnum">{formatDuration(event.duration)}</div>
      </div>
    );
  }

  // app window or teams meeting
  const isTeams = event.type === 'teamsMeeting';
  const color = iconData?.color || NEUTRAL_COLOR;
  const iconUrl = iconData?.dataUrl || null;
  const titleText = isTeams
    ? (event.data?.title || t('teamsMeeting'))
    : (event.data?.title || event.data?.app || '');

  return (
    <div className="wmk-ev wmk-ev-app" style={{ ...style, '--ev-color': color }}>
      <div className="wmk-ev-l">
        <div className="wmk-ev-title">
          {iconUrl && <img src={iconUrl} alt="" className="wmk-ev-icon" />}
          <span className="wmk-ev-ttl-txt">{titleText}</span>
        </div>
      </div>
      <div className="wmk-ev-dur wm-tnum">{formatDuration(event.duration)}</div>
    </div>
  );
}

export default DayOverview;
