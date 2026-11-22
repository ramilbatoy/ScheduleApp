# Testing — DayPlanner

## Automated

```bash
npm install
npm test            # Jest — domain + driver suites (SQLite + IndexedDB)
npm run typecheck   # tsc --noEmit
```

Critical suites (non-exhaustive):

| Suite | Covers |
| --- | --- |
| `src/domain/__tests__/tasks.test.ts` | Task/event CRUD, complete/reopen, validation |
| `src/domain/__tests__/subtasks.test.ts` | Nested create/tick/edit/notes, carry-forward ride-along, both drivers |
| `src/domain/__tests__/carryForward.test.ts` | Idempotent rollover, tasks-only, history |
| `src/domain/__tests__/recurrence.test.ts` / `series.test.ts` | Generation, dedupe, edit scopes |
| `src/domain/__tests__/reminders.test.ts` | Offset timing, cancel on complete, permission gate, timed task+event |
| `src/domain/__tests__/backup.test.ts` | Export/import validation, restore, safety |
| `src/domain/__tests__/stats.test.ts` / `categories.test.ts` / `quickParse.test.ts` | Productivity layer |
| `src/db/__tests__/drivers.test.ts` | Both storage drivers |

Storage-touching logic runs against **both** drivers via `src/test/databases.ts`.

## Web manual

See `WEB_TESTING.md` — IndexedDB persistence, degraded notifications, backup download/upload.

## Android manual

See `ANDROID_BUILD.md` — install debug/release APK, airplane mode, notifications, exact alarms.

Suggested smoke:

1. Install APK; deny then grant notification permission from Settings
2. Quick-add timed task/event → appears on Today; reminder row schedules when permission granted
3. Leave a task incomplete past midnight (or trigger carry-forward / “Carry now”) → badge + count
4. Create recurring weekday event; complete one occurrence; confirm series continues
5. Export backup → edit data → restore → undo restore
6. Toggle theme; kill app; relaunch — data + theme intact offline

## Acceptance

Pass/fail matrix: Project store `docs/acceptance-audit.md` (mirrored intent of requirements §3–9).
