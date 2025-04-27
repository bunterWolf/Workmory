import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';
const { app } = require('electron').remote || require('@electron/remote');

const resources = {
  de: {
    translation: {
      // UI Texte
      tracking: "Aufzeichnung",
      paused: "Pausiert",
      totalTime: "Gesamtzeit",
      activeTime: "Aktive Zeit",
      inactiveTime: "Inaktive Zeit",
      mockData: "Beispieldaten",
      mockDataMode: "Beispieldaten Modus",
      previousDay: "Vorheriger Tag",
      nextDay: "Nächster Tag",
      aggregationInterval: "Aggregationsintervall",
      pauseTracking: "Aufzeichnung pausieren",
      startTracking: "Aufzeichnung starten",
      trackingActivities: "Aktivitäten werden aufgezeichnet",
      
      // Zeitformate
      timeFormats: {
        today: "Heute",
        yesterday: "Gestern",
        fullDate: "{{date, date}}",
        time: "{{time, time}}",
        duration: "{{hours}}h {{minutes}}m"
      }
    }
  },
  en: {
    translation: {
      // UI Texts
      tracking: "Tracking",
      paused: "Paused",
      totalTime: "Total Time",
      activeTime: "Active Time",
      inactiveTime: "Inactive Time",
      mockData: "Sample Data",
      mockDataMode: "Sample Data Mode",
      previousDay: "Previous Day",
      nextDay: "Next Day",
      aggregationInterval: "Aggregation Interval",
      pauseTracking: "Pause Tracking",
      startTracking: "Start Tracking",
      trackingActivities: "Recording activities",
      
      // Time formats
      timeFormats: {
        today: "Today",
        yesterday: "Yesterday",
        fullDate: "{{date, date}}",
        time: "{{time, time}}",
        duration: "{{hours}}h {{minutes}}m"
      }
    }
  }
};

// Get system language from Electron
const getSystemLanguage = () => {
  try {
    // Try to get language from Electron app
    const appLanguage = app.getLocale();
    return appLanguage.split('-')[0];
  } catch (error) {
    // Fallback to navigator.language
    return navigator.language.split('-')[0];
  }
};

i18next
  .use(initReactI18next)
  .init({
    resources,
    lng: getSystemLanguage(),
    fallbackLng: 'en',
    interpolation: {
      format: function(value, format, lng) {
        if (format === 'date') {
          return new Intl.DateTimeFormat(lng, {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          }).format(value);
        }
        if (format === 'time') {
          return new Intl.DateTimeFormat(lng, {
            hour: '2-digit',
            minute: '2-digit',
            hour12: lng === 'en'
          }).format(value);
        }
        return value;
      }
    }
  });

export default i18next; 