# DayPlanner — offline-first scheduling & daily productivity (Android-first)

Expo (React Native) + TypeScript app. All data lives on the device: SQLite on Android, IndexedDB in the browser. No backend, no account.

> Working name and package id (`com.dayplanner.app`) are placeholders.

## Quick start

```bash
npm install
npm test            # domain + storage tests (SQLite via node:sqlite, IndexedDB via fake-indexeddb)
npm run typecheck
npm run web         # browser dev build (IndexedDB storage)
npm run android     # native dev build on a device/emulator (SQLite storage)
```

## Layout

| Path | Purpose |
|---|---|
| `src/app/` | Expo Router screens (bottom tabs: Today, Calendar, Tasks, Statistics, Settings) |
| `src/domain/` | Models, repositories, services (business logic; no UI or platform imports) |
| `src/db/` | Storage abstraction: SQLite driver + migrations, in-memory driver with IndexedDB persistence |
| `src/state/` | Zustand store (UI/session cache only — never the source of truth) |
| `src/ui/` | Design tokens, theme, shared components |
