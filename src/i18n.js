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
      totalShort: "gesamt",
      activeShort: "aktiv",
      inactiveShort: "inaktiv",
      inactive: "Inaktiv",
      teamsMeeting: "Teams-Meeting",
      noActivity: "Keine Aktivität aufgezeichnet",
      noActivitySub: "Workmory war an diesem Tag nicht aktiv.",
      mockData: "Beispieldaten",
      mockDataMode: "Beispieldaten Modus",
      previousDay: "Vorheriger Tag",
      nextDay: "Nächster Tag",
      aggregationInterval: "Intervall",
      minuteUnit: "Min.",
      "5min": "5 Min.",
      "10min": "10 Min.",
      "15min": "15 Min.",
      pauseTracking: "Aufzeichnung pausieren",
      startTracking: "Aufzeichnung starten",
      trackingActivities: "Aufzeichnung läuft",
      
      // Einstellungen
      settings: "Einstellungen",
      activityStoreLocation: "Speicherort für Aktivitätsdaten",
      defaultPath: "Standard",
      changePath: "Ändern...",
      resetToDefault: "Zurücksetzen",
      activityStoreDescription: "Du kannst den Speicherort der Aktivitätsdatei ändern. Dies ist nützlich, wenn du einen Cloud-synchronisierten Ordner (z.B. Dropbox, Google Drive) verwenden möchtest.",
      autoLaunch: "Autostart",
      autoLaunchEnabled: "Chronflow beim Systemstart automatisch starten",
      autoLaunchDescription: "Wenn aktiviert, wird Chronflow automatisch gestartet, wenn du deinen Computer einschaltest.",
      errorChangingAutoLaunchSetting: "Fehler beim Ändern der Autostart-Einstellung",
      betaReleases: "Beta-Versionen",
      participateInBeta: "An Beta-Tests teilnehmen",
      betaDescription: "Wenn aktiviert, erhältst du frühzeitig Zugang zu neuen Funktionen, solltest aber mit möglichen Bugs rechnen.",
      loading: "Wird geladen...",
      version: "Version",
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
        weekday: "{{date, weekday}}",
        dateShort: "{{date, dateShort}}",
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
      totalShort: "total",
      activeShort: "active",
      inactiveShort: "inactive",
      inactive: "Inactive",
      teamsMeeting: "Teams meeting",
      noActivity: "No activity recorded",
      noActivitySub: "Workmory wasn't running on this day.",
      mockData: "Sample Data",
      mockDataMode: "Sample Data Mode",
      previousDay: "Previous Day",
      nextDay: "Next Day",
      aggregationInterval: "Interval",
      minuteUnit: "min",
      "5min": "5 min",
      "10min": "10 min",
      "15min": "15 min",
      pauseTracking: "Pause Tracking",
      startTracking: "Start Tracking",
      trackingActivities: "Recording activity",
      
      // Settings
      settings: "Settings",
      activityStoreLocation: "Activity Data Location",
      defaultPath: "Default",
      changePath: "Change...",
      resetToDefault: "Reset",
      activityStoreDescription: "You can change the location where activity data is stored. This is useful if you want to use a cloud-synced folder (e.g., Dropbox, Google Drive).",
      autoLaunch: "Auto-Launch",
      autoLaunchEnabled: "Start Chronflow automatically at system startup",
      autoLaunchDescription: "When enabled, Chronflow will automatically start when you turn on your computer.",
      errorChangingAutoLaunchSetting: "Error changing auto-launch setting",
      betaReleases: "Beta Versions",
      participateInBeta: "Participate in Beta Testing",
      betaDescription: "When enabled, you'll get early access to new features, but might experience bugs.",
      loading: "Loading...",
      version: "Version",
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
        weekday: "{{date, weekday}}",
        dateShort: "{{date, dateShort}}",
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
        if (format === 'weekday') {
          return new Intl.DateTimeFormat(lng, {
            weekday: 'long'
          }).format(value);
        }
        if (format === 'dateShort') {
          const now = new Date();
          const opts = value.getFullYear() === now.getFullYear()
            ? { month: 'long', day: 'numeric' }
            : { month: 'long', day: 'numeric', year: 'numeric' };
          return new Intl.DateTimeFormat(lng, opts).format(value);
        }
        return value;
      }
    }
  });

export default i18next; 