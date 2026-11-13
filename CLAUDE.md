# CLAUDE.md

Guidance for Claude (and other AI assistants) working in this repository.

## Project overview

**Missing Hours** is an Electron desktop app for **automatic activity tracking**. It records which
applications/windows are used and detects inactivity, then aggregates this into a per-day timeline.
It is **local-first and privacy-first**: all data stays on the user's machine, nothing is sent to a
server.

## ⚠️ Critical: data correctness is the product

Missing Hours visualizes how people spend time at their PC so they can do **time tracking and create
invoices** from it. Tracked, aggregated, and visualized data therefore feeds **real billing** —
mistakes have real financial consequences.

Because of this, treat the tracking → aggregation → visualization pipeline as the most sensitive
part of the codebase:

- **Be extremely careful** with any change to watchers, `HeartbeatManager`, `ActivityStore`,
  `AggregationManager`, `TimelineGenerator`, or the timeline rendering.
- **It is test-driven for a reason.** Never change aggregation behavior without updating/extending
  the tests (`src/store/ActivityStore.test.ts`, `src/store/TimelineGenerator.test.ts`) and confirming
  they pass. Prefer adding a failing test first.
- **Don't guess the rules** — the exact aggregation/priority/merging rules are specified in
  `docs/Engineering Design Dokument.md` and `docs/User Requirements.md`. Read them before touching
  this logic.
- When in doubt about correctness, surface the uncertainty instead of shipping a plausible-looking change.

## Documentation map (authoritative sources)

These docs are the **source of truth** for behavior, architecture, and process. Read the relevant
one before making related changes, and **keep it in sync** when behavior changes.

| For… | Read |
| --- | --- |
| Architecture, data model, aggregation/priority/merge rules | `docs/Engineering Design Dokument.md` |
| What the app *must* do (user-facing requirements) | `docs/User Requirements.md` |
| Stable release process | `docs/RELEASE-PROZESS.md` |
| Beta release process | `docs/BETA-RELEASE-PROZESS.md` |
| Microsoft Store package (MSIX), Partner Center steps, Store-specific behavior | `docs/MICROSOFT-STORE.md` |
| Privacy policy (linked from the Store listing; keep in sync with what is recorded) | `PRIVACY.md` |
| Coding pattern preferences (original) | `.cursor/rules/coding-pattern-preferences.mdc` |
| UI: Figma node/variable → file/class/token mapping, Figma update checklist | `docs/design/figma-map.md` |

## Architecture at a glance

```
OS events → Watcher → Heartbeat (every 30s) → ActivityStore → Aggregation (5/10/15 min) → IPC → Renderer (React)
```

Main process / renderer process architecture connected via Electron IPC.

| Module | Responsibility |
| --- | --- |
| `src/main/main.ts` | App entry: windows, IPC handlers, auto-update, auto-launch, app-icon resolution; wires up store + heartbeat manager. In the Microsoft Store build (`isWindowsStore`) auto-update and auto-launch are off (Store updates, package startup task) |
| `src/main/appIcon.ts` | Reads an app's icon from its Windows executable (`app.getFileIcon` cannot load PNG icon frames in the Chromium sandbox and returns the generic icon) and derives its brand color; no icon or no brand color falls back to the default event style (`--event-default`) |
| `src/store/ActivityStore.ts` | Core: stores/persists heartbeats, triggers aggregation, cleanup, settings; `markSuspend` remembers a system sleep for the absence rule |
| `src/store/HeartbeatManager.ts` | Emits a heartbeat at :15 and :45 each minute (every 30s), collects data from watchers, supports pause/resume |
| `src/store/AggregationManager.ts` / `TimelineGenerator.ts` | Aggregate heartbeats into fixed-boundary timeline blocks; merge consecutive identical blocks; compute the day summary |
| `src/watchers/ActiveWindowWatcher.ts` | Current active window/app (via `active-win`) |
| `src/watchers/InactivityWatcher.ts` | `active` / `may_be_inactive` / `inactive` based on input since last heartbeats |
| `src/store/AbsenceBackfill.ts` | Rule 7: on an `inactive` heartbeat, `backfillAbsence` walks back across days and converts `may_be_inactive` to `inactive` until the last `active` heartbeat or a gap > `MAX_HEARTBEAT_GAP_MS` (app not running / PC asleep); also `findLastActiveTimestamp`, `ABSENCE_THRESHOLD_MS` |
| `src/store/UserDataMigration.ts` | The app was called Workmory before: on start, `migrateLegacyUserData` copies `settings.json` and the activity store from the old `Workmory` userData folder once, never overwriting; on failure `main.ts` keeps using the old folder |
| `src/store/ActivityPersistence.ts` | JSON persistence in `app.getPath('userData')` |
| `src/store/ActivityIpc.ts` | IPC bridge between store and renderer; tells the renderer about new data via `activity-data-updated` |
| `src/components/{ui,window,toolbar,timeline,footer,settings}/`, `src/renderer/` | React UI (title bar, toolbar, timeline, footer, settings view), one folder per area; Figma node id in each file header |

