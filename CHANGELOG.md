# Changelog

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

### [0.0.2-beta.9](https://github.com/bunterWolf/Missing-Hours/compare/v0.0.2-beta.8...v0.0.2-beta.9) (2026-11-13)


### Features

* new squirrel app icon for Windows, macOS and the Store ([611a7ef](https://github.com/bunterWolf/Missing-Hours/commit/611a7eff85c494539aa014e711d1c7317f203a8b))

### [0.0.2-beta.8](https://github.com/bunterWolf/Missing-Hours/compare/v0.0.2-beta.7...v0.0.2-beta.8) (2026-11-12)


### Features

* package Workmory for the Microsoft Store ([a6a6fea](https://github.com/bunterWolf/Missing-Hours/commit/a6a6fea112b98c34503eee3d4cb9c57ce33b5d3a))
* rename the app from Workmory to Missing Hours ([635d342](https://github.com/bunterWolf/Missing-Hours/commit/635d3421361725941115152e9eee415bf56bae71))


### Bug Fixes

* take over the old data folder by its real name, not in mock mode ([60ec633](https://github.com/bunterWolf/Missing-Hours/commit/60ec6331ea4d6d59af364eda60aa8dcfdf8bb3f9))

### [0.0.2-beta.7](https://github.com/bunterWolf/Workmory/compare/v0.0.2-beta.6...v0.0.2-beta.7) (2026-11-09)


### Features

* show rotating phrases in the running block, remove update banner ([6e603ca](https://github.com/bunterWolf/Workmory/commit/6e603caa5420945e54e962f79b02c26c09b3452c))


### Documentation

* define where new branches start and keep main on the latest beta ([7e1a428](https://github.com/bunterWolf/Workmory/commit/7e1a4284096df3b8fe57710a7e8c827c755f028a))
* describe branch cleanup after a beta release ([175ad7d](https://github.com/bunterWolf/Workmory/commit/175ad7d9a8c25c764949d85bd30d2aa5764a1247))

### [0.0.2-beta.6](https://github.com/bunterWolf/Workmory/compare/v0.0.2-beta.5...v0.0.2-beta.6) (2026-11-08)


### Bug Fixes

* backfill absences across midnight and multiple days ([96a0e09](https://github.com/bunterWolf/Workmory/commit/96a0e09ebc9445c4d04671952b66dc22de218a3d))
* count system sleep toward absences without tracking it ([5a0b347](https://github.com/bunterWolf/Workmory/commit/5a0b347814d09b48b4cd97ac9dce114c1c03629a))
* ignore suspend right after input ([00967ed](https://github.com/bunterWolf/Workmory/commit/00967ed221a7e0e0a86f7c3bff19123de075e8f4))
* measure absence to the input and harden the midnight sleep test ([f789651](https://github.com/bunterWolf/Workmory/commit/f7896513201262d7890c16d0e4a47cdc3441639f))
* pick block type by type majority as specified ([25a4076](https://github.com/bunterWolf/Workmory/commit/25a4076617db1389521ba6cfdda044e988a500e6))
* run tests and build in the release scripts again ([3f502b6](https://github.com/bunterWolf/Workmory/commit/3f502b66d4dcf21a619fb4e7bb24541182bd4e55))
* stop absence backfill at heartbeat gaps ([d69baa3](https://github.com/bunterWolf/Workmory/commit/d69baa3b116720b4e12def05e8b5afb175c61cd5))
* use local days for the aggregation cache and cleanup ([2507c39](https://github.com/bunterWolf/Workmory/commit/2507c394f5206c96773d8d66ae1263e0799c4711))


### Documentation

* design for absence and sleep-mode handling ([8eb0970](https://github.com/bunterWolf/Workmory/commit/8eb0970037b993c245bbe2da792dac3c63b01159))
* implementation plan for absence and sleep-mode handling ([ddd985b](https://github.com/bunterWolf/Workmory/commit/ddd985b9ca2ea5422859469c167d9b7fd386aec0))


### Tests

* pin the Jest timezone to Europe/Berlin ([5991dfc](https://github.com/bunterWolf/Workmory/commit/5991dfc770d0290bc9d9a0600165db6c680d11ec))

### [0.0.2-beta.5](https://github.com/bunterWolf/Workmory/compare/v0.0.2-beta.4...v0.0.2-beta.5) (2026-11-06)


### Bug Fixes

* find the build artifacts when publishing a release ([284d8c6](https://github.com/bunterWolf/Workmory/commit/284d8c6a6bb65e3deeeea222d15fe8ed077963d0))

### [0.0.2-beta.4](https://github.com/bunterWolf/Workmory/compare/v0.0.2-beta.3...v0.0.2-beta.4) (2026-11-06)


### Features

* real app icons and perceptual OKLCH event colors ([2b3b82b](https://github.com/bunterWolf/Workmory/commit/2b3b82b8894c2ef2dcdb1095237b088ca2666b22))


### Bug Fixes

* publish a release only after every platform has built ([a588903](https://github.com/bunterWolf/Workmory/commit/a588903152986abfdef41d8b203088a34446a9b2))
* repair the links in the generated changelog ([ae54e73](https://github.com/bunterWolf/Workmory/commit/ae54e73fb91c26fe1ef6cb19292c8587df11981d))
* roll the aggregation "today" cache over at local midnight ([77836fd](https://github.com/bunterWolf/Workmory/commit/77836fd91dfcdc63dad6f2b39b0ccc85b67731fe))

### [0.0.2-beta.3](https://github.com/bunterWolf/Workmory/compare/v0.0.2-beta.2...v0.0.2-beta.3) (2026-11-05)


### Features

* add Figma design tokens, typography and bundled Inter 4996134
* add Figma UI primitives (Icon, Button, Toggle, TrackingDot) ccaf2f3
* appearance setting (Auto / Light / Dark) 71fb7e1
* auto-scroll timeline to running block once per day view 65628c7
* compact window and Figma title bar with theme-aware background 3521c8c
* event text color blend from EventInkMix token c798fb4
* Figma footer with day summary and settings entry 0dbd4f9
* Figma settings view replaces settings modal 7145a58
* Figma timeline (hour grid, events, scrollbar) replaces DayOverview a4e3564
* Figma toolbar (date nav, interval trigger, tracking button) replaces Header 8342f82
* hug the timeline range to the tracked blocks, minimal empty state, untranslated Tracking label 8d968ab
* interval pill instead of slider flyout, appearance row in the settings grid f9dca09
* settings button in the title bar, Figma token and event stroke updates d6f749c, closes #f8f7f6 #0000001 #ffffff1
* show live app and window title in running timeline block bab9c0c
* theme-aware inactive hatch in CSS ecba3ec
* timeline geometry per Figma (1px offset, border gap, half-hour marker) 2adc656
* zoom label and wider fade on the interval pill, taller appearance control bc24f68


### Bug Fixes

* build releases on Node 22 74a0068
* **deps:** resolve all Dependabot vulnerabilities (33 → 0) 0fadfba
* don't aggregate the still-running interval 974241b
* handle empty app name or title in the running block title d470b5b
* ignore stale get-day-data responses after a date switch 7a6d2ce
* keep footer summary clear of the menu button at 387px 31e783d
* keep the shown day data when a background reload fails 189dccf
* keep timeline mounted on background reloads so scroll position survives 17be9d4
* lock store location buttons while the existing-file confirmation is open ce65a8e
* make jest test discovery robust to dot-dir worktree paths 6898859
* move nsis config to top-level build configuration 6c3994e
* move the running block when a new aggregation arrives e940aaa
* never let an invalid color throw while rendering a timeline event 8328838
* scope settings scrollbar so it no longer overrides the timeline thumb on hover 9b4dcb9
* size the window by content area so it is exactly 387x499 c34086b
* use allowPrerelease instead of channel for beta auto-updates 3ccc90f
* use local date keys in the renderer so 'today' matches the store 4d9da14
* use NativeImage.toBitmap (getBitmap removed in updated Electron) e31e0d4

### [0.0.1-beta.13](https://github.com/bunterWolf/Chronflow/compare/v0.0.1-beta.12...v0.0.1-beta.13) (2025-05-07)

### [0.0.1-beta.12](https://github.com/bunterWolf/Chronflow/compare/v0.0.1-beta.11...v0.0.1-beta.12) (2025-05-07)

### [0.0.1-beta.11](https://github.com/bunterWolf/Chronflow/compare/v0.0.1-beta.10...v0.0.1-beta.11) (2025-05-07)

### [0.0.1-beta.10](https://github.com/bunterWolf/Chronflow/compare/v0.0.1-beta.9...v0.0.1-beta.10) (2025-05-06)

### [0.0.1-beta.9](https://github.com/bunterWolf/Chronflow/compare/v0.0.1-beta.8...v0.0.1-beta.9) (2025-05-06)

### [0.0.1-beta.8](https://github.com/bunterWolf/Chronflow/compare/v0.0.1-beta.7...v0.0.1-beta.8) (2025-05-06)

### [0.0.1-beta.7](https://github.com/bunterWolf/Chronflow/compare/v0.0.1-beta.6...v0.0.1-beta.7) (2025-05-06)

### [0.0.1-beta.6](https://github.com/bunterWolf/Chronflow/compare/v0.0.1-beta.5...v0.0.1-beta.6) (2025-05-06)

### [0.0.1-beta.5](https://github.com/bunterWolf/Chronflow/compare/v0.0.1-beta.4...v0.0.1-beta.5) (2025-05-06)

### [0.0.1-beta.4](https://github.com/bunterWolf/Chronflow/compare/v0.0.1-beta.3...v0.0.1-beta.4) (2025-05-06)

### [0.0.1-beta.3](https://github.com/bunterWolf/Chronflow/compare/v0.0.1-beta.2...v0.0.1-beta.3) (2025-05-06)

### [0.0.1-beta.2](https://github.com/bunterWolf/Chronflow/compare/v0.0.1-beta.1...v0.0.1-beta.2) (2025-05-06)

### [0.0.1-beta.1](https://github.com/bunterWolf/Chronflow/compare/v0.0.1-beta.0...v0.0.1-beta.1) (2025-05-06)

### [0.0.1-beta.0](https://github.com/bunterWolf/Chronflow/compare/v1.2.0-beta.2...v0.0.1-beta.0) (2025-05-06)

### [1.1.1](https://github.com/bunterWolf/Chronflow/compare/v1.1.0...v1.1.1) (2025-05-05)

### [1.1.1](https://github.com/bunterWolf/Chronflow/compare/v1.1.0...v1.1.1) (2025-05-05)


### Bug Fixes

* Beta Build Process ([8759cfb](https://github.com/bunterWolf/Chronflow/commit/8759cfb59c55bada81814cbd462edcfb8de67b55))
* Beta Build Process ([2de7bee](https://github.com/bunterWolf/Chronflow/commit/2de7bee61bca594fad6dcce1d0e3ba4719d0b32c))
* Beta Build Process ([462270c](https://github.com/bunterWolf/Chronflow/commit/462270c806fee991fb288d61ff93f7fbc5cd1608))
* Beta Build Process ([2811e4e](https://github.com/bunterWolf/Chronflow/commit/2811e4eaa6af45f89d59ac5435ca43f395081b60))
* Beta Update Process ([be6912a](https://github.com/bunterWolf/Chronflow/commit/be6912adbe37ad9ebec8bfc1be89ef11d6dcd5ab))

## [1.1.0](https://github.com/bunterWolf/Chronflow/compare/v1.0.3...v1.1.0) (2025-05-05)


### Features

* Upgrade GitHub Actions auf v4 ([067e89b](https://github.com/bunterWolf/Chronflow/commit/067e89b0b079b9311c0adfd6ca42c10962ea494c))


### Bug Fixes

* Downgrade GitHub Actions auf v3 ([1160c87](https://github.com/bunterWolf/Chronflow/commit/1160c8794bdfd477c724dd7b5155c83b4e46765b))
* Verwende npm install statt npm ci in GitHub Action ([0652085](https://github.com/bunterWolf/Chronflow/commit/065208554b7bb5f1756dd324986b6fe5bb553dea))

## [1.2.0](https://github.com/bunterWolf/Chronflow/compare/v1.0.4...v1.2.0) (2025-05-05)


### Features

* Add cross-platform support for Windows and macOS ([7d671ea](https://github.com/bunterWolf/Chronflow/commit/7d671ea526a9fce04e15c1e44f62fae108d4bbf5))

## [1.1.0](https://github.com/bunterWolf/Chronflow/compare/v1.0.4...v1.1.0) (2025-05-05)


### Features

* Add cross-platform support for Windows and macOS ([7d671ea](https://github.com/bunterWolf/Chronflow/commit/7d671ea526a9fce04e15c1e44f62fae108d4bbf5))

### [1.0.4](https://github.com/bunterWolf/Chronflow/compare/v1.0.3...v1.0.4) (2025-05-05)

### [1.0.3](https://github.com/bunterWolf/Chronflow/compare/v1.0.3-alpha...v1.0.3) (2025-05-04)


### Maintenance

* Auto Update with Github ([b529792](https://github.com/bunterWolf/Chronflow/commit/b529792b0112f364ce913076f332fce6ad88e66f))
