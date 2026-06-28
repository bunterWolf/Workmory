# Onboarding-Prozess für den ersten App-Start

**Datum:** 2026-06-28
**Status:** Approved (Design), bereit für Implementierungsplan

## Ziel

Wenn Workmory zum ersten Mal gestartet wird, soll ein kurzer, mehrstufiger Onboarding-Flow erklären,
was die App tut, warum sie privacy-first ist und wie die automatische Aufzeichnung funktioniert.
Der Flow ist rein erklärend — er fragt keine Einstellungen ab und initiiert keine
Berechtigungs-Dialoge oder den Tracking-Start. Er wird genau einmal angezeigt (kein erneuter Aufruf
über die Einstellungen).

## Nicht-Ziele

- Kein Berechtigungs-Workflow (z.B. macOS Accessibility) im Onboarding.
- Keine Einstellungs-Abfrage (Autostart, Speicherort, Sprache) im Onboarding.
- Kein expliziter "Tracking starten"-Schritt am Ende.
- Kein erneuter Zugriff auf das Onboarding über das Settings-Modal.

## Architektur & Datenfluss

```
App-Start → get-settings (IPC) → onboardingCompleted === false?
                                        │
                                        ▼
                          <OnboardingFlow> als Vollbild-Overlay
                          (verdeckt die Haupt-App komplett)
                                        │
                         Skip / "Los geht's" auf letztem Slide
                                        │
                                        ▼
                     complete-onboarding (IPC) → SettingsManager
                     setOnboardingCompleted(true) → settings.json
                                        │
                                        ▼
                          Overlay schließt, Haupt-App sichtbar
```

### 1. `src/store/SettingsManager.ts`

- `AppSettings`-Interface erhält neues Feld: `onboardingCompleted: boolean`.
- Default-Wert beim Erststart (keine `settings.json` vorhanden, oder Feld fehlt in vorhandener Datei):
  `false`.
- `loadSettings()`: analog zu `autoLaunchEnabled` ein zusätzlicher `if ('onboardingCompleted' in
  parsedSettings && typeof parsedSettings.onboardingCompleted === 'boolean')`-Block, der den
  geladenen Wert übernimmt.
- Neue Methoden:
  - `getOnboardingCompleted(): boolean`
  - `setOnboardingCompleted(completed: boolean): void` (ruft `saveSettings()` auf, analog zu
    `setAutoLaunchEnabled`).

### 2. `src/main/main.ts`

- Neuer IPC-Handler:
  ```ts
  ipcMain.handle('complete-onboarding', (): { success: boolean } => {
    activityStore.getSettingsManager().setOnboardingCompleted(true);
    return { success: true };
  });
  ```
  (Exakter Zugriffspfad auf den `SettingsManager` richtet sich nach dem bestehenden Muster der
  anderen Settings-Handler in `main.ts`, z.B. wie `update-auto-launch-settings` darauf zugreift.)
- Der bestehende `get-settings`-Handler liefert zusätzlich `onboardingCompleted` im
  zurückgegebenen Objekt mit aus.
- Handler-Cleanup (Analog zu den anderen `ipcMain.removeHandler(...)`-Aufrufen beim Fenster-Schließen)
  um `complete-onboarding` ergänzen.

### 3. `src/components/App.js`

- Im bestehenden Init-`useEffect` (Zeile ~103–140): nach dem Laden der Settings zusätzlich
  `onboardingCompleted` auslesen und in neuem State `const [showOnboarding, setShowOnboarding] =
  useState(false)` ablegen (`true`, wenn `onboardingCompleted === false`).
- Rendering: wenn `showOnboarding === true`, wird `<OnboardingFlow onComplete={() =>
  setShowOnboarding(false)} />` zusätzlich zur bestehenden App-Struktur gerendert — als Vollbild-Overlay
  (höchster z-index, deckt `WindowChrome`, `Header`, `main`, `Footer` komplett ab). Die Haupt-App-Struktur
  bleibt im DOM (kein Early-Return), damit nach Abschluss kein Re-Mount/Re-Init nötig ist.

### 4. `src/components/OnboardingFlow.js` (neu)

- Props: `{ onComplete: () => void }`.
- Lokaler State: `currentSlide` (0 bis 2, für 3 Slides).
- Inhalt pro Slide kommt aus i18n-Keys (siehe unten), keine hartkodierten Texte.
- Footer-Leiste je Slide:
  - Links: "Überspringen"-Link/Button (auf allen 3 Slides sichtbar).
  - Mitte: Fortschritts-Punkte (3 Punkte, aktueller Slide hervorgehoben).
  - Rechts: "Weiter"-Button (Slide 1–2) bzw. "Los geht's"-Button (Slide 3).
