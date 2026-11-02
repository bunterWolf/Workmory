// Figma: Container 2066:772 (scroll container), Content 2067:795 (event lane)
import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import ravenLogo from '../../assets/logo/rabe-raven.png';
import { getHourHeight, getHourRange, getEventGeometry, getScrollTarget } from './timelineGeometry';
import TimelineHourGrid from './TimelineHourGrid';
import TimelineEvent from './TimelineEvent';
import './Timeline.css';

// Mirrors --tl-pad-y in Timeline.css (Figma 2066:772, container padding top/bottom).
const TL_PAD_Y = 30;

const Timeline = ({
  activityData,
  isLoading,
  formatDuration,
  aggregationInterval = 15,
  isTracking = false,
  displayedDate,
  currentActivityTitle = null,
  // False until App has loaded tracking state and interval (hour height depends on them).
  isInitialized = true,
}) => {
  const { t } = useTranslation();
  const [currentTrackingBlock, setCurrentTrackingBlock] = useState(null);
  // Native scroll container; used by the auto-scroll to the running block.
  const scrollRef = useRef(null);
  // Date key the auto-scroll already ran for; reset when leaving today.
  const scrolledDateRef = useRef(null);

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

  // Scroll to the running block once per "today" view (first appearance of the block,
  // or coming back to today). Minute ticks, reloads and interval changes must not
  // re-scroll, so the effect only depends on whether a block is shown, not on its position.
  // It waits for fresh data and for App's init, so the geometry is final.
  const hasTrackingBlock = trackingGeometry !== null;
  useLayoutEffect(() => {
    if (!isToday) {
      scrolledDateRef.current = null;
      return;
    }
    const container = scrollRef.current;
    if (isLoading || !isInitialized || !hasTrackingBlock || !container) return;
    if (scrolledDateRef.current === displayedDate) return;
    container.scrollTop = getScrollTarget({
      blockTop: trackingGeometry.top,
      blockHeight: trackingGeometry.height,
      viewportHeight: container.clientHeight,
      padY: TL_PAD_Y,
    });
    scrolledDateRef.current = displayedDate;
  }, [isToday, displayedDate, hasTrackingBlock, isLoading, isInitialized]);

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
