import React, { useState, useEffect, useRef } from 'react';
import { I18nextProvider } from 'react-i18next';
import Toolbar from './toolbar/Toolbar';
import Timeline from './timeline/Timeline';
import Footer from './footer/Footer';
import SettingsView from './settings/SettingsView';
import WindowTitleBar from './window/WindowTitleBar';
import { ipcRenderer } from 'electron';
import i18n from '../i18n';
import { toLocalDateKey } from './dateKey';
import '../styles/tokens.css';
import '../styles/typography.css';
import '../styles/base.css';
import './App.css';

const App = () => {
  const [selectedDate, setSelectedDate] = useState(() => toLocalDateKey());
  // Always the currently shown date; lets async loads detect that they are stale.
  const selectedDateRef = useRef(selectedDate);
  selectedDateRef.current = selectedDate;
  
  const [activityData, setActivityData] = useState(null);
  const [availableDates, setAvailableDates] = useState([]);
  const [isTracking, setIsTracking] = useState(false);
  const [isMockData, setIsMockData] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  // True once init has loaded tracking state and interval (the timeline's first scroll waits for it).
  const [isInitialized, setIsInitialized] = useState(false);
  const [aggregationInterval, setAggregationInterval] = useState(15);
  // Which view fills the window below the title bar: the day timeline or the settings.
  const [view, setView] = useState('day'); // 'day' | 'settings'

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
    if (newDate === selectedDate) return;
    selectedDateRef.current = newDate;
    // Drop the previous day's data so it is never shown under the new date.
    setActivityData(null);
    setIsLoading(true);
    setSelectedDate(newDate);
  };

  // Toggle tracking
  const toggleTracking = async () => {
    const newStatus = await ipcRenderer.invoke('toggle-tracking', !isTracking);
    setIsTracking(newStatus);
  };

  // Handle aggregation interval changes
  const handleIntervalChange = async (newInterval) => {
    try {
      await ipcRenderer.invoke('set-aggregation-interval', newInterval);
      setAggregationInterval(newInterval);
      // Reload data to reflect the new aggregation interval
      await loadActivityData();
    } catch (error) {
      console.error('Error changing aggregation interval:', error);
    }
  };

  // Load activity data for the selected date. Does not set isLoading itself: the
  // loading view replaces the timeline (and its scroll position), so only the
  // initial load and date changes show it. Background refreshes and interval
  // changes update the data in place.
  const loadActivityData = async () => {
    const requestedDate = selectedDate;
    // A response for a date that is no longer shown must not touch state (data or loading).
    const isStale = () => requestedDate !== selectedDateRef.current;
    try {
      const data = await ipcRenderer.invoke('get-day-data', requestedDate);
      if (!isStale()) setActivityData(data);
    } catch (error) {
      // Keep what is shown: a failed refresh of the same date must not blank the timeline
      // and footer. Data is already null on the initial load and after a date change.
      console.error('Error loading activity data:', error);
    } finally {
      if (!isStale()) setIsLoading(false);
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
        
        // Get available dates from backend
        const datesFromBackend = await ipcRenderer.invoke('get-available-dates');
        
        // Ensure today's date is always included
        const today = toLocalDateKey();
        const datesSet = new Set(datesFromBackend);
        datesSet.add(today);
        
        // Convert back to array and sort chronologically
        const allDates = Array.from(datesSet).sort();
        setAvailableDates(allDates);
        
        // Get current aggregation interval
        const interval = await ipcRenderer.invoke('get-aggregation-interval');
        if (interval) {
          setAggregationInterval(interval);
        }
        
        // Load initial data
        await loadActivityData();
      } catch (error) {
        console.error('Error during initialization:', error);
      } finally {
        setIsInitialized(true);
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
      return { active: '0m', inactive: '0m', tracked: '0m' };
    }
    
    const { summary } = activityData.aggregated;
    
    return {
      active: formatDuration(summary.totalActiveDuration),
      inactive: formatDuration(summary.totalInactiveDuration),
      tracked: formatDuration(summary.activeTrackingDuration)
    };
  };

  const summary = getSummary();

  return (
    <I18nextProvider i18n={i18n}>
      <div className="wm-app">
        <WindowTitleBar
          isSettingsOpen={view === 'settings'}
          onToggleSettings={() => setView(view === 'settings' ? 'day' : 'settings')}
        />

        {view === 'settings' ? (
          <SettingsView onBack={() => setView('day')} />
        ) : (
          <>
            <Toolbar
              selectedDate={selectedDate}
              availableDates={availableDates}
              onDateChange={handleDateChange}
              isTracking={isTracking}
              onToggleTracking={toggleTracking}
              isMockData={isMockData}
              aggregationInterval={aggregationInterval}
              onIntervalChange={handleIntervalChange}
            />

            <Timeline
              activityData={activityData}
              isLoading={isLoading}
              formatDuration={formatDuration}
              aggregationInterval={aggregationInterval}
              isTracking={isTracking}
              isInitialized={isInitialized}
              displayedDate={selectedDate}
            />

            <Footer
              summary={summary}
              isMockData={isMockData}
            />
          </>
        )}
      </div>
    </I18nextProvider>
  );
};

export default App; 