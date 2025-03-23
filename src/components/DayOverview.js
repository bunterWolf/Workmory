import React, { useEffect, useState } from 'react';

const DayOverview = ({ activityData, isLoading, formatDuration }) => {
  const [timelineHours, setTimelineHours] = useState([]);
  const [events, setEvents] = useState([]);
  
  // Generate timeline hours (8:00-17:00 by default, expanded as needed)
  useEffect(() => {
    if (!activityData || !activityData.daySummary || activityData.daySummary.length === 0) {
      // Default hours (8:00-17:00)
      const defaultHours = Array.from({ length: 10 }, (_, i) => i + 8);
      setTimelineHours(defaultHours);
      return;
    }
    
    // Find earliest and latest event time
    let earliestHour = 8; // Default start
    let latestHour = 17; // Default end
    
    activityData.daySummary.forEach(event => {
      const startDate = new Date(event.start);
      const endDate = new Date(event.end);
      
      const startHour = startDate.getHours();
      const endHour = endDate.getHours() + (endDate.getMinutes() > 0 ? 1 : 0);
      
      earliestHour = Math.min(earliestHour, startHour);
      latestHour = Math.max(latestHour, endHour);
    });
    
    // Expand to 8-17 if smaller
    earliestHour = Math.min(earliestHour, 8);
    latestHour = Math.max(latestHour, 17);
    
    // Generate all hours
    const hours = Array.from(
      { length: latestHour - earliestHour + 1 }, 
      (_, i) => i + earliestHour
    );
    
    setTimelineHours(hours);
  }, [activityData]);
  
  // Process events for display
  useEffect(() => {
    if (!activityData || !activityData.daySummary) {
      setEvents([]);
      return;
    }
    
    const processedEvents = activityData.daySummary.map(event => {
      // Convert timestamps to Date objects
      const startTime = new Date(event.start);
      const endTime = new Date(event.end);
      
      // Format times for display
      const formattedStartTime = startTime.toLocaleTimeString([], { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: false
      });
      
      const formattedEndTime = endTime.toLocaleTimeString([], { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: false
      });
      
      return {
        ...event,
        startTime,
        endTime,
        formattedStartTime,
        formattedEndTime
      };
    });
    
    setEvents(processedEvents);
  }, [activityData]);
  
  // Calculate timeline height based on hours
  const getTimelineHeight = () => {
    if (!timelineHours.length) return '600px'; // Default height
    const calculatedHeight = timelineHours.length * 60; // 60px per hour
    return calculatedHeight > 0 ? `${calculatedHeight}px` : '600px';
  };
  
  // Format time for display
  const formatHour = (hour) => {
    return `${hour}:00`;
  };
  
  // Set dynamic styles for an event based on its time
  const getEventStyle = (event) => {
    // Get the first (earliest) and last (latest) hour in the timeline
    const minHour = timelineHours[0];
    const maxHour = timelineHours[timelineHours.length - 1] + 1; // Add 1 to include the full last hour
    
    // Total height of the timeline in pixels (60px per hour)
    const hourHeight = 60; // height in pixels for one hour
    
    // Minutes since the start of the timeline
    const startHour = event.startTime.getHours();
    const startMinute = event.startTime.getMinutes();
    const hoursSinceStart = startHour - minHour;
    const minutesSinceStartOfHour = startMinute;
    
    // Calculate top position in pixels
    const topPosition = (hoursSinceStart * hourHeight) + (minutesSinceStartOfHour / 60 * hourHeight);
    
    // Calculate height based on duration
    const durationInMinutes = (event.endTime - event.startTime) / (60 * 1000);
    const heightInPixels = (durationInMinutes / 60) * hourHeight;
    
    return {
      top: `${topPosition}px`,
      height: `${Math.max(10, heightInPixels)}px`, // Minimum height for visibility
    };
  };
  
  // Create hour markers for the timeline
  const renderHourMarkers = () => {
    return timelineHours.map((hour, index) => (
      <div 
        key={`marker-${hour}`} 
        className="hour-marker" 
        style={{ top: `${index * 60}px` }} 
      />
    ));
  };
  
  // If loading, show placeholder
  if (isLoading) {
    return (
      <div className="day-overview">
        <div className="timeline">
          {timelineHours.map(hour => (
            <div key={hour} className="timeline-hour">
              {formatHour(hour)}
            </div>
          ))}
        </div>
        <div className="events-container" style={{ height: getTimelineHeight() }}>
          {renderHourMarkers()}
          <div className="events-content">
            <div style={{ textAlign: 'center', padding: '2rem' }}>
              Loading activity data...
            </div>
          </div>
        </div>
      </div>
    );
  }
  
  // If no data or empty day summary, show empty state
  if (!activityData || !activityData.daySummary || activityData.daySummary.length === 0) {
    return (
      <div className="day-overview">
        <div className="timeline">
          {timelineHours.map(hour => (
            <div key={hour} className="timeline-hour">
              {formatHour(hour)}
            </div>
          ))}
        </div>
        <div className="events-container" style={{ height: getTimelineHeight() }}>
          {renderHourMarkers()}
          <div className="events-content">
            <div style={{ textAlign: 'center', padding: '2rem' }}>
              No activity data for this day.
            </div>
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="day-overview">
      <div className="timeline">
        {timelineHours.map(hour => (
          <div key={hour} className="timeline-hour">
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
              <span className="event-title">
                {event.type === 'primaryWindow' ? event.title : 
                 event.type === 'teams_meeting' ? event.title :
                 'Inactive'}
              </span>
              
              {event.type === 'primaryWindow' && event.subTitle && (
                <span className="event-subtitle"> {event.subTitle}</span>
              )}
              
              <span className="event-time"> - {event.formattedStartTime} - {event.formattedEndTime}</span>
              
              <div className="event-duration">
                {formatDuration(event.duration)}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default DayOverview; 