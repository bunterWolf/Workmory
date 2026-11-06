# Changelog

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

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
