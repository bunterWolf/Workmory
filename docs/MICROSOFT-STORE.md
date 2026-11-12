# Microsoft Store

Missing Hours für Windows gibt es zusätzlich zum GitHub-Installer als Paket im Microsoft Store (MSIX). Microsoft
signiert das Paket. Darum erscheint keine SmartScreen-Warnung, und Firmen lassen Store-Apps oft eher zu.

## Was in der Store-Version anders ist

| Thema | GitHub-Version | Store-Version |
| --- | --- | --- |
| Updates | `electron-updater` über GitHub Releases | der Store; `electron-updater` startet nicht |
| Beta-Updates | Schalter in den Einstellungen | gibt es nicht, im Store landen nur stabile Versionen |
| Autostart | Registry über `auto-launch`, Schalter in den Einstellungen | Startaufgabe im Paket (`resources/appx-extensions.xml`), an nach dem ersten Start; ein- und ausschalten unter Windows-Einstellungen > Apps > Autostart, die App öffnet die Seite per Knopf |
| Datenordner | `%APPDATA%\missing-hours` (nach `name` in `package.json`); beim ersten Start übernimmt die App die Daten aus dem alten Ordner `%APPDATA%\workmory` (`src/store/UserDataMigration.ts`) | gibt es `%APPDATA%\missing-hours` schon, nutzt sie genau diesen Ordner; sonst vermutlich den Paketordner (siehe unten) |
| Deinstallation | Daten bleiben | Daten im Paketordner löscht Windows mit, `%APPDATA%\missing-hours` bleibt |

Die App erkennt die Store-Version an `process.windowsStore` (`src/main/main.ts`, `isWindowsStore`).

**Daten (getestet am 2026-11-11 mit einem lokal registrierten Paket, Windows 11):** Auf einem Rechner,
auf dem die GitHub-Version schon lief, hat die Store-Version direkt in die vorhandene
`%APPDATA%\Workmory\chronflow-activity-store.json` geschrieben (die App hieß damals noch Workmory), also nichts umgeleitet. Beide Versionen
teilen sich dann Daten und Instanz-Sperre: Es läuft immer nur eine von beiden, und ein Wechsel behält
alle Tage. Nach dem Entfernen des Pakets war die Datei unverändert da.

Nicht getestet: eine frische Installation ohne vorhandenen Ordner. Dann legt Windows neue Dateien
voraussichtlich im Paketordner an (`%LOCALAPPDATA%\Packages\<Paketname>\LocalCache\Roaming\missing-hours`),
und eine Deinstallation löscht sie. Das ist bewusst so entschieden (keine Sonderfreigabe für
unvirtualisierte Dateien). Wer sicher gehen will, wählt in den Einstellungen einen eigenen Speicherort,
zum Beispiel unter Dokumente. Dort leitet Windows nichts um.

## Einmalige Einrichtung im Partner Center

1. Unter https://partner.microsoft.com/dashboard ein Entwicklerkonto anlegen (für Einzelpersonen kostenlos).
2. **Apps und Spiele > Neues Produkt > MSIX- oder PWA-App** und den Namen „Missing Hours“ reservieren.
3. Unter **Produktverwaltung > Produktidentität** die drei Werte in `package.json` unter `build.appx` eintragen:

   | Partner Center | `package.json` |
   | --- | --- |
   | `Package/Identity/Name` | `identityName` |
   | `Package/Identity/Publisher` (beginnt mit `CN=`) | `publisher` |
   | `Package/Properties/PublisherDisplayName` | `publisherDisplayName` |

   Bis dahin stehen dort Platzhalter (`PLACEHOLDER…`). Ein Paket mit Platzhaltern lehnt der Store ab.
   Die Werte sind nicht geheim, sie stehen in jedem installierten Paket.

## Pro Store-Release

1. **Version:** Der Store verlangt eine erste Stelle größer als 0 und kennt keine Betas. Die Version wird
   `Major.Minor.Patch.0` (`1.0.0` → `1.0.0.0`) und muss bei jeder Einreichung höher sein als die letzte.
   Die erste Store-Version ist deshalb mindestens `1.0.0`.
2. **Stabilen Release machen** wie in [RELEASE-PROZESS.md](RELEASE-PROZESS.md). Bei Tags ohne `beta` baut
   GitHub Actions zusätzlich das Store-Paket und legt es als Artefakt `microsoft-store-package` am Lauf ab.
   Es kommt nicht ins GitHub Release, weil es erst durch den Store signiert wird.
3. **Paket herunterladen:**
   ```bash
   gh run download <run-id> -n microsoft-store-package -D store-package
   ```
4. **Im Partner Center einreichen:** Produkt öffnen > **Einreichung starten** (bei Updates: Einreichung
   aktualisieren) > unter **Pakete** die `.appx` hochladen > Einreichung abschicken. Die Prüfung dauert
   meist ein bis drei Werktage.

