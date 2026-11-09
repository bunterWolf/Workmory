# Beta Release Prozess

Dieses Dokument beschreibt, wie ein Beta-Release für Workmory entsteht. Lokal wird nur die Version
erhöht und ein Tag gepusht; gebaut und veröffentlicht wird ausschließlich von GitHub Actions.

## Grundregeln

- **Betas entstehen auf einem Beta-Branch** (`beta` oder `beta/*`), das Skript prüft den Namen.
  Aktuell ist das `beta/v0.0.2`.
- **Die Version in `package.json` muss die zuletzt veröffentlichte Beta sein.** Das Skript zählt von
  dort weiter. Steht dort eine ältere Version, kollidiert der neue Tag mit
  einem vorhandenen oder die Version ist niedriger als die letzte Beta, und der Auto-Updater bietet
  sie nicht an. Darum neue Arbeit in den bestehenden Beta-Branch mergen, statt vom
  Feature-Branch aus zu releasen.
- **`main` folgt der Beta.** Neue Branches starten von `origin/main` (siehe `CLAUDE.md`). Nach jedem
  veröffentlichten Beta-Release wird `main` nachgezogen (Schritt 7), damit dort auch alle
  Release-Korrekturen liegen. Auf `main` wird nicht direkt committet.
- **Einen Tag nie verschieben oder neu vergeben.** Bei einem Fehlschlag den Lauf neu starten (siehe
  unten) oder eine neue Beta-Version erstellen.

## Ablauf

### 1. Änderungen in den Beta-Branch bringen

```bash
git checkout beta/v0.0.2
git pull origin beta/v0.0.2
git merge <feature-branch>
```

Wird der Beta-Branch von einem Stand übernommen, der den alten Beta-Inhalt ersetzt, bleibt die
Historie mit `git merge -s ours` erhalten. Dann müssen die Version aus dem alten Beta-Branch und alle
Release-Korrekturen von Hand übernommen werden.

> `npm run beta:create` ist veraltet: Das Skript geht von einem `develop`-Branch aus und schlägt bei
> einer Beta-Version in `package.json` einen falschen Branchnamen vor.

### 2. Vorab prüfen

```bash
npm install
npm test
npx standard-version --prerelease beta --dry-run
```

Der Testlauf von `standard-version` ändert nichts und zeigt die nächste Version und den Changelog.
Die Version muss direkt auf die letzte Beta folgen (siehe `gh release list`).

Wurde die Build-Konfiguration in `package.json` geändert, zusätzlich das Packen lokal prüfen:

```bash
npx electron-builder --publish never
```

Wurde Electron aktualisiert, prüfen, ob `node-version` in `.github/workflows/release.yml` zu dessen
`engines` passt.

### 3. Beta-Release erstellen

```bash
npm run release:beta
```

Das Skript prüft Branch und Arbeitsverzeichnis, erhöht die Version (z. B. `0.0.2-beta.3` →
`0.0.2-beta.4`), schreibt den Changelog, führt den Build mit Tests aus, committet, taggt und pusht
Branch und Tag.

Schlagen Tests oder Build fehl, bricht das Skript vor dem Commit ab: Es entsteht kein Tag und kein
Push, aber die Versionsänderung bleibt im Arbeitsverzeichnis. Vor dem nächsten Versuch zurücksetzen:

```bash
git restore package.json package-lock.json CHANGELOG.md
```

### 4. GitHub Action

Der Tag löst `.github/workflows/release.yml` aus:

1. **`build`** läuft unabhängig voneinander auf Windows und macOS: Tests, Kompilieren, Packen. Das
   Packen wird bis zu dreimal versucht, weil electron-builder dabei Werkzeuge von GitHub lädt und
   diese Downloads gelegentlich mit `504` scheitern. Fehlgeschlagene Tests werden nicht wiederholt.
2. **`publish`** läuft nur, wenn beide Builds erfolgreich waren, und erstellt das Release in einem
   Schritt. Schlägt ein Build fehl, wird nichts veröffentlicht. Tags mit `beta` im Namen werden zum
   Pre-Release.

### 5. Ergebnis prüfen

```bash
gh run list --workflow=release.yml --limit 1
gh release view v<version> --json isPrerelease,assets -q '{pre:.isPrerelease,assets:[.assets[].name]}'
```

Ein vollständiges Release enthält:

- `Workmory-Setup-<version>-win-x64.exe` mit `.blockmap` und `Workmory-<version>-win-x64.zip`
- `Workmory-<version>-mac-x64.zip` und `Workmory-<version>-mac-arm64.zip`, jeweils mit `.blockmap`
- `latest.yml` und `latest-mac.yml` mit der neuen Version

### 6. Wenn der Build fehlschlägt

Log lesen:

```bash
gh run view <run-id> --log-failed
```

- **Vorübergehender Fehler** (z. B. `504`, Netzwerk): denselben Lauf neu starten. Tag und Commit
  bleiben gleich.

  ```bash
  gh run rerun <run-id> --failed
  ```

- **Fehler im Code oder in der Konfiguration:** im Beta-Branch beheben und mit `npm run release:beta`
  eine neue Beta-Version erstellen. Der Workflow läuft immer in der Fassung des getaggten Commits; ein
  Neustart übernimmt also keine Korrektur.

### 7. `main` nachziehen

Erst wenn das Release veröffentlicht und geprüft ist. Auf `main` gibt es keine eigenen Commits, das
ist also immer ein Fast-Forward; schlägt der Push fehl, nicht erzwingen, sondern die Ursache klären.

```bash
git push origin beta/v0.0.2:main
```

### 8. Finaler Release

Wenn das Beta-Testing erfolgreich war:

```bash
git checkout main
git pull origin main
npm run release
```

Siehe [RELEASE-PROZESS.md](RELEASE-PROZESS.md).

## Branch-Pflege

Nach jedem Beta-Release, wenn `main` nachgezogen ist:

- Branches, deren Commits vollständig in `main` sind, lokal und online löschen, samt ihrem Worktree,
  wenn er sauber ist. Ausgenommen sind `main`, der aktuelle Beta-Branch und Branches, in denen gerade
  gearbeitet wird; ein neuer Branch ohne Commits gilt sonst fälschlich als gemergt.
- Branches mit eigenen Commits nur nach Rückfrage löschen. Vorher mit einem Tag sichern:

  ```bash
  git tag archive/<name> <branch>
  git push origin refs/tags/archive/<name>
  ```

Der Release-Workflow reagiert nur auf Tags, die mit `v` beginnen, ein Archiv-Tag startet also keinen
Build. Wiederherstellen lässt sich ein Branch mit `git switch -c <name> archive/<name>`.

## Beta-Updates für Benutzer

- In den Einstellungen **„Auf Beta-Versionen aktualisieren“** einschalten. Der Auto-Updater berücksichtigt dann
  auch Pre-Releases (`autoUpdater.allowPrerelease`).
- Oder den Installer von der GitHub-Release-Seite herunterladen. Für weitere Beta-Updates muss der
  Schalter trotzdem eingeschaltet sein.

## Commit-Konventionen

`standard-version` erzeugt den Changelog aus [Conventional Commits](https://www.conventionalcommits.org/)
(`feat:`, `fix:`, `docs:`, …). Der Präfix bestimmt, ob und wo ein Commit im Changelog erscheint.
