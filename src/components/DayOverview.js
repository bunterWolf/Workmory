import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import './DayOverview.css';

const DayOverview = ({ activityData, isLoading, formatDuration, aggregationInterval = 15, isTracking = false, displayedDate }) => {
  const { t, i18n } = useTranslation();
  const [currentTrackingBlock, setCurrentTrackingBlock] = useState(null);
  
  // Helper to get today's date key
  const getTodayDateKey = () => new Date().toISOString().split('T')[0];
  
  // Generate array of hour numbers from 8 to 17 (8 AM to 5 PM)
  const defaultTimelineHours = Array.from({ length: 10 }, (_, i) => i + 8);
  
  // Calculate hour height based on aggregation interval
  const getHourHeight = () => {
    const MIN_BLOCK_HEIGHT = 20; // Minimum height constant in pixels
    return MIN_BLOCK_HEIGHT * (60 / aggregationInterval);
  };
  
  // Format hour for display
  const formatHour = (hour) => {
    const date = new Date();
    date.setHours(hour, 0, 0, 0);
    return t('timeFormats.time', { time: date });
  };
  
  // Format time to show
  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    return t('timeFormats.time', { time: date });
  };
  
  // Update tracking block every minute only if tracking is active and it's today
  useEffect(() => {
    const todayDateKey = getTodayDateKey();
    if (!isTracking || displayedDate !== todayDateKey) {
        // Clear any existing tracking block if tracking stops or date changes away from today
        if (currentTrackingBlock) {
            setCurrentTrackingBlock(null);
        }
        return; // Don't calculate or set interval if not tracking today
    }

    const updateTrackingBlock = () => {
      // Double-check inside interval in case date changes while interval is running
      if (displayedDate === getTodayDateKey()) {
          const now = new Date();
          // Round down to the nearest interval
          const minutes = now.getMinutes();
          const intervalStart = Math.floor(minutes / aggregationInterval) * aggregationInterval;
          
          const blockStart = new Date(now);
          blockStart.setMinutes(intervalStart);
          blockStart.setSeconds(0);
          blockStart.setMilliseconds(0);
          
          // Formatierung direkt hier statt Aufruf von formatTime
          const formatTimeInner = (timestamp) => {
            const date = new Date(timestamp);
            return t('timeFormats.time', { time: date });
          };
    
          setCurrentTrackingBlock({
            timestamp: blockStart.getTime(),
            duration: aggregationInterval * 60 * 1000, // Convert minutes to milliseconds
            type: 'tracking',
            title: t('trackingActivities'),
            subTitle: '',
            formattedStartTime: formatTimeInner(blockStart),
            formattedEndTime: formatTimeInner(blockStart.getTime() + (aggregationInterval * 60 * 1000))
          });
      } else {
           setCurrentTrackingBlock(null); // Clear if date changed
      }
    };

    updateTrackingBlock(); // Initial calculation
    const interval = setInterval(updateTrackingBlock, 60000); // Update every minute

    return () => clearInterval(interval);
  }, [isTracking, aggregationInterval, displayedDate, t]); // Removed formatTime from dependencies
  
  // If loading, show loading indicator
  if (isLoading) {
    return <div className="loading">Loading activity data...</div>;
  }
  
  // Process timeline events from the aggregated data, default to empty array if no data
  const timelineEvents = activityData?.aggregated?.timelineOverview || [];
  
  // Determine the time range to display
  let minHour, maxHour;
  const todayDateKey = getTodayDateKey();
  const isToday = displayedDate === todayDateKey;

  if (timelineEvents.length === 0) {
    // Case 1: No events
    if (isToday && currentTrackingBlock) {
      // Today and tracking: Center around current block
      const blockStartHour = new Date(currentTrackingBlock.timestamp).getHours();
      minHour = Math.max(0, blockStartHour - 1); // One hour before
      maxHour = Math.min(23, blockStartHour + 2); // Two hours after
    } else {
      // Not today, or today but not tracking: Small default range
      minHour = 8;
      maxHour = 12; // Show 8 AM to 12 PM
    }
  } else {
    // Case 2: Events exist - determine range based on events
    const eventStartHours = timelineEvents.map(event => new Date(event.timestamp).getHours());
    const eventEndHours = timelineEvents.map(event => {
      const endTimestamp = event.timestamp + event.duration;
      const endHour = new Date(endTimestamp).getHours();
      const endMinute = new Date(endTimestamp).getMinutes();
      // If event ends exactly on the hour, we don't need the next hour slot necessarily,
      // unless it's the only event. However, adding +1 keeps consistent padding.
      return endMinute > 0 ? endHour + 1 : endHour + 1; // +1 includes the hour slot the event ends within or slightly overlaps
    });
    
    // Initial range from events with padding
    let eventMinHour = Math.max(0, Math.min(...eventStartHours) -1); // Add 1 hour padding before
    let eventMaxHour = Math.min(23, Math.max(...eventEndHours)); // Max ensures the end hour slot is included

    // If it's today, ensure the current time (if tracking) is visible
    if (isToday && currentTrackingBlock) {
        const blockStartHour = new Date(currentTrackingBlock.timestamp).getHours();
        // Ensure the range includes at least one hour before and two after the current block
        minHour = Math.min(eventMinHour, Math.max(0, blockStartHour - 1));
        maxHour = Math.max(eventMaxHour, Math.min(23, blockStartHour + 2));
    } else {
        minHour = eventMinHour;
        maxHour = eventMaxHour;
    }
    
    // Add additional padding if we have very long events (existing logic)
    const longestEventDuration = Math.max(...timelineEvents.map(event => event.duration));
    const longestEventHours = Math.ceil(longestEventDuration / (60 * 60 * 1000));
    if (longestEventHours > 4) { // If we have events longer than 4 hours
      maxHour = Math.min(23, maxHour + Math.floor(longestEventHours / 2)); // Add extra padding
    }
  }
  
  // Ensure min/max are valid and have a minimum span (e.g., 3 hours)
  minHour = Math.max(0, minHour);
  maxHour = Math.min(23, maxHour);
  maxHour = Math.max(maxHour, minHour + 3); // Ensure at least a 3-hour visible range
  maxHour = Math.min(23, maxHour); // Re-clamp maxHour after adding span

  // Generate hours array based on the calculated range
  const timelineHours = Array.from({ length: maxHour - minHour + 1 }, (_, i) => i + minHour);
  
  // Get height for the timeline based on hours
  const getTimelineHeight = () => {
    return timelineHours.length * getHourHeight();
  };
  
  // Render hour markers for the timeline
  const renderHourMarkers = () => {
    return timelineHours.map(hour => (
      <div 
        key={hour} 
        className="hour-marker"
        style={{ top: (hour - timelineHours[0]) * getHourHeight() }}
      />
    ));
  };
  
  // Get styling for an event based on its time position and duration
  const getEventStyle = (event) => {
    const startHour = new Date(event.timestamp).getHours();
    const startMinute = new Date(event.timestamp).getMinutes();
    const durationHours = event.duration / (60 * 60 * 1000);
    
    // Calculate top position relative to the first hour in the timeline
    const hourOffset = startHour - timelineHours[0];
    const minuteOffset = startMinute / 60;
    const top = (hourOffset + minuteOffset) * getHourHeight();
    
    // Calculate height based on duration
    const height = durationHours * getHourHeight();
    
    return {
      top: `${top}px`,
      height: `${height}px`
    };
  };
  
  // Map timeline events to display format
  const events = timelineEvents.map(event => {
    const startTime = formatTime(event.timestamp);
    const endTime = formatTime(event.timestamp + event.duration);
    
    let type, title, subTitle;
    
    switch (event.type) {
      case 'appWindow':
        type = 'primaryWindow';
        title = event.data.app;
        subTitle = event.data.title;
        break;
      case 'teamsMeeting':
        type = 'teams_meeting';
        title = event.data.title;
        subTitle = 'Teams Meeting';
        break;
      case 'inactive':
        type = 'inactive';
        title = 'Inactive';
        subTitle = event.data.reason || 'No activity detected';
        break;
      default:
        type = 'unknown';
        title = 'Unknown Activity';
        subTitle = '';
    }
    
    return {
      ...event,
      type,
      title,
      subTitle,
      formattedStartTime: startTime,
      formattedEndTime: endTime
    };
  });
  
  return (
    <div className="day-overview">
      <div className="timeline" style={{ height: getTimelineHeight() }}>
        {timelineHours.map(hour => (
          <div key={hour} className="timeline-hour" style={{ height: `${getHourHeight()}px` }}>
            {formatHour(hour)}
          </div>
        ))}
      </div>
      
      <div className="events-container" style={{ height: getTimelineHeight() }}>
        {renderHourMarkers()}
        <div className="events-content">
          {events.map((event, index) => (
            <div 
              key={index} 
              className={`event ${event.type}`}
              style={getEventStyle(event)}
            >
              <div className="event-title">
                {event.title} {event.subTitle && (<span className="event-subtitle">{event.subTitle}</span>)}
              </div>
              
              <div className="event-time">
                {event.formattedStartTime} - {event.formattedEndTime}
              </div>
              
              <div className="event-duration">
                {formatDuration(event.duration)}
              </div>
            </div>
          ))}
          {/* Render tracking block only if it exists (logic moved to useEffect) */}
          {currentTrackingBlock && (
            <div 
              className="event tracking"
              style={getEventStyle(currentTrackingBlock)}
            >
              <div className="event-title">
                {currentTrackingBlock.title}
              </div>
              
              <div className="event-time">
                {currentTrackingBlock.formattedStartTime} - {currentTrackingBlock.formattedEndTime}
              </div>
              
              <div className="event-duration">
                {formatDuration(currentTrackingBlock.duration)}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DayOverview; 