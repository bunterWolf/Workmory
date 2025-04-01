import React from 'react';
import './Header.css';

const Header = ({ 
  selectedDate, 
  availableDates, 
  onDateChange, 
  isTracking, 
  onToggleTracking, 
  isMockData 
}) => {
  // Format date for display
  const formatDateLabel = (dateKey) => {
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayKey = yesterday.toISOString().split('T')[0];
    
    if (dateKey === today) {
      return 'Today';
    } else if (dateKey === yesterdayKey) {
      return 'Yesterday';
    } else {
      const date = new Date(dateKey + 'T00:00:00');
      return date.toLocaleDateString(undefined, {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    }
  };

  // Navigate to the previous day
  const goToPreviousDay = () => {
    const currentIndex = availableDates.indexOf(selectedDate);
    if (currentIndex > 0) {
      onDateChange(availableDates[currentIndex - 1]);
    }
  };

  // Navigate to the next day
  const goToNextDay = () => {
    const currentIndex = availableDates.indexOf(selectedDate);
    if (currentIndex < availableDates.length - 1) {
      onDateChange(availableDates[currentIndex + 1]);
    }
  };

  // Whether we can navigate to previous or next days
  const canGoPrevious = availableDates.indexOf(selectedDate) > 0;
  const canGoNext = availableDates.indexOf(selectedDate) < availableDates.length - 1;
  
  return (
    <header className="header">
      <div className="date-navigation">
        <button 
          className="nav-button" 
          onClick={goToPreviousDay} 
          disabled={!canGoPrevious}
          title="Previous day"
        >
          &larr;
        </button>
        
        <h1 className="date-display">{formatDateLabel(selectedDate)}</h1>
        
        <button 
          className="nav-button" 
          onClick={goToNextDay} 
          disabled={!canGoNext}
          title="Next day"
        >
          &rarr;
        </button>
      </div>
      
      <div className="controls">
        {!isMockData && (
          <button 
            className={`tracking-button ${isTracking ? 'tracking-active' : 'tracking-paused'}`} 
            onClick={onToggleTracking}
            title={isTracking ? 'Pause tracking' : 'Start tracking'}
          >
            {isTracking ? 'Tracking' : 'Paused'}
          </button>
        )}
        
        {isMockData && (
          <div className="mock-indicator">
            Mock Data Mode
          </div>
        )}
      </div>
    </header>
  );
};

export default Header; 