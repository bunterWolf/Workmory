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
      autoLaunch: "Autostart",
      autoLaunchEnabled: "Chronflow beim Systemstart automatisch starten",
      autoLaunchDescription: "Wenn aktiviert, wird Chronflow automatisch gestartet, wenn du deinen Computer einschaltest.",
      errorChangingAutoLaunchSetting: "Fehler beim Ändern der Autostart-Einstellung",
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
      },
      
      // Onboarding
      onboarding: {
        loading: "Wird geladen...",
        navigation: {
          back: "Zurück",
          next: "Weiter",
          complete: "Los geht's"
        },
        welcome: {
          title: "Willkommen bei Chronflow",
          description: "Wir helfen dir, deine Zeit automatisch zu erfassen und zu verstehen, wie du sie nutzt.",
          windows: "Diese App zeichnet auf, welche Programme du wann benutzt. Sie kann ganz einfach im Hintergrund laufen oder jederzeit pausiert werden.",
          macOS: "Diese App zeichnet auf, welche Programme du wann benutzt. Dafür benötigt sie einige Berechtigungen, die wir dir in den nächsten Schritten erklären werden."
        },
        privacy: {
          title: "Deine Daten gehören dir",
          description: "Chronflow speichert alle Daten nur lokal auf deinem Gerät. Die einzige Online-Aktivität ist das Prüfen auf App-Updates.",
          whatWeStore: {
            title: "Was wird gespeichert?",
            appNames: "Namen der genutzten Apps",
            windowTitles: "Fenstertitel der aktiven Anwendungen",
            activityTimestamps: "Zeitstempel deiner Aktivitäten"
          },
          whereWeStore: {
            title: "Wo werden die Daten gespeichert?",
            description: "Alle Daten werden ausschließlich auf deinem Gerät gespeichert. Du kannst den Speicherort in den Einstellungen ändern."
          },
          connections: {
            title: "Verbindungen ins Internet",
            description: "Die App prüft nur auf Updates. Es werden keine Aktivitätsdaten ins Internet übertragen."
          }
        },
        accessibility: {
          title: "Bedienungshilfen-Zugriff",
          description: "Chronflow benötigt Zugriff auf die Bedienungshilfen, um zu erkennen, welche Apps du nutzt.",
          permission: {
            title: "Bedienungshilfen-Berechtigung",
            description: "Diese Berechtigung ermöglicht es der App, den Namen der aktiven Anwendung zu erkennen."
          },
          requestPermission: "Berechtigung anfordern",
          openSettings: "Einstellungen öffnen",
          granted: "Berechtigung erteilt!",
          hint: "Wenn die Dialogbox erscheint, klicke auf 'OK' und aktiviere das Kästchen neben 'Chronflow'.",
          help: {
            title: "Hilfe bei Problemen",
            description: "Wenn die Berechtigung nicht angefordert wird oder du sie nicht erteilen kannst:",
            step1: "Öffne die Systemeinstellungen → Sicherheit → Datenschutz → Bedienungshilfen",
            step2: "Entsperre die Einstellungen mit dem Schloss-Symbol unten links",
            step3: "Aktiviere das Kästchen neben 'Chronflow'"
          }
        },
        screenRecording: {
          title: "Bildschirmaufnahme-Zugriff",
          description: "Chronflow benötigt die Berechtigung, den Bildschirm aufzunehmen, um Fenstertitel für eine detailliertere Zeiterfassung zu erkennen.",
          permission: {
            title: "Bildschirmaufnahme-Berechtigung",
            description: "Diese Berechtigung ermöglicht es der App, Fenstertitel zu erkennen. Es werden keine Screenshots gespeichert."
          },
          requestPermission: "Berechtigung anfordern",
          openSettings: "Einstellungen öffnen",
          granted: "Berechtigung erteilt!",
          hint: "Wenn die Dialogbox erscheint, klicke auf 'OK' und aktiviere das Kästchen neben 'Chronflow'.",
          help: {
            title: "Hilfe bei Problemen",
            description: "Wenn die Berechtigung nicht angefordert wird oder du sie nicht erteilen kannst:",
            step1: "Öffne die Systemeinstellungen → Sicherheit → Datenschutz → Bildschirmaufnahme",
            step2: "Entsperre die Einstellungen mit dem Schloss-Symbol unten links",
            step3: "Aktiviere das Kästchen neben 'Chronflow'"
          },
          note: "Keine Sorge: Wir zeichnen keine Screenshots oder Videos auf. Die Berechtigung wird nur benötigt, um Titel von Fenstern zu lesen."
        },
        completion: {
          title: "Alles bereit!",
          description: "Du bist startklar, um deine Zeit automatisch zu erfassen.",
          checkpoints: {
            setup: {
              title: "Einrichtung abgeschlossen",
              description: "Die App ist jetzt für dich konfiguriert."
            },
            privacy: {
              title: "Datenschutz gesichert",
              description: "Deine Daten werden nur lokal gespeichert."
            },
            permissions: {
              title: "Berechtigungen erteilt",
              description: "Alle notwendigen Zugriffsrechte wurden gewährt."
            }
          },
          ready: {
            title: "Los geht's!",
            description: "Klicke auf 'Los geht's', um mit der automatischen Zeiterfassung zu starten."
          }
        }
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
      autoLaunch: "Auto-Launch",
      autoLaunchEnabled: "Start Chronflow automatically at system startup",
      autoLaunchDescription: "When enabled, Chronflow will automatically start when you turn on your computer.",
      errorChangingAutoLaunchSetting: "Error changing auto-launch setting",
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
      },
      
      // Onboarding
      onboarding: {
        loading: "Loading...",
        navigation: {
          back: "Back",
          next: "Next",
          complete: "Let's Go"
        },
        welcome: {
          title: "Welcome to Chronflow",
          description: "We help you automatically track your time and understand how you use it.",
          windows: "This app records which programs you use and when. It can run in the background or be paused at any time.",
          macOS: "This app records which programs you use and when. For this, it needs some permissions, which we'll explain in the next steps."
        },
        privacy: {
          title: "Your Data Belongs to You",
          description: "Chronflow stores all data locally on your device. The only online activity is checking for app updates.",
          whatWeStore: {
            title: "What is stored?",
            appNames: "Names of used applications",
            windowTitles: "Window titles of active applications",
            activityTimestamps: "Timestamps of your activities"
          },
          whereWeStore: {
            title: "Where is data stored?",
            description: "All data is stored exclusively on your device. You can change the storage location in the settings."
          },
          connections: {
            title: "Internet Connections",
            description: "The app only checks for updates. No activity data is transmitted to the internet."
          }
        },
        accessibility: {
          title: "Accessibility Access",
          description: "Chronflow needs access to accessibility features to recognize which apps you use.",
          permission: {
            title: "Accessibility Permission",
            description: "This permission allows the app to recognize the name of the active application."
          },
          requestPermission: "Request Permission",
          openSettings: "Open Settings",
          granted: "Permission granted!",
          hint: "When the dialog appears, click 'OK' and check the box next to 'Chronflow'.",
          help: {
            title: "Help with Problems",
            description: "If the permission is not requested or you cannot grant it:",
            step1: "Open System Preferences → Security → Privacy → Accessibility",
            step2: "Unlock the settings with the lock icon in the bottom left",
            step3: "Check the box next to 'Chronflow'"
          }
        },
        screenRecording: {
          title: "Screen Recording Access",
          description: "Chronflow needs permission to record the screen to recognize window titles for more detailed time tracking.",
          permission: {
            title: "Screen Recording Permission",
            description: "This permission allows the app to recognize window titles. No screenshots are saved."
          },
          requestPermission: "Request Permission",
          openSettings: "Open Settings",
          granted: "Permission granted!",
          hint: "When the dialog appears, click 'OK' and check the box next to 'Chronflow'.",
          help: {
            title: "Help with Problems",
            description: "If the permission is not requested or you cannot grant it:",
            step1: "Open System Preferences → Security → Privacy → Screen Recording",
            step2: "Unlock the settings with the lock icon in the bottom left",
            step3: "Check the box next to 'Chronflow'"
          },
          note: "Don't worry: We don't record any screenshots or videos. The permission is only needed to read window titles."
        },
        completion: {
          title: "All Set!",
          description: "You're ready to automatically track your time.",
          checkpoints: {
            setup: {
              title: "Setup Complete",
              description: "The app is now configured for you."
            },
            privacy: {
              title: "Privacy Secured",
              description: "Your data is stored locally only."
            },
            permissions: {
              title: "Permissions Granted",
              description: "All necessary access rights have been granted."
            }
          },
          ready: {
            title: "Let's Start!",
            description: "Click 'Let's Go' to start automatic time tracking."
          }
        }
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