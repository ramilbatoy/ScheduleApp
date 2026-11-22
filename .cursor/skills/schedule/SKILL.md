---
name: schedule
description: >-
  Authoritative playbook for the DayPlanner / ScheduleApp offline-first Android
  scheduling project (Expo + TypeScript). Use for every change, review, test,
  APK/web build, or follow-up in this Project. Read this skill before editing
  the app; update the Accomplishments section when a phase, PR, or acceptance
  item lands.
---

# Schedule / DayPlanner skill

## When to use

Use this skill for **any** work on `ramilbatoy/ScheduleApp` (DayPlanner): features, bugs, docs, APK/web, tests, audits, or reviews in the Scheduling App Project.

## Read first

1. This skill (source of truth for stack + shipped state)
2. `/cursor/stores/self/preferences.md`
3. `/cursor/stores/self/docs/project-context.md`
4. `/cursor/stores/self/docs/architecture-plan.md` (full design)
5. `/cursor/stores/self/internal/requirements-spec.md` (acceptance requirements)
6. Latest open PRs / tip of stack branch (do not reinvent against `main` alone while the stack is unmerged)

## Non-negotiables

- Offline-first; no Firebase/Supabase/backend/auth for core features
- Android is primary; Expo Web for development/testing
- Business logic never imports platform DB APIs; use the repository/`Database` abstraction
- Durable data in SQLite (Android) / IndexedDB-backed memory driver (web); never production-only Zustand/memory
- Carry-forward: **tasks only** (not events), idempotent, preserve `created_at` / deadline / history via occurrences + `completion_history`
- Do not bump dates in a way that destroys history
- Timezone-aware civil dates for `occurrence_date`; timestamps ISO UTC
- No mock data as a stand-in for real persistence; no dead UI controls
- Prefer Auto / included usage for long builds unless the user names a model

## Locked stack

| Layer | Choice |
| --- | --- |
| App | Expo SDK 58 + TypeScript strict; package `com.dayplanner.app`; display name DayPlanner |
| Nav | Expo Router; tabs Today / Calendar / Tasks / Statistics / Settings |
| State | Zustand (UI only) |
| Android DB | expo-sqlite |
| Web DB | MemoryDatabase + IndexedDB persistence (`idb`/atomic commit) behind same interface |
| Dates | date-fns |
| Notifications | expo-notifications (Android local; web best-effort while tab open) |
| Calendar UI | react-native-calendars (month) + custom week/day |
| Charts | Plain RN `View` charts (no gifted-charts/Victory) |
| Backup | JSON export/import; Android folder picker/share; web download/upload |

## Layout (key paths)

- `src/db/` — drivers, migrations, types
- `src/domain/` — models, repos, services (Task, CarryForward, Recurrence, Reminder, Stats, Backup, Settings, Category, agenda)
- `src/app/` — Expo Router screens (tabs, item edit, quick-add, categories)
- `src/ui/` — theme tokens, primitives, screens/components
- `src/platform/` — notifications, backup file I/O adapters

## Data model (summary)

- Unified `tasks` + `task_occurrences` with `item_kind` = `task` | `event`
- Also: `recurring_rules`, `categories`, `reminders`, `app_settings`, `completion_history`
- Unique: one active occurrence per task per day; unique recurrence instance key
- Soft-delete definitions (`deleted_at`); keep history

## Product rules already implemented

- Recurrence: daily / weekdays / weekends / weekly days / monthly / yearly / interval / end date; edit/delete this | this-and-following | series
- Stale recurring pending → `missed` when a newer series instance exists (no duplicate day copies)
- Deadlines independent of assigned date
- Quick-add NL: dates, times, `!priority`, `#category`
- Backup: validate → safety copy → single-transaction restore → rebuild notifications; undo last restore
- Theme: system / light / dark persisted
- Timed items apply Settings default reminder offset; OS alarms use `alarmClock` when exact-alarm granted else `bestEffort`
- Android button/chip/segment labels: `includeFontPadding: false` + vertical padding; EmptyState labels use `flexShrink: 0` + `textBreakStrategy: simple` (Phase 5 clipping fix)

