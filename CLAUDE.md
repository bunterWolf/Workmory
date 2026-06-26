# CLAUDE.md

Guidance for Claude (and other AI assistants) working in this repository.

## Project overview

**Workmory** is an Electron desktop app for **automatic activity tracking**. It records which
applications/windows are used and detects inactivity, then aggregates this into a per-day timeline.
It is **local-first and privacy-first**: all data stays on the user's machine, nothing is sent to a
server.

## ⚠️ Critical: data correctness is the product

Workmory visualizes how people spend time at their PC so they can do **time tracking and create
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
| Coding pattern preferences (original) | `.cursor/rules/coding-pattern-preferences.mdc` |

## Architecture at a glance

```
OS events → Watcher → Heartbeat (every 30s) → ActivityStore → Aggregation (5/10/15 min) → IPC → Renderer (React)
```

Main process / renderer process architecture connected via Electron IPC.

| Module | Responsibility |
| --- | --- |
| `src/main/main.ts` | App entry: windows, IPC handlers, auto-update, auto-launch, app-icon resolution; wires up store + heartbeat manager |
| `src/store/ActivityStore.ts` | Core: stores/persists heartbeats, triggers aggregation, cleanup, settings |
| `src/store/HeartbeatManager.ts` | Emits a heartbeat at :15 and :45 each minute (every 30s), collects data from watchers, supports pause/resume |
| `src/store/AggregationManager.ts` / `TimelineGenerator.ts` | Aggregate heartbeats into fixed-boundary timeline blocks; merge consecutive identical blocks; compute the day summary |
| `src/watchers/ActiveWindowWatcher.ts` | Current active window/app (via `active-win`) |
| `src/watchers/InactivityWatcher.ts` | `active` / `may_be_inactive` / `inactive` based on input since last heartbeats |
| `src/store/ActivityPersistence.ts` | JSON persistence in `app.getPath('userData')` |
| `src/store/ActivityIpc.ts` | IPC bridge between store and renderer |
| `src/components/*.js`, `src/renderer/` | React UI (timeline, header, footer, settings) |

**Aggregation rules are subtle** (fixed time boundaries, "at least half the interval must have
heartbeats", type priority `inactive > appWindow`, merging of consecutive identical blocks). The
full spec is in `docs/Engineering Design Dokument.md` §2.2 — note the doc still describes Teams
meeting tracking, which is no longer a pursued feature. Do not reinvent the rules from the code.

## Tech stack & project layout

- **Electron** + **TypeScript** for the backend/main side.
- **React** in the renderer, written as **plain JavaScript** (`src/components/*.js`, `src/renderer/*.js`)
  — no TypeScript, no router, no third-party UI library.
- **Plain CSS**, organized as a small design system in `src/styles/`: `colors_and_type.css`
  (design tokens) and `workmory.css` (component/layout styles) hold the bulk of the styling. The
  per-component `src/components/*.css` files are now thin glue. All designer-editable, no CSS framework.
- **Webpack** bundles the renderer; **tsc** compiles the main/store/watchers TypeScript to `dist/`.
- **Jest** (ts-jest) for tests.

> Note: the design doc describes the renderer as "typed React"; in reality the renderer is plain JS.
> This file reflects the actual state — backend is TS, renderer is JS.

```
src/
  main/        # Electron main process (TypeScript)
  store/       # ActivityStore, aggregation, persistence, IPC, settings (TypeScript, tested)
  watchers/    # Active-window / inactivity watchers (TypeScript)
  components/  # React components (plain JS) + per-component CSS
  renderer/    # Renderer entry (index.html / index.js)
  styles/      # Design system: design tokens (colors_and_type.css) + component/layout styles (workmory.css)
  assets/      # Logos / icons
docs/          # Authoritative design, requirements, and release docs
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

## Working with Claude (recommended workflow)

These are recommendations, not hard gates — scale them to the size of the change.

- **Bigger or fuzzy features:** use the `brainstorming` skill to pin down the design before coding,
  especially anything touching tracking/aggregation/timeline (see the data-correctness section above).
- **Multi-step work:** use `writing-plans` to lay out an implementation plan first.
- **Before a release or when wrapping up a change:** use `verify` to actually run the app and
  confirm behavior, and `code-review` on the diff.
- **Touching the aggregation pipeline:** write/adjust tests first, then change code, then confirm the
  full `npm test` suite is green before considering it done.
