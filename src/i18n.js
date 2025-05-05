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
      
      // Einstellungen
      settings: "Einstellungen",
      activityStoreLocation: "Speicherort für Aktivitätsdaten",
      defaultPath: "Standard",
      changePath: "Ändern...",
      resetToDefault: "Zurücksetzen",
      activityStoreDescription: "Du kannst den Speicherort der Aktivitätsdatei ändern. Dies ist nützlich, wenn du einen Cloud-synchronisierten Ordner (z.B. Dropbox, Google Drive) verwenden möchtest.",
      betaReleases: "Beta-Versionen",
      participateInBeta: "An Beta-Tests teilnehmen",
      betaDescription: "Wenn aktiviert, erhältst du frühzeitig Zugang zu neuen Funktionen, solltest aber mit möglichen Bugs rechnen.",
      loading: "Wird geladen...",
      close: "Schließen",
      fileExistsTitle: "Datei existiert bereits",
      fileExistsMessage: "Am Zielort existiert bereits eine Aktivitätsdatei. Möchtest du diese vorhandene Datei verwenden? Deine aktuellen Daten werden dann nicht übernommen.",
      useExistingFile: "Vorhandene Datei verwenden",
      cancel: "Abbrechen",
      errorLoadingSettings: "Fehler beim Laden der Einstellungen",
      errorChangingPath: "Fehler beim Ändern des Speicherorts",
      errorUsingExistingFile: "Fehler beim Verwenden der vorhandenen Datei",
      errorChangingBetaSetting: "Fehler beim Ändern der Beta-Einstellung",
      
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
      
      // Settings
      settings: "Settings",
      activityStoreLocation: "Activity Data Location",
      defaultPath: "Default",
      changePath: "Change...",
      resetToDefault: "Reset",
      activityStoreDescription: "You can change the location where activity data is stored. This is useful if you want to use a cloud-synced folder (e.g., Dropbox, Google Drive).",
      betaReleases: "Beta Versions",
      participateInBeta: "Participate in Beta Testing",
      betaDescription: "When enabled, you'll get early access to new features, but might experience bugs.",
      loading: "Loading...",
      close: "Close",
      fileExistsTitle: "File Already Exists",
      fileExistsMessage: "An activity file already exists at the selected location. Do you want to use this existing file? Your current data won't be transferred.",
      useExistingFile: "Use Existing File",
      cancel: "Cancel",
      errorLoadingSettings: "Error loading settings",
      errorChangingPath: "Error changing storage location",
      errorUsingExistingFile: "Error using existing file",
      errorChangingBetaSetting: "Error changing beta setting",
      
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