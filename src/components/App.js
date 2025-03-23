import React, { useState, useEffect } from 'react';
import Header from './Header';
import DayOverview from './DayOverview';
import Footer from './Footer';
import ipc from '../ipc/ipc';

const App = () => {
  const [selectedDate, setSelectedDate] = useState(getTodayKey());
  const [activityData, setActivityData] = useState(null);
  const [isTracking, setIsTracking] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [isMockData, setIsMockData] = useState(false);

  // Get today's date in YYYY-MM-DD format
  function getTodayKey() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  }
  
  // Get yesterday's date
  function getYesterdayKey() {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    return `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;
  }
  
  // Get tomorrow's date
  function getTomorrowKey() {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`;
  }
  
  // Format date for display
  function formatDateLabel(dateKey) {
    const today = getTodayKey();
    const yesterday = getYesterdayKey();
    
    if (dateKey === today) {
      return 'Today';
    } else if (dateKey === yesterday) {
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
  }
  
  // Load activity data for the selected date
  const loadActivityData = async () => {
    setIsLoading(true);
    try {
      const data = await ipc.getActivityData(selectedDate);
      setActivityData(data);
    } catch (error) {
      console.error('Failed to load activity data:', error);
    } finally {
      setIsLoading(false);
    }
  };
  
  // Check tracking status
  const checkTrackingStatus = async () => {
    try {
      const status = await ipc.getTrackingStatus();
      setIsTracking(status);
    } catch (error) {
      console.error('Failed to get tracking status:', error);
    }
  };
  
  // Check if using mock data
  const checkMockDataStatus = async () => {
    try {
      const usingMockData = await ipc.isUsingMockData();
      setIsMockData(usingMockData);
    } catch (error) {
      console.error('Failed to check mock data status:', error);
    }
  };
  
  // Toggle tracking
  const toggleTracking = async () => {
    try {
      const newStatus = await ipc.toggleTracking(!isTracking);
      setIsTracking(newStatus);
    } catch (error) {
      console.error('Failed to toggle tracking:', error);
    }
  };
  
  // Navigate to the previous day
  const goToPreviousDay = () => {
    const date = new Date(selectedDate + 'T00:00:00');
    date.setDate(date.getDate() - 1);
    const newDateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    setSelectedDate(newDateKey);
  };
  
  // Navigate to the next day
  const goToNextDay = () => {
    const date = new Date(selectedDate + 'T00:00:00');
    date.setDate(date.getDate() + 1);
    const newDateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    
    // Don't allow navigating to future dates
    if (newDateKey <= getTodayKey()) {
      setSelectedDate(newDateKey);
    }
  };
  
  // Format duration in milliseconds to a readable format
  const formatDuration = (milliseconds) => {
    if (!milliseconds) return '0m';
    
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    } else {
      return `${minutes}m`;
    }
  };
  
  // Load data when component mounts and when selected date changes
  useEffect(() => {
    loadActivityData();
    
    // Set up auto-refresh every minute
    const refreshInterval = setInterval(() => {
      loadActivityData();
    }, 60000);
    
    return () => {
      clearInterval(refreshInterval);
    };
  }, [selectedDate]);
  
  // Check tracking status and mock data status when component mounts
  useEffect(() => {
    checkTrackingStatus();
    checkMockDataStatus();
  }, []);
  
  // Calculate summary statistics
  const activeTime = activityData ? formatDuration(activityData.totalActiveDuration) : '0m';
  const inactiveTime = activityData ? formatDuration(activityData.totalInactiveDuration) : '0m';
  const totalTrackingTime = activityData ? formatDuration(activityData.activeTrackingDuration) : '0m';
  
  // Generate friendly date label
  const dateLabel = formatDateLabel(selectedDate);
  
  return (
    <div className="app">
      <Header 
        date={dateLabel}
        onPrevious={goToPreviousDay}
        onNext={goToNextDay}
        isTracking={isTracking}
        onToggleTracking={toggleTracking}
        isMockData={isMockData}
      />
      
      <DayOverview 
        activityData={activityData}
        isLoading={isLoading}
        formatDuration={formatDuration}
      />
      
      <Footer 
        activeTime={activeTime}
        inactiveTime={inactiveTime}
        totalTime={totalTrackingTime}
        isMockData={isMockData}
      />
    </div>
  );
};

export default App; 