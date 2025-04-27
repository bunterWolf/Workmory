import React, { useState, useEffect } from 'react';
import { I18nextProvider } from 'react-i18next';
import Header from './Header';
import DayOverview from './DayOverview';
import Footer from './Footer';
import { ipcRenderer } from 'electron';
import i18n from '../i18n';
import './App.css';

const App = () => {
  const [selectedDate, setSelectedDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split('T')[0]; // Format as YYYY-MM-DD
  });
  
  const [activityData, setActivityData] = useState(null);
  const [availableDates, setAvailableDates] = useState([]);
  const [isTracking, setIsTracking] = useState(false);
  const [isMockData, setIsMockData] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [aggregationInterval, setAggregationInterval] = useState(15);
  const [updateStatus, setUpdateStatus] = useState(null);

  // Format duration in milliseconds to human-readable string
  const formatDuration = (ms) => {
    if (!ms) return '0m';
    
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
      const remainingMinutes = minutes % 60;
      return `${hours}h ${remainingMinutes}m`;
    }
    
    return `${minutes}m`;
  };

  // Handle date changes
  const handleDateChange = (newDate) => {
    setSelectedDate(newDate);
  };

  // Toggle tracking
  const toggleTracking = async () => {
    const newStatus = await ipcRenderer.invoke('toggle-tracking', !isTracking);
    setIsTracking(newStatus);
  };

  // Handle aggregation interval changes
  const handleIntervalChange = async (newInterval) => {
    setIsLoading(true);
    
    try {
      await ipcRenderer.invoke('set-aggregation-interval', newInterval);
      setAggregationInterval(newInterval);
      // Reload data to reflect the new aggregation interval
      await loadActivityData();
    } catch (error) {
      console.error('Error changing aggregation interval:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Load activity data for the selected date
  const loadActivityData = async () => {
    setIsLoading(true);
    
    try {
      const data = await ipcRenderer.invoke('get-day-data', selectedDate);
      setActivityData(data);
    } catch (error) {
      console.error('Error loading activity data:', error);
      setActivityData(null);
    } finally {
      setIsLoading(false);
    }
  };

  // Monitor user activity for inactivity detection
  useEffect(() => {
    // Listen for activity data updates
    ipcRenderer.on('activity-data-updated', (event, dateKey) => {
      if (dateKey === selectedDate) {
        loadActivityData();
      }
    });
    
    // Cleanup listeners
    return () => {
      ipcRenderer.removeAllListeners('activity-data-updated');
    };
  }, [selectedDate]);

  // Initial setup
  useEffect(() => {
    const init = async () => {
      try {
        // Check if using mock data
        const mockDataStatus = await ipcRenderer.invoke('is-using-mock-data');
        setIsMockData(mockDataStatus);
        
        // Get tracking status
        const trackingStatus = await ipcRenderer.invoke('get-tracking-status');
        setIsTracking(trackingStatus);
        
        // Get available dates
        const dates = await ipcRenderer.invoke('get-available-dates');
        setAvailableDates(dates);
        
        // Get current aggregation interval
        const interval = await ipcRenderer.invoke('get-aggregation-interval');
        if (interval) {
          setAggregationInterval(interval);
        }
        
        // Load initial data
        await loadActivityData();
      } catch (error) {
        console.error('Error during initialization:', error);
      }
    };
    
    init();
  }, []);

  // Reload data when selected date changes
  useEffect(() => {
    loadActivityData();
  }, [selectedDate]);

  // Compute summary information
  const getSummary = () => {
    if (!activityData || !activityData.aggregated || !activityData.aggregated.summary) {
      return {
        totalTime: '0h',
        activeTime: '0h',
        inactiveTime: '0h'
      };
    }
    
    const { summary } = activityData.aggregated;
    
    return {
      totalTime: formatDuration(summary.activeTrackingDuration),
      activeTime: formatDuration(summary.totalActiveDuration),
      inactiveTime: formatDuration(summary.totalInactiveDuration)
    };
  };

  const summary = getSummary();

  // Update notification handler
  useEffect(() => {
    const handleUpdateStatus = (event, status) => {
      setUpdateStatus(status);
      
      // Zeige Update-Benachrichtigung
      if (status.status === 'available') {
        // Neue Version verfügbar
        console.log(`Neue Version ${status.version} verfügbar`);
      } else if (status.status === 'downloaded') {
        // Update heruntergeladen und bereit zur Installation
        console.log(`Update ${status.version} heruntergeladen - wird beim nächsten Start installiert`);
      } else if (status.status === 'error') {
        // Update-Fehler
        console.error('Update-Fehler:', status.error);
      }
    };

    // Registriere Update-Event-Handler
    ipcRenderer.on('update-status', handleUpdateStatus);

    // Cleanup
    return () => {
      ipcRenderer.removeListener('update-status', handleUpdateStatus);
    };
  }, []);

  return (
    <I18nextProvider i18n={i18n}>
      <div className="app">
        <Header 
          selectedDate={selectedDate}
          availableDates={availableDates}
          onDateChange={handleDateChange}
          isTracking={isTracking}
          onToggleTracking={toggleTracking}
          isMockData={isMockData}
          aggregationInterval={aggregationInterval}
          onIntervalChange={handleIntervalChange}
        />
        
        {/* Update-Benachrichtigung */}
        {updateStatus && updateStatus.status === 'downloaded' && (
          <div className="update-notification">
            Eine neue Version ist verfügbar und wird beim nächsten Start installiert.
          </div>
        )}

        <main className="main-content">
          <DayOverview 
            activityData={activityData}
            isLoading={isLoading}
            formatDuration={formatDuration}
            aggregationInterval={aggregationInterval}
          />
        </main>
        
        <Footer 
          activeTime={summary.activeTime}
          inactiveTime={summary.inactiveTime}
          totalTime={summary.totalTime}
          isMockData={isMockData}
        />
      </div>
    </I18nextProvider>
  );
};

export default App; 