**Aggregation rules are subtle** (fixed time boundaries, "at least half the interval must have
heartbeats", type priority `inactive > appWindow`, merging of consecutive identical blocks). The
full spec is in `docs/Engineering Design Dokument.md` §2.2 — note the doc still describes Teams
meeting tracking, which is no longer a pursued feature. Do not reinvent the rules from the code.

## Tech stack & project layout

- **Electron** + **TypeScript** for the backend/main side.
- **React** in the renderer, written as **plain JavaScript** (`src/components/<area>/*.js` — `footer/`, `settings/`, `timeline/`, `toolbar/`, `ui/`, `window/` — plus `src/components/App.js` and `src/renderer/*.js`)
  — no TypeScript, no router, no third-party UI library.
- **Plain CSS**, organized after the Figma file (see `docs/design/figma-map.md`): `src/styles/tokens.css`
  holds the Figma variables 1:1 (light in `:root`, dark via `prefers-color-scheme`), `typography.css` the
  Figma text styles, `base.css` the reset and the bundled Inter font (`@fontsource/inter`, no CDN).
  Component CSS lives next to each component, uses only `var(--…)` tokens plus named constants with
  Figma node id, and uses the class prefix `wm-<component>`. All designer-editable, no CSS framework.
- **Webpack** bundles the renderer; **tsc** compiles the main/store/watchers TypeScript to `dist/`.
- **Jest** (ts-jest) for tests.

> Note: the design doc describes the renderer as "typed React"; in reality the renderer is plain JS.
> This file reflects the actual state — backend is TS, renderer is JS.

```
src/
  main/        # Electron main process (TypeScript)
  store/       # ActivityStore, aggregation, persistence, IPC, settings (TypeScript, tested)
  watchers/    # Active-window / inactivity watchers (TypeScript)
  components/  # React components (plain JS) + per-component CSS, by area: ui/ window/ toolbar/ timeline/ footer/ settings/ (+ App.js shell)
  renderer/    # Renderer entry (index.html / index.js)
  styles/      # tokens.css (Figma variables), typography.css (text styles), base.css (reset, Inter)
  assets/      # icons/ holds the SVGs from Figma (the app icon lives in resources/)
resources/     # electron-builder build resources: app icons and Store tiles (generated by `npm run icons`), appx extensions
docs/          # Authoritative design, requirements, and release docs (design/figma-map.md maps Figma to code)
scripts/       # Mock-data generation, release/beta automation
```

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Compile TS + watch webpack + launch Electron |
| `npm run dev:mock` | Run with sample data from `public/mock-data.json` (no real tracking, no saving) |
| `npm test` | Generate mock data, then run Jest |
| `npm run test:watch` | Jest in watch mode |
| `npm run build` | `npm test` → `tsc` → webpack (build gate) |
| `npm run dist:win` / `dist:mac` | Build platform installers |
| `npm run dist:store` | Build the Microsoft Store package (MSIX/AppX) |
| `npm run icons` | Regenerate all app icons (`.ico`, `.icns`, `.png`, Store tiles) from `resources/icon-source/icon.svg` |
| `npm run release` | Stable release (version, changelog, tag, push → GitHub Actions) |
| `npm run release:beta` | Beta pre-release from a `beta` branch |

Mock data exists **only** for development/testing via the `--mock-data` flag. See README §"Using Mock Data".

## Conventions & invariants

**Privacy / data invariants (do not violate):**
- **Local-only.** Never add network transmission of tracked data. No telemetry, no external servers.
- **No mock/fake/stub data in dev or prod paths.** Mocking is for tests only (and the explicit
  `--mock-data` flag). Never inject fake data into code that affects real tracking.
- Never overwrite a `.env` file without asking first.

**Coding preferences** (condensed from `.cursor/rules/coding-pattern-preferences.mdc`):
- Prefer simple solutions; avoid duplication — check for existing similar code first.
- Account for the three environments: dev, test, prod.
- Only make changes that are requested or clearly understood and related to the request.
- When fixing a bug, exhaust the existing pattern before introducing a new one; if you do replace it,
  remove the old implementation so there's no duplicate logic.
- Keep files small — refactor when a file grows past ~200–300 lines.
- Keep the codebase clean and organized; avoid one-off throwaway scripts in files.

**Commits & releases:**
- Use **Conventional Commits** (`feat:`, `fix:`, `docs:`, `chore:`, `refactor:`, `test:`, …).
  `standard-version` generates the changelog from them, so the prefix matters.
- Don't run a release (`npm run release` / `release:beta`) unless explicitly asked — it tags and
  pushes. Follow `docs/RELEASE-PROZESS.md` / `docs/BETA-RELEASE-PROZESS.md`.

## Branches (read this before starting new work)

```
feature branch --merge--> beta/v0.0.2 --tag--> published beta --fast-forward--> main
```

`main` always holds the latest published beta, so it is the place to start from. The app has no
stable release yet.

**Starting new work:**
- Create one branch per topic from the current `origin/main`, named `<type>/<short-topic>`
  (`feat/`, `fix/`, `refactor/`, `docs/`, `chore/`):
  `git fetch origin && git switch -c fix/my-topic origin/main`
- In a worktree the app already created, check the base with
  `git merge-base --is-ancestor origin/main HEAD`. If that fails, run `git merge origin/main` before
  making changes.
- Never commit directly to `main` or the beta branch.

**Leave these to the release step:** the version in `package.json`, `CHANGELOG.md`, tags, and merging
into the beta branch or `main`. They happen only when the user asks for a release.

**Before handing a branch over for release:** if `origin/main` has moved, merge it into the branch and
resolve conflicts there, while the context is still available. Then confirm `npm test` is green.

**Release management** (full steps in `docs/BETA-RELEASE-PROZESS.md`): merge the feature branch into the
current beta branch (`beta/v0.0.2`), run `npm run release:beta` there, verify the published release, then
fast-forward `main` to the beta branch. Release fixes are the only commits made directly on the beta branch.

## Working with Claude (recommended workflow)

These are recommendations, not hard gates — scale them to the size of the change.

- **Bigger or fuzzy features:** use the `brainstorming` skill to pin down the design before coding,
  especially anything touching tracking/aggregation/timeline (see the data-correctness section above).
- **Multi-step work:** use `writing-plans` to lay out an implementation plan first.
- **Before a release or when wrapping up a change:** use `verify` to actually run the app and
  confirm behavior, and `code-review` on the diff.
- **Touching the aggregation pipeline:** write/adjust tests first, then change code, then confirm the
  full `npm test` suite is green before considering it done.