## Angaben für die erste Einreichung

- **Preis und Verfügbarkeit:** kostenlos, alle Märkte
- **Eigenschaften:** Kategorie „Produktivität“; „Diese App greift auf persönliche Informationen zu“: ja,
  Datenschutz-URL `https://github.com/bunterWolf/Missing-Hours/blob/main/PRIVACY.md`
- **Altersfreigabe:** Fragebogen ausfüllen; keine Kommunikation zwischen Nutzern, keine Käufe, keine
  Inhalte von Nutzern, keine Standortdaten
- **Eingeschränkte Funktion `runFullTrust`:** Partner Center fragt nach einer Begründung, zum Beispiel:
  > Missing Hours is a desktop time tracker built with Electron. It needs full trust to read the active window
  > (title and executable) through Win32 APIs, to read the system idle time and to start with Windows. All
  > data stays on the device.
- **Store-Eintrag** (Deutsch und Englisch, Texte unten), mindestens ein Screenshot (PNG, mindestens 1366×768).
  Gute Motive: Tagesansicht mit Zeitleiste in hell und dunkel, Einstellungen.

### Store-Texte

**Deutsch**

> **Kurzbeschreibung:** Automatische Zeiterfassung für deinen PC. Missing Hours zeichnet auf, woran du arbeitest,
> und zeigt deinen Tag als Zeitleiste. Alles bleibt lokal auf deinem Computer.
>
> **Beschreibung:** Missing Hours erfasst automatisch, welche Programme und Fenster du nutzt und wann du nicht am
> Rechner bist. Daraus entsteht für jeden Tag eine übersichtliche Zeitleiste, mit der du Arbeitszeiten
> nachvollziehen und Rechnungen schreiben kannst, ohne eine Stoppuhr zu starten.
>
> - Läuft im Hintergrund und startet mit Windows
> - Erkennt Pausen und Abwesenheit automatisch
> - Zeitleiste pro Tag mit den Symbolen deiner Programme
> - Helles und dunkles Design
> - Datenschutz zuerst: keine Cloud, kein Konto, keine Telemetrie. Deine Daten verlassen deinen Computer nie.

**English**

> **Short description:** Automatic time tracking for your PC. Missing Hours records what you work on and shows
> your day as a timeline. Everything stays on your computer.
>
> **Description:** Missing Hours automatically records which programs and windows you use and when you are away
> from your computer. It turns this into a clear timeline for every day, so you can review your working hours
> and write invoices without starting a stopwatch.
>
> - Runs in the background and starts with Windows
> - Detects breaks and absence automatically
> - Daily timeline with your programs' icons
> - Light and dark theme
> - Privacy first: no cloud, no account, no telemetry. Your data never leaves your computer.

## Lokal bauen und testen

```bash
npm run dist:store
```

Das Paket landet in `release/<version>/Missing-Hours-Store-<version>-x64.appx`.

**Bekanntes lokales Problem:** Auf manchen Rechnern startet `makeappx.exe` aus dem electron-builder-Cache
nicht (`spawn UNKNOWN`, im Ereignisprotokoll „Side-by-Side-Konfiguration ungültig“). Eine Kopie des Ordners
`%LOCALAPPDATA%\electron-builder\Cache\winCodeSign-2.6.0\<…>\windows-10\x64` an einem anderen Ort funktioniert.
Damit lässt sich das Paket aus den Dateien packen, die electron-builder schon vorbereitet hat (aus PowerShell,
weil Git Bash die `/`-Optionen umschreibt):

```powershell
& "<Kopie>\makeappx.exe" pack /o /p release\<version>\Missing-Hours-Store-local-x64.appx /f release\<version>\__appx-x64\mapping.txt
```

**Installieren ohne Store** (nur zum Testen): Entwicklermodus einschalten (Windows-Einstellungen > System >
Für Entwickler), dann das ungepackte Layout registrieren. `win-unpacked` liegt dabei unter `app\`, die
Kacheln unter `assets\`, wie in `mapping.txt`:

```powershell
Add-AppxPackage -Register <Layout-Ordner>\AppxManifest.xml
explorer.exe "shell:AppsFolder\<PackageFamilyName>!MissingHours"   # starten
Remove-AppxPackage -Package <PackageFullName>                  # wieder entfernen
```

`PackageFamilyName` und `PackageFullName` zeigt `Get-AppxPackage -Name <identityName>`. Achtung: Die
Testversion trackt echt und schreibt in `%APPDATA%\missing-hours`, wenn der Ordner existiert (siehe oben).

Geprüft am 2026-11-11: Start aus dem Startmenü, Einstellungen zeigen den Knopf statt Schalter und keine
Beta-Option, der Knopf öffnet „Apps > Autostart“, dort steht Missing Hours auf „Ein“, kein Eintrag unter
`HKCU\…\Run`.
