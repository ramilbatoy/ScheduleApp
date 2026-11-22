# DayPlanner — offline-first scheduling & daily productivity (Android-first)

Expo (React Native) + TypeScript. All data lives on the device: **SQLite on Android**, **IndexedDB-backed storage on web**. No backend, no account.

> Working name and package id (`com.dayplanner.app`) are placeholders until a final brand pass.

## Quick start

Requires **Node.js ≥ 22.13.0** (Expo SDK 58 / Metro). This repo pins `22.13.0` via `.nvmrc` / `.node-version`.

```bash
npm install
npm test            # domain + storage tests (SQLite via node:sqlite, IndexedDB via fake-indexeddb)
npm run typecheck
npm run web         # browser dev (IndexedDB)
npm run android     # native dev client (requires SDK + prebuild)
```

## Android APK

See **[ANDROID_BUILD.md](./ANDROID_BUILD.md)**. Short path:

```bash
npx expo prebuild --platform android --no-install
cd android && ./gradlew assembleDebug assembleRelease
```

EAS profiles: `eas.json` (`development` / `preview` / `production` → APK).

## Web testing

See **[WEB_TESTING.md](./WEB_TESTING.md)**. Web is for QA of domain logic and persistence, not production notifications.

## Docs

| Doc | Contents |
| --- | --- |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | Layers, carry-forward, recurrence, reminders |
| [DATABASE.md](./DATABASE.md) | Schema, indexes, migrations, drivers |
| [FEATURES.md](./FEATURES.md) | Product feature list |
| [TESTING.md](./TESTING.md) | Automated + manual QA |
| [ANDROID_BUILD.md](./ANDROID_BUILD.md) | Gradle / EAS / permissions |
| [WEB_TESTING.md](./WEB_TESTING.md) | Browser limits and checks |
| [ACCEPTANCE_AUDIT.md](./ACCEPTANCE_AUDIT.md) | Pass/fail matrix vs requirements |
| `.cursor/skills/schedule/SKILL.md` | Agent playbook (Project store copy is authoritative) |

Project-store audit mirror: `/cursor/stores/self/docs/acceptance-audit.md`

## Layout

| Path | Purpose |
| --- | --- |
| `src/app/` | Expo Router screens (Today, Calendar, Tasks, Statistics, Settings) |
| `src/domain/` | Models, repositories, services |
| `src/db/` | Storage abstraction: SQLite + memory/IndexedDB |
| `src/state/` | Zustand (UI/session only) |
| `src/ui/` | Design tokens, theme, shared components |
| `src/platform/` | Notifications + backup file adapters |

## Known limitations

- Web reminders only while the tab is open
- Exact Android notification timing depends on OS / exact-alarm permission
- Local `assembleRelease` uses the debug keystore until production credentials are configured
- Expo Go is insufficient for acceptance — use a real APK
