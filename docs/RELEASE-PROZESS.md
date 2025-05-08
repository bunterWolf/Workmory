# Release-Prozess für Workmory

Dieses Dokument beschreibt den vollständigen Release-Prozess für Workmory, einschließlich Beta-Releases und stabilen Releases.

## Übersicht

Der Release-Prozess verwendet:
1. Lokale Skripte zur Versionsverwaltung und Tag-Erstellung
2. GitHub Actions für automatisierte Builds
3. electron-builder für die Erstellung von Installationspaketen
4. GitHub Releases für die Veröffentlichung

## Workflow

### 1. Lokale Vorbereitung

#### Für Beta-Releases:

```bash
# Wechsle zu einem Beta-Branch
git checkout beta/v1.x.x  # oder: git checkout beta

# Stelle sicher, dass alles committed ist
git status

# Erzeuge ein neues Beta-Release
npm run release:beta
```

#### Für stabile Releases:

```bash
# Wechsle zum main Branch
git checkout main

# Stelle sicher, dass alles committed ist
git status

# Erzeuge ein neues Release
npm run release
```

### 2. Automatisierter Build-Prozess

Sobald das Tag gepusht wird:

1. GitHub Actions wird automatisch ausgelöst
2. Die Anwendung wird für Windows und macOS gebaut
3. electron-builder erstellt ein GitHub Release
   - Beta-Releases werden als Pre-Releases markiert
   - Stabile Releases werden als reguläre Releases markiert
4. Die Installationsdateien werden hochgeladen

### 3. Aktualisierung für Benutzer

- Benutzer mit Beta-Updates aktiviert erhalten Beta-Releases automatisch
- Alle Benutzer erhalten stabile Releases automatisch

## Technische Details

### Umgebungsvariablen

- `EP_PRE_RELEASE`: Steuert, ob electron-builder ein Pre-Release oder reguläres Release erstellt
  - `true` = Pre-Release (Beta)
  - `false` = Reguläres Release
- `ELECTRON_BUILDER_PUBLISH_CHANNEL`: Bestimmt den Veröffentlichungskanal
  - `beta` = Beta-Kanal (generiert `beta.yml` für Updates)
  - `latest` = Standard-Kanal (generiert `latest.yml` für Updates)

### Konfiguration

Die Hauptkonfiguration für den Release-Prozess befindet sich in:
- `package.json` - electron-builder Konfiguration
- `.github/workflows/release.yml` - GitHub Actions Workflow
- `scripts/release.js` und `scripts/release-beta.js` - Lokale Release-Skripte
- `src/main/main.ts` - Auto-Updater-Konfiguration

### Update-Dateien

Für die automatischen Updates werden folgende Dateien generiert:
- `latest.yml` - Für Standard-Updates
- `beta.yml` - Für Beta-Updates

Der Auto-Updater sucht je nach Konfiguration nach der entsprechenden Datei.

### Fallback-Mechanismus

Falls die automatische Release-Erstellung durch electron-builder fehlschlägt, enthält der GitHub Actions Workflow einen Fallback-Job, der ein Release manuell erstellt und die Artefakte hochlädt.

## Fehlerbehebung

### Doppelte Releases

Wenn doppelte Releases angezeigt werden, könnte das folgende Ursachen haben:
- Manuelles Erstellen eines Releases mit demselben Tag
- Fehler in der Release-Konfiguration

**Lösung**: 
Die publish-Konfiguration in package.json wurde aktualisiert, um eine dynamische Konfiguration basierend auf der EP_PRE_RELEASE-Umgebungsvariable zu verwenden. Dies verhindert, dass beim Beta-Release sowohl ein reguläres als auch ein Beta-Release erstellt wird.

```json
"publish": {
  "provider": "github",
  "owner": "bunterWolf",
  "repo": "Workmory",
  "releaseType": "${env.EP_PRE_RELEASE === 'true' ? 'prerelease' : 'release'}",
  "channel": "${env.EP_PRE_RELEASE === 'true' ? 'beta' : 'latest'}"
}
```

Diese Änderung stellt sicher, dass jetzt nur noch ein Release pro Tag erstellt wird.

### Fehlende Artefakte

Wenn Artefakte fehlen, überprüfe:
- Die Build-Logs in GitHub Actions
- Die Pfade in der Upload-Artifacts-Konfiguration

## Best Practices

1. Verwende konventionelle Commit-Nachrichten für aussagekräftige Changelogs
2. Teste Beta-Releases gründlich, bevor du einen stabilen Release erstellst
3. Halte die Dokumentation aktuell 