## Accomplishments (keep current)

Update this section whenever a phase finishes, a PR merges, or acceptance status changes. Date entries in Asia/Manila.

### Done

| Item | Status | Evidence |
| --- | --- | --- |
| Phase 1 architecture | Done (approved 2026-11-22) | `/cursor/stores/self/docs/architecture-plan.md` |
| Phase 2 foundation | Shipped in PR (open) | https://github.com/ramilbatoy/ScheduleApp/pull/1 — Expo 58, storage abstraction, `001_init`, theme, tabs |
| Phase 3 core | Shipped in PR (open, stacked on #1) | https://github.com/ramilbatoy/ScheduleApp/pull/2 — CRUD, calendar, recurrence, carry-forward, reminders, quick-add |
| Phase 4 productivity | Shipped in PR (open, stacked on #2) | https://github.com/ramilbatoy/ScheduleApp/pull/4 — stats, category CRUD, JSON backup/restore; 147→149 tests |
| Phase 5 Android + web | Shipped in PR (open, stacked on #4) | https://github.com/ramilbatoy/ScheduleApp/pull/5 — Gradle debug+release APKs, `ANDROID_BUILD.md`, `WEB_TESTING.md`, `eas.json`, button clipping fix, reminder scheduling/`alarmClock`, timed default offsets |
| Phase 6 QA + audit | Shipped with Phase 5 PR (#5) | `/cursor/stores/self/docs/acceptance-audit.md`; repo docs README/ARCHITECTURE/DATABASE/FEATURES/TESTING/ACCEPTANCE_AUDIT; 149 tests green |

### In progress / remaining

| Item | Status | Notes |
| --- | --- | --- |
| PR stack merge | Awaiting review | Merge #1 → #2 → #4 → Phase 5/6 PR in stack order |
| Device re-verify | Optional | Emulator/device smoke of clipping + scheduled alarms after Phase 5 UI/notification changes |

### Known issues / limitations (live)

- Web reminders only while the tab is open
- Exact Android alarm delivery depends on OS / exact-alarm permission (`alarmClock` vs `bestEffort`)
- Local `assembleRelease` uses the debug keystore until Play/EAS production credentials
- Expo Go is not acceptance; use EAS/dev/Gradle APK
- Package/display name remain placeholders (`com.dayplanner.app` / DayPlanner)

## How to work

1. Prefer continuing the tip of the PR stack (Phase 5/6 branch or later), not bare `main`, until the stack merges.
2. Keep domain services pure of UI; add tests on **both** SQLite and IndexedDB drivers for storage-touching logic.
3. Run `npm test` and `npm run typecheck` before declaring a slice done.
4. After each completed phase or merged PR: **update Accomplishments above** and `project-context.md`.
5. Kickoff workers with this skill path: `/cursor/stores/self/skills/schedule/SKILL.md`.
6. Mirror into the repo at `.cursor/skills/schedule/SKILL.md` so checkout-local agents see it; **Project store copy remains authoritative** until mirrors sync.

## Commands (typical)

```bash
npm install
npm test
npm run typecheck
npx expo start --web
# Android (after prebuild):
npx expo prebuild --platform android --no-install
cd android && ./gradlew assembleDebug assembleRelease
```

APK artifacts (this Project):  
`/cursor/stores/self/artifacts/dayplanner-1.0.0-debug.apk`  
`/cursor/stores/self/artifacts/dayplanner-1.0.0-release.apk`  
Also under `/opt/cursor/artifacts/` on build VMs.

## Preference hooks

See `/cursor/stores/self/preferences.md` — auto-advance phases; tasks-only carry-forward; placeholder package until Android polish.
