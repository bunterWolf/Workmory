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
      
      // Calculate position and height based on time
      const startOfDay = new Date(startTime);
      startOfDay.setHours(0, 0, 0, 0);
      
      const msInDay = 24 * 60 * 60 * 1000;
      const startPercentage = ((startTime - startOfDay) / msInDay) * 100;
      const heightPercentage = ((endTime - startTime) / msInDay) * 100;
      
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
        startPercentage,
        heightPercentage,
        formattedStartTime,
        formattedEndTime
      };
    });
    
    setEvents(processedEvents);
  }, [activityData]);
  
  // Format time for display
  const formatHour = (hour) => {
    return `${hour}:00`;
  };
  
  // Set dynamic styles for an event based on its time
  const getEventStyle = (event) => {
    return {
      top: `${event.startPercentage}%`,
      height: `${Math.max(2, event.heightPercentage)}%`, // Minimum height for visibility
    };
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
        <div className="events-container">
          <div style={{ textAlign: 'center', padding: '2rem' }}>
            Loading activity data...
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
        <div className="events-container">
          <div style={{ textAlign: 'center', padding: '2rem' }}>
            No activity data for this day.
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
      
      <div className="events-container">
        {events.map((event, index) => (
          <div 
            key={index} 
            className={`event ${event.type}`}
            style={getEventStyle(event)}
          >
            <div className="event-title">
              {event.type === 'primaryWindow' ? event.title : 
               event.type === 'teams_meeting' ? event.title :
               'Inactive'}
            </div>
            
            {event.type === 'primaryWindow' && event.subTitle && (
              <div className="event-subtitle">{event.subTitle}</div>
            )}
            
            <div className="event-time">
              {event.formattedStartTime} - {event.formattedEndTime}
            </div>
            
            <div className="event-duration">
              {formatDuration(event.duration)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default DayOverview; 