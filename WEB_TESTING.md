# Web testing — DayPlanner

Expo Web is for **development and QA**, not the production product surface. Persistence uses the IndexedDB-backed memory driver behind the same repository interface as Android SQLite.

## Run

Requires **Node.js ≥ 22.13.0** (Expo SDK 58; see `.nvmrc`).

```bash
npm install
npm run web          # expo start --web
# or static export:
npm run build:web    # expo export --platform web → dist/
```

Open the Metro/Expo URL (typically `http://localhost:8081`). Prefer Chrome/Edge Chromium for IndexedDB + Notification API coverage.

## What works on web

| Area | Behavior |
| --- | --- |
| CRUD tasks/events | Full |
| Nested subtasks | Full (IndexedDB-backed) |
| Carry-forward | Full (runs on bootstrap / day change while the tab is open) |
| Recurrence | Full |
| Calendar month/week/day | Full |
| Statistics + charts | Full |
| Categories | Full |
| Theme | Full (system/light/dark) |
| Backup export | Browser download of JSON |
| Backup restore | File picker upload; validates schema; safety copy in browser storage |
| Search / filters | Full |
| Quick-add NL parsing | Full |

## Degraded / different on web

| Area | Limitation |
| --- | --- |
| Reminders | Best-effort while the **tab stays open**; no reliable background AlarmManager. Settings copy explains this. |
| Exact alarms | `unsupported` |
| Native share / Android folder picker | Uses download/upload instead (`src/platform/backupFiles.web.ts`) |
| Feel | Browser chrome; acceptable for logic QA, not Android UX acceptance |

## Persistence check

1. Create tasks/events; note titles
2. Hard-refresh the tab — data remains (IndexedDB)
3. Open DevTools → Application → IndexedDB — DayPlanner DB present
4. Export backup; clear site data; restore from the JSON file

## Automated tests (shared domain)

Web and Android share domain tests. Drivers under test:

```bash
npm test            # SQLite (node:sqlite) + IndexedDB (fake-indexeddb)
npm run typecheck
```

Storage-touching suites run against **both** drivers (`src/db/__tests__/`, `src/domain/__tests__/`).

## When to switch to Android

Use a Gradle/EAS APK for:

- Notification permission UX and scheduled alarms
- Offline airplane-mode install smoke
- Touch targets, button clipping, system back, adaptive icon
- Final acceptance (see `TESTING.md` / acceptance audit)
