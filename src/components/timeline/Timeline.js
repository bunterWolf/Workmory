// Figma: Container 2066:772 (scroll container), Content 2067:795 (event lane)
import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getHourHeight, getTimeRange, getGridMarks, getEventGeometry, getScrollTarget } from './timelineGeometry';
import TimelineHourGrid from './TimelineHourGrid';
import TimelineEvent from './TimelineEvent';
import { toLocalDateKey } from '../dateKey';
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
  // Scroll viewport height; short days grow their range to fill it (see getTimeRange).
  const [viewportHeight, setViewportHeight] = useState(0);

  // Format hour for the gutter labels (locale-aware)
  const formatHour = (hour) => {
    const date = new Date();
    date.setHours(hour, 0, 0, 0);
    return t('timeFormats.time', { time: date });
  };

  // Update tracking block every minute, only when tracking today. The minute timer is not
  // aligned to the interval end, so also recompute when new data arrives: an aggregation
  // lands exactly when an interval ends, and the block must move to the next interval then.
  useEffect(() => {
    const todayDateKey = toLocalDateKey();
    if (!isTracking || displayedDate !== todayDateKey) {
      if (currentTrackingBlock) setCurrentTrackingBlock(null);
      return;
    }

    const updateTrackingBlock = () => {
      if (displayedDate === toLocalDateKey()) {
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
  }, [isTracking, aggregationInterval, displayedDate, activityData, t]);

  const timelineEvents = activityData?.aggregated?.timelineOverview || [];
  const isToday = displayedDate === toLocalDateKey();

  const hasContent = timelineEvents.length > 0 || currentTrackingBlock !== null;

  // Track the scroll viewport's height while the timeline is mounted.
  useLayoutEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    const measure = () => setViewportHeight(container.clientHeight);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(container);
    return () => observer.disconnect();
  }, [isLoading, hasContent]);

  // ---- Time → pixel geometry (layout offsets live in Timeline.css) ----
  // Interval-aware sizing: finer zoom → taller hours → roomier short blocks.
  const hourHeight = getHourHeight(aggregationInterval);
  const pxPerMin = hourHeight / 60;
  const { startMin, endMin } = hasContent
    ? getTimeRange({
        events: timelineEvents,
        trackingBlock: currentTrackingBlock,
        isToday,
        pxPerMin,
        viewportContentHeight: Math.max(0, viewportHeight - 2 * TL_PAD_Y),
      })
    : { startMin: 0, endMin: 0 };
  const gridMarks = getGridMarks(startMin, endMin, pxPerMin);
  const totalHeight = (endMin - startMin) * pxPerMin;
  const trackingGeometry = currentTrackingBlock ? getEventGeometry(currentTrackingBlock, startMin, pxPerMin) : null;

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
  if (!hasContent) {
    return (
      <div className="wm-timeline-empty text-m-default">{t('noActivity')}</div>
    );
  }

  return (
    <div ref={scrollRef} className="wm-timeline">
      <div className="wm-timeline-content" style={{ height: totalHeight }}>
        <TimelineHourGrid marks={gridMarks} formatHour={formatHour} />
        <div className="wm-timeline-lane">
          {timelineEvents.map((event, index) => (
            <TimelineEvent
              key={event.id != null ? event.id : index}
              event={event}
              geometry={getEventGeometry(event, startMin, pxPerMin)}
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
