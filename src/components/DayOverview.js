import React from 'react';
import './DayOverview.css';

const DayOverview = ({ activityData, isLoading, formatDuration }) => {
  // Generate array of hour numbers from 8 to 17 (8 AM to 5 PM)
  const defaultTimelineHours = Array.from({ length: 10 }, (_, i) => i + 8);
  
  // Format hour for display (e.g., 8 -> "8:00", 13 -> "1:00 PM")
  const formatHour = (hour) => {
    if (hour === 12) {
      return '12:00 PM';
    } else if (hour < 12) {
      return `${hour}:00 AM`;
    } else {
      return `${hour - 12}:00 PM`;
    }
  };
  
  // Format time to show as "10:30 AM" etc.
  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    let hours = date.getHours();
    const minutes = date.getMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    
    hours = hours % 12;
    hours = hours ? hours : 12; // Convert 0 to 12
    
    return `${hours}:${minutes.toString().padStart(2, '0')} ${ampm}`;
  };
  
  // Get height for the timeline based on hours
  const getTimelineHeight = () => {
    return timelineHours.length * 60; // 60px per hour
  };
  
  // Render hour markers for the timeline
  const renderHourMarkers = () => {
    return timelineHours.map(hour => (
      <div 
        key={hour} 
        className="hour-marker"
        style={{ top: (hour - timelineHours[0]) * 60 }}
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
    const top = (hourOffset + minuteOffset) * 60;
    
    // Calculate height based on duration
    const height = durationHours * 60;
    
    return {
      top: `${top}px`,
      height: `${height}px`
    };
  };
  
  // If loading, show loading indicator
  if (isLoading) {
    return <div className="loading">Loading activity data...</div>;
  }
  
  // If no data or no aggregated data, show empty state
  if (!activityData || !activityData.aggregated || !activityData.aggregated.timelineOverview || activityData.aggregated.timelineOverview.length === 0) {
    return (
      <div className="empty-state">
        <h3>No activity data for this day</h3>
        <p>There is no tracking data available for the selected date.</p>
      </div>
    );
  }
  
  // Process timeline events from the aggregated data
  const timelineEvents = activityData.aggregated.timelineOverview;
  
  // Determine the time range to display
  let minHour = 8; // Default start hour (8 AM)
  let maxHour = 17; // Default end hour (5 PM)
  
  // Adjust time range based on actual data
  if (timelineEvents.length > 0) {
    const eventStartHours = timelineEvents.map(event => new Date(event.timestamp).getHours());
    const eventEndHours = timelineEvents.map(event => {
      const endTimestamp = event.timestamp + event.duration;
      const endHour = new Date(endTimestamp).getHours();
      const endMinute = new Date(endTimestamp).getMinutes();
      return endMinute > 0 ? endHour + 1 : endHour; // Round up if there are minutes
    });
    
    minHour = Math.max(0, Math.min(...eventStartHours) - 1); // One hour earlier than earliest event
    maxHour = Math.min(23, Math.max(...eventEndHours) + 1); // One hour later than latest event
  }
  
  // Generate hours array based on activity data
  const timelineHours = Array.from({ length: maxHour - minHour + 1 }, (_, i) => i + minHour);
  
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
              <div className="event-title">{event.title}</div>
              
              {event.subTitle && (
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
    </div>
  );
};

export default DayOverview; 