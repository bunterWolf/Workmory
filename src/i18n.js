import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';
const { app } = require('electron').remote || require('@electron/remote');

const resources = {
  de: {
    translation: {
      // UI Texte
      tracking: "Tracking",
      paused: "Pausiert",
      summaryActive: "Aktiv",
      summaryInactive: "Inaktiv",
      summaryTracked: "Erfasst",
      inactive: "Inaktiv",
      teamsMeeting: "Teams-Meeting",
      noActivity: "Keine Aktivität aufgezeichnet",
      mockData: "Beispieldaten",
      previousDay: "Vorheriger Tag",
      nextDay: "Nächster Tag",
      aggregationInterval: "Zoom",
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
      autoLaunchDescription: "Automatisch starten, wenn du den Computer einschaltest.",
      errorChangingAutoLaunchSetting: "Fehler beim Ändern der Autostart-Einstellung",
      betaReleases: "Auf Beta-Versionen aktualisieren",
      betaDescription: "Frühzeitig auf neue Funktionen zugreifen. Gelegentliche Fehler sind möglich.",
      loading: "Wird geladen...",
      version: "Version",
      close: "Schließen",
      back: "Zurück",
      placeholderLink: "www.appname.io",
      appTitle: "Workmory",
      minimize: "Minimieren",
      maximize: "Maximieren",
      fileExistsTitle: "Datei existiert bereits",
      fileExistsMessage: "Am Zielort existiert bereits eine Aktivitätsdatei. Möchtest du diese vorhandene Datei verwenden? Deine aktuellen Daten werden dann nicht übernommen.",
      useExistingFile: "Vorhandene Datei verwenden",
      cancel: "Abbrechen",
      errorLoadingSettings: "Fehler beim Laden der Einstellungen",
      errorChangingPath: "Fehler beim Ändern des Speicherorts",
      errorUsingExistingFile: "Fehler beim Verwenden der vorhandenen Datei",
      errorChangingBetaSetting: "Fehler beim Ändern der Beta-Einstellung",
      appearance: "Darstellung",
      themeSystem: "Auto",
      themeLight: "Hell",
      themeDark: "Dunkel",
      errorChangingTheme: "Fehler beim Ändern der Darstellung",
      
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
      summaryActive: "Active",
      summaryInactive: "Inactive",
      summaryTracked: "Tracked",
      inactive: "Inactive",
      teamsMeeting: "Teams meeting",
      noActivity: "No activity recorded",
      mockData: "Sample Data",
      previousDay: "Previous Day",
      nextDay: "Next Day",
      aggregationInterval: "Zoom",
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
      autoLaunchDescription: "Start automatically when you turn on your computer.",
      errorChangingAutoLaunchSetting: "Error changing auto-launch setting",
      betaReleases: "Update to beta releases",
      betaDescription: "Get early access to new features. Occasional bugs are possible.",
      loading: "Loading...",
      version: "Version",
      close: "Close",
      back: "Back",
      placeholderLink: "www.appname.io",
      appTitle: "Workmory",
      minimize: "Minimize",
      maximize: "Maximize",
      fileExistsTitle: "File Already Exists",
      fileExistsMessage: "An activity file already exists at the selected location. Do you want to use this existing file? Your current data won't be transferred.",
      useExistingFile: "Use Existing File",
      cancel: "Cancel",
      errorLoadingSettings: "Error loading settings",
      errorChangingPath: "Error changing storage location",
      errorUsingExistingFile: "Error using existing file",
      errorChangingBetaSetting: "Error changing beta setting",
      appearance: "Appearance",
      themeSystem: "Auto",
      themeLight: "Light",
      themeDark: "Dark",
      errorChangingTheme: "Error changing the appearance",
      
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