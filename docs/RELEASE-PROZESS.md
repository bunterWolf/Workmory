# Release-Prozess für Workmory

Dieses Dokument beschreibt den Release-Prozess für stabile Releases und die Technik dahinter. Beta-Releases
stehen im Detail in [BETA-RELEASE-PROZESS.md](BETA-RELEASE-PROZESS.md).

## Übersicht

1. Lokale Skripte erhöhen die Version, schreiben den Changelog und pushen einen Tag.
2. Der Tag löst GitHub Actions aus. Dort wird für Windows und macOS getestet, gebaut und gepackt.
3. Erst wenn beide Plattformen erfolgreich waren, entsteht das GitHub Release mit allen Dateien.

Lokal wird nichts veröffentlicht.

## Stabiler Release

```bash
git checkout main
git status   # muss sauber sein
npm run release
```

Das Skript läuft nur auf `main`. Es erhöht die Version, schreibt den Changelog, führt den Build mit
Tests aus, committet, taggt und pusht.

Ein stabiler Release wird sofort als reguläres Release veröffentlicht, nicht als Entwurf. Alle
Benutzer erhalten ihn über den Auto-Updater.

> Dieser Weg wurde bisher noch nicht mit einem echten stabilen Release durchlaufen.

Soll die Version in den Microsoft Store, muss sie mit mindestens `1` beginnen (`1.0.0`, nicht `0.x`).
Das Einreichen steht in [MICROSOFT-STORE.md](MICROSOFT-STORE.md).

## Technische Details

### Workflow (`.github/workflows/release.yml`)

| Job | Läuft auf | Aufgabe |
| --- | --- | --- |
| `build` | Windows, macOS | `npm run build` (Tests, TypeScript, Webpack), dann `electron-builder --publish never` mit bis zu drei Versuchen; lädt die Dateien als Artefakte hoch. Bei Tags ohne `beta` baut Windows zusätzlich das Microsoft-Store-Paket (Artefakt `microsoft-store-package`, nicht im Release, siehe [MICROSOFT-STORE.md](MICROSOFT-STORE.md)) |
| `publish` | Ubuntu | läuft nur, wenn alle Builds erfolgreich waren; erstellt das Release und lädt alle Dateien hoch |

- Die Plattformen brechen sich gegenseitig nicht ab (`fail-fast: false`).
- Tags mit `beta` im Namen werden zum Pre-Release, alle anderen zum regulären Release.
- `node-version` muss die `engines`-Vorgabe der Electron-Version in `package.json` erfüllen.

### Konfiguration

- `package.json`: electron-builder (`build`), `standard-version`
- `.github/workflows/release.yml`: GitHub Actions
- `scripts/release.js`, `scripts/release-beta.js`: lokale Release-Skripte
- `src/main/main.ts`: Auto-Updater

### Update-Dateien

electron-builder erzeugt `latest.yml` (Windows) und `latest-mac.yml` (macOS). Es gibt keine eigenen
Dateien für den Beta-Kanal: Stabile Releases und Betas nutzen dieselben Dateinamen, jeweils im eigenen
Release. Der Einstellungs-Schalter für Beta-Updates setzt `autoUpdater.allowPrerelease`; damit
berücksichtigt der Auto-Updater auch Pre-Releases.

## Fehlerbehebung

### Der Build ist fehlgeschlagen

Es wurde nichts veröffentlicht. Log lesen:

```bash
gh run view <run-id> --log-failed
```

- **Vorübergehender Fehler** (z. B. `Response code 504`): `gh run rerun <run-id> --failed`. Ein `504` beim
  Packen stammt von den Downloads, mit denen electron-builder seine Werkzeuge von GitHub lädt, nicht
  vom Veröffentlichen.
- **Fehler im Code oder in der Konfiguration:** beheben und eine neue Version erstellen. Ein Neustart
  nutzt immer den Workflow und den Code des getaggten Commits.

### Es fehlen Dateien im Release

- Prüfen, ob die Dateinamen noch zu `release/*/Workmory-*` und `release/*/latest*.yml` im Upload-Schritt
  und zu den `files` im Schritt `Create GitHub Release` passen.
- Die erwartete Dateiliste steht in [BETA-RELEASE-PROZESS.md](BETA-RELEASE-PROZESS.md).

### Die Konfiguration von electron-builder wird abgelehnt

Das Packen lokal prüfen, ohne etwas zu veröffentlichen:

```bash
npx electron-builder --publish never
```

## Best Practices

1. Conventional Commits verwenden, der Changelog entsteht daraus.
2. Beta-Releases mit echtem Tracking testen, bevor ein stabiler Release erstellt wird.
3. Release-Korrekturen immer auch nach `main` bringen.
