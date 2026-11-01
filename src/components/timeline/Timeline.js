// Figma: Container 2066:772 (scroll container), Content 2067:795 (event lane)
import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import ravenLogo from '../../assets/logo/rabe-raven.png';
import { getHourHeight, getHourRange, getEventGeometry } from './timelineGeometry';
import TimelineHourGrid from './TimelineHourGrid';
import TimelineEvent from './TimelineEvent';
import './Timeline.css';

const Timeline = ({
  activityData,
  isLoading,
  formatDuration,
  aggregationInterval = 15,
  isTracking = false,
  displayedDate,
  currentActivityTitle = null,
}) => {
  const { t } = useTranslation();
  const [currentTrackingBlock, setCurrentTrackingBlock] = useState(null);
  // Native scroll container; used by the auto-scroll to the running block.
  const scrollRef = useRef(null);

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

  const timelineEvents = activityData?.aggregated?.timelineOverview || [];
  const isToday = displayedDate === getTodayDateKey();

  // ---- Time → pixel geometry (layout offsets live in Timeline.css) ----
  const { minHour, maxHour } = getHourRange({ events: timelineEvents, trackingBlock: currentTrackingBlock, isToday });
  const timelineHours = Array.from({ length: maxHour - minHour + 1 }, (_, i) => i + minHour);
  // Interval-aware sizing: finer zoom → taller hours → roomier short blocks.
  const hourHeight = getHourHeight(aggregationInterval);
  const pxPerMin = hourHeight / 60;
  const totalHeight = timelineHours.length * hourHeight;
  const trackingGeometry = currentTrackingBlock ? getEventGeometry(currentTrackingBlock, minHour, pxPerMin) : null;

  if (isLoading) {
    return <div className="wm-timeline-loading text-m-default">{t('loading')}</div>;
  }

  // Empty state — no events and nothing being tracked
  if (timelineEvents.length === 0 && !currentTrackingBlock) {
    return (
      <div className="wm-timeline-empty">
        <img src={ravenLogo} alt="" className="wm-timeline-empty-icon" />
        <div className="wm-timeline-empty-title text-xl-default">{t('noActivity')}</div>
        <div className="wm-timeline-empty-sub text-m-default">{t('noActivitySub')}</div>
      </div>
    );
  }

  return (
    <div ref={scrollRef} className="wm-timeline" style={{ '--hour-height': `${hourHeight}px` }}>
      <div className="wm-timeline-content" style={{ height: totalHeight }}>
        <TimelineHourGrid hours={timelineHours} hourHeight={hourHeight} formatHour={formatHour} />
        <div className="wm-timeline-lane">
          {timelineEvents.map((event, index) => (
            <TimelineEvent
              key={event.id != null ? event.id : index}
              event={event}
              geometry={getEventGeometry(event, minHour, pxPerMin)}
              formatDuration={formatDuration}
            />
          ))}
          {currentTrackingBlock && (
            <TimelineEvent
              event={currentTrackingBlock}
              geometry={trackingGeometry}
              formatDuration={formatDuration}
              currentActivityTitle={currentActivityTitle}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default Timeline;