- Sowohl "Überspringen" als auch "Los geht's" auf Slide 3 lösen denselben Abschluss-Pfad aus:
  1. `ipcRenderer.invoke('complete-onboarding')`
  2. Bei Erfolg **und** bei Fehler: `onComplete()` aufrufen (siehe Error Handling unten) — das
     Onboarding schließt sich in jedem Fall, ein Fehler wird nicht dem Nutzer angezeigt.
- Verwendet bestehende Button-Klassen (`wmk-btn`, `wmk-btn-secondary`, `wmk-btn-ghost`) statt neuer
  Stile, für visuelle Konsistenz mit `SettingsModal`.

### 5. `src/components/OnboardingFlow.css` (neu)

- Vollbild-Overlay-Container (`position: fixed`, volle Höhe/Breite, deckendes Background analog zu
  `wmk-modal-scrim`, aber ohne Klick-außerhalb-schließt-Verhalten — es gibt kein "außerhalb" bei
  Vollbild).
- Nutzt vorhandene Design-Tokens aus `colors_and_type.css` (Farben, Typografie) statt neuer Werte.

### 6. `src/i18n.js`

Neue Keys (`de` und `en`), z.B. unter einem Abschnitt "Onboarding":

| Key | DE | EN |
|---|---|---|
| `onboardingWelcomeTitle` | Willkommen bei Workmory | Welcome to Workmory |
| `onboardingWelcomeBody` | Workmory zeichnet automatisch auf, an welchen Apps und Fenstern du arbeitest, damit du am Ende des Tages siehst, wie du deine Zeit verbracht hast — ideal für Zeiterfassung und Rechnungsstellung. | Workmory automatically records which apps and windows you work in, so you can see how you spent your day — ideal for time tracking and invoicing. |
| `onboardingPrivacyTitle` | Deine Daten bleiben bei dir | Your data stays with you |
| `onboardingPrivacyBody` | Alle Aufzeichnungen werden ausschließlich lokal auf deinem Rechner gespeichert. Es gibt keinen Server, keine Cloud, keine Übertragung deiner Daten. | All recordings are stored exclusively on your own computer. There's no server, no cloud, no data transmission. |
| `onboardingHowItWorksTitle` | So funktioniert die Aufzeichnung | How the tracking works |
| `onboardingHowItWorksBody` | Workmory erkennt automatisch das aktive Fenster bzw. die aktive App sowie Inaktivität und fasst das in einer Timeline zusammen, die du jederzeit einsehen kannst. | Workmory automatically detects the active window or app as well as inactivity, and summarizes it in a timeline you can review anytime. |
| `onboardingSkip` | Überspringen | Skip |
| `onboardingNext` | Weiter | Next |
| `onboardingGetStarted` | Los geht's | Get Started |

## Error Handling

Schlägt `complete-onboarding` fehl (z.B. Schreibfehler in `settings.json`), wird der Fehler nur in
die Konsole geloggt (`console.error`). Das Onboarding schließt sich trotzdem (`onComplete()` wird in
jedem Fall aufgerufen). Im schlimmsten Fall erscheint das Onboarding beim nächsten Start erneut — das
ist ein akzeptabler Fallback, da hier keine Tracking- oder Aggregationsdaten betroffen sind (kein
kritischer Pfad im Sinne der Datenkorrektheit).

## Testing

- **`SettingsManager.ts`**: Es existiert aktuell kein dediziertes Test-File für diese Klasse. Als
  kleine Ergänzung im Zuge dieser Änderung: ein einfacher Load/Save-Roundtrip-Test für
  `onboardingCompleted` (Default `false` bei fehlendem Feld/fehlender Datei; persistiert korrekt
  nach `setOnboardingCompleted(true)`).
- **Renderer (`OnboardingFlow.js`, `App.js`)**: Es gibt im Projekt aktuell keine Jest-Tests für
  React-Komponenten (nur für die Aggregation-Pipeline in `src/store/*.test.ts`). Diese Änderung
  berührt die Tracking-/Aggregations-Pipeline nicht — entsprechend wird hier keine neue
  Test-Infrastruktur aufgebaut. Verifikation erfolgt manuell via `npm run dev` (Onboarding sehen,
  durchklicken, skippen, Neustart prüft, dass es nicht erneut erscheint).
- **Build-Gate**: `npm test` muss weiterhin grün bleiben (bestehende Aggregation-Tests dürfen durch
  diese Änderung nicht beeinflusst werden, da sie unabhängige Module betreffen).

## Offene Annahmen

- Die genaue Visuals (Illustrationen/Icons pro Slide) sind nicht Teil dieser Spec — der
  Implementierungsplan kann mit Platzhaltern (z.B. bestehende `Icon`-Komponente aus `Icons.js`)
  starten; visuelles Feintuning kann iterativ erfolgen.
- Sprachumschaltung folgt der bestehenden System-Spracherkennung in `i18n.js` (DE/EN), keine
  zusätzliche UI dafür im Onboarding selbst.
