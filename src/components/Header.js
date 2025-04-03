import React from 'react';
import { useTranslation } from 'react-i18next';
import './Header.css';

const Header = ({ 
  selectedDate, 
  availableDates, 
  onDateChange, 
  isTracking, 
  onToggleTracking, 
  isMockData,
  aggregationInterval = 15,
  onIntervalChange
}) => {
  const { t } = useTranslation();

  // Format date for display
  const formatDateLabel = (dateKey) => {
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayKey = yesterday.toISOString().split('T')[0];
    
    if (dateKey === today) {
      return t('timeFormats.today');
    } else if (dateKey === yesterdayKey) {
      return t('timeFormats.yesterday');
    } else {
      const date = new Date(dateKey + 'T00:00:00');
      return t('timeFormats.fullDate', { date });
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

  // Handle interval change
  const handleIntervalChange = (event) => {
    if (onIntervalChange) {
      onIntervalChange(Number(event.target.value));
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
          title={t('previousDay')}
        >
          &larr;
        </button>
        
        <h1 className="date-display">{formatDateLabel(selectedDate)}</h1>
        
        <button 
          className="nav-button" 
          onClick={goToNextDay} 
          disabled={!canGoNext}
          title={t('nextDay')}
        >
          &rarr;
        </button>
      </div>
      
      <div className="controls">
        <div className="interval-selector-container">
          <select 
            className="interval-selector" 
            value={aggregationInterval} 
            onChange={handleIntervalChange}
            title={t('aggregationInterval')}
          >
            <option value="5">5 Min</option>
            <option value="10">10 Min</option>
            <option value="15">15 Min</option>
          </select>
        </div>
        
        {!isMockData && (
          <button 
            className={`tracking-button ${isTracking ? 'tracking-active' : 'tracking-paused'}`} 
            onClick={onToggleTracking}
            title={isTracking ? t('pauseTracking') : t('startTracking')}
          >
            {isTracking ? t('tracking') : t('paused')}
          </button>
        )}
        
        {isMockData && (
          <div className="mock-indicator">
            {t('mockDataMode')}
          </div>
        )}
      </div>
    </header>
  );
};

export default Header; 