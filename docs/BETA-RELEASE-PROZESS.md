# Beta-Release-Prozess

Dieses Dokument beschreibt den Prozess zur Erstellung von Beta-Releases für Chronflow.

## Übersicht

Der Beta-Release-Prozess verwendet dedizierte Beta-Branches, um Vorversionen zu erstellen und zu testen, bevor sie in den Hauptrelease-Zyklus integriert werden.

## Workflow

### 1. Beta-Branch erstellen

Um einen neuen Beta-Branch zu erstellen:

```bash
# Empfohlen: Starte vom develop-Branch
git checkout develop
git pull origin develop

# Alternative: Automatisiertes Tool verwenden
npm run beta:create
```

Das Tool `npm run beta:create` führt dich durch die folgenden Schritte:
- Prüft, ob du auf dem develop-Branch bist
- Stellt sicher, dass alle Änderungen committed sind
- Schlägt einen Branchnamen basierend auf der aktuellen Version vor
- Erstellt den Branch
- Bietet an, den Branch direkt zu pushen

### 2. Änderungen vornehmen

Auf dem Beta-Branch kannst du nun:
- Letzte Bugfixes für die Beta-Version vornehmen
- Tests durchführen
- Alles committen

### 3. Beta-Release erstellen

Wenn der Beta-Branch bereit ist:

```bash
npm run release:beta
```

Dieses Skript:
- Prüft, ob du auf einem Beta-Branch bist (Name beginnt mit `beta` oder `beta/`)
- Erstellt einen neuen Tag mit Beta-Suffix (z.B. v1.2.0-beta.0)
- Aktualisiert package.json mit der neuen Version
- Generiert einen Changelog
- Pusht den Branch und den Tag

### 4. GitHub Action

Sobald der Tag gepusht wird:
- Die GitHub Action wird automatisch ausgelöst
- Sie erkennt, dass es sich um einen Beta-Release handelt
- Baut die Anwendung
- Erstellt ein GitHub Pre-Release
- Lädt die Installationsdateien hoch

### 5. Beta-Testing

Beta-Tester können nun:
- Die Anwendung aus dem GitHub Pre-Release installieren
- Oder, wenn sie die Beta-Updates aktiviert haben, über den Auto-Update-Mechanismus aktualisieren

### 6. Weitere Beta-Versionen

Falls nach dem Testing Probleme gefunden werden:
- Fixe die Probleme im Beta-Branch
- Führe erneut `npm run release:beta` aus
- Ein neuer Tag wird erstellt (z.B. v1.2.0-beta.1)

### 7. Finaler Release

Wenn das Beta-Testing erfolgreich war:

```bash
# Zum main-Branch wechseln
git checkout main

# Beta-Branch in main mergen
git merge beta/v1.2.0  # oder wie auch immer dein Beta-Branch heißt
git push origin main

# Stabilen Release erstellen
npm run release
```

## Beta-Updates für Benutzer

Benutzer können Beta-Updates erhalten, indem sie:
1. Die Umgebungsvariable `ALLOW_PRERELEASE=true` setzen
2. Die Anwendung neu starten

Oder:
- Manuell den Beta-Installer von GitHub herunterladen und installieren

## Beta-Branch-Struktur

Es gibt zwei empfohlene Namenskonventionen für Beta-Branches:
- `beta` (ein einzelner Langzeit-Beta-Branch)
- `beta/v1.2.0` (versionsspezifische Beta-Branches)

Das Release-Skript akzeptiert beide Formate.

## Commit-Konventionen

Verwende konventionelle Commit-Nachrichten, um einen aussagekräftigen Changelog zu generieren:

- `feat: Neue Funktion hinzugefügt`
- `fix: Problem mit X behoben`
- `docs: Dokumentation aktualisiert`
- usw.

Diese Konventionen werden von standard-version verwendet, um automatisch den Changelog zu generieren. 