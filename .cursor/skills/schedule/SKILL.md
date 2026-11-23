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
| Calendar UI | Custom month/week/day grids (themed); no `react-native-calendars` in tree |
| Charts | Plain RN `View` charts (no gifted-charts/Victory); themed |
| UI kit | react-native-paper MD3 via token bridge; App* wrappers; Ionicons (`AppIcon`) |
| Theme | `src/theme/` presets + custom HEX; appearance system/light/dark; `app_settings` |
| Backup | JSON export/import; Android folder picker/share; web download/upload |

## Layout (key paths)

- `src/db/` — drivers, migrations, types
- `src/domain/` — models, repos, services (Task, CarryForward, Recurrence, Reminder, Stats, Backup, Settings, Category, agenda)
- `src/app/` — Expo Router screens (tabs, item edit, quick-add, categories)
- `src/theme/` — semantic tokens, presets, ThemeProvider, Paper bridge
- `src/ui/` — App* wrappers, primitives, screens/components
- `src/platform/` — notifications, backup file I/O adapters

## Data model (summary)

- Unified `tasks` + `task_occurrences` with `item_kind` = `task` | `event`
- Also: `recurring_rules`, `categories`, `folders`, `reminders`, `app_settings`, `completion_history`, `task_subtasks` (nested checklist per occurrence)
- Schema **v3**: optional `tasks.folder_id`; `tasks.priority_explicit` (existing rows stay explicit). A task has one folder or none. Categories stay separate.
- Unique: one active occurrence per task per day; unique recurrence instance key
- Soft-delete definitions (`deleted_at`); keep history
- Nested subtasks: keyed by `occurrence_id` (+ `parent_subtask_id`); ride with carry-forward; new recurrence instances start empty

## Product rules already implemented

- Recurrence: daily / weekdays / weekends / weekly days / monthly / yearly / interval / end date; edit/delete this | this-and-following | series
- Stale recurring pending → `missed` when a newer series instance exists (no duplicate day copies)
- Deadlines independent of assigned date
- Quick-add NL: dates, times, `!priority`, `#category`
- Backup: validate → safety copy → single-transaction restore → rebuild notifications; undo last restore
- Theme: system / light / dark + 10 presets + custom HEX + last-used snapshot in `app_settings`
- Folders: explicit task priority always wins; otherwise inherit folder priority. Folder target date is a project deadline and never rewrites occurrence dates. Progress is computed. Backup format 2 includes folders and `navigation` prefs; device notification prefs are not overwritten
- Drawer: header menu, bottom tabs stay. Settings → Navigation can hide or reorder shortcuts without making screens unreachable
- Timed items apply Settings default reminder offset; OS alarms use `alarmClock` when exact-alarm granted else `bestEffort`
- Android button/chip/segment labels: `includeFontPadding: false` + vertical padding; EmptyState labels use `flexShrink: 0` + `textBreakStrategy: simple` (Phase 5 clipping fix)

## Accomplishments (keep current)

Update this section whenever a phase finishes, a PR merges, or acceptance status changes. Date entries in Asia/Manila.

### Done

| Item | Status | Evidence |
| --- | --- | --- |
| Phase 1 architecture | Done (approved 2026-11-22) | `/cursor/stores/self/docs/architecture-plan.md` |
| Phase 2 foundation | Merged to main (2026-11-22) | https://github.com/ramilbatoy/ScheduleApp/pull/1 |
| Phase 3 core | Merged to main (2026-11-22) | https://github.com/ramilbatoy/ScheduleApp/pull/2 |
| Phase 4 productivity | Merged to main (2026-11-22) | https://github.com/ramilbatoy/ScheduleApp/pull/4 |
| Phase 5 Android + web | Merged to main (2026-11-22) | https://github.com/ramilbatoy/ScheduleApp/pull/5 — APKs in `/cursor/stores/self/artifacts/` |
| Phase 6 QA + audit | Merged with #5 | `/cursor/stores/self/docs/acceptance-audit.md`; 149 tests |
| PR stack merge | Done | `#1` → `#2` → `#4` → `#5` merged into `main` (async stack merge) |
| Nested subtasks + Node ≥22.13 | Merged to main (2026-11-22) | https://github.com/ramilbatoy/ScheduleApp/pull/6 — schema v2 `task_subtasks`; 157 tests |
| Dashboard Week/Month + safe back | Merged to main (2026-11-22) | https://github.com/ramilbatoy/ScheduleApp/pull/7 — Today\|Week\|Month; `goBackOrDashboard` |
| Dashboard filters, goals, hierarchy | Merged to main (2026-11-22) | https://github.com/ramilbatoy/ScheduleApp/pull/8 — Week/Month search·sort·filter; Today stats + near-due + weekly goals by urgency; main vs subtask visual hierarchy |
| Month table + in-cell edit + go-to-date | Merged to main (2026-11-22) | https://github.com/ramilbatoy/ScheduleApp/pull/9 — month grid task titles; ItemForm modal; Go to date; Calendar month parity |
| Nested button + overdue on today | Merged to main (2026-11-22) | https://github.com/ramilbatoy/ScheduleApp/pull/10 — month cell no nested `<button>`; unfinished overdue project onto Today / current-date month cell with Overdue badge (no duplicate rows); 179 tests |
| Overdue start and overdue-since | Merged to main (2026-11-22) | https://github.com/ramilbatoy/ScheduleApp/pull/11 — “Started Mar 1” / “Overdue since Mar 2”; 199 tests |
| Week view opens on current week | Merged to main (2026-11-22) | https://github.com/ramilbatoy/ScheduleApp/pull/12 — Today→Week and Calendar Week reset to the week containing today; 201 tests |
| Centralized theme + Paper UI | Open PR (2026-11-22) | https://github.com/ramilbatoy/ScheduleApp/pull/13 — Paper MD3, 10 presets, Theme Settings (HEX/preview/apply/reset/restore), semantic tokens app-wide; audit `/cursor/stores/self/docs/theme-ui-audit.md`; **207** tests |
| Folders / projects + navigation drawer | On main (2026-11-23) | https://github.com/ramilbatoy/ScheduleApp/pull/15 — schema v3, backup format 2, Projects + folder detail, customizable drawer; **230** tests |
| Shared header, NeoOrganizer branding, folder-first Tasks | Open PR (2026-11-23) | https://github.com/ramilbatoy/ScheduleApp/pull/16 — `AppHeader` once in the layouts; logo bytes in `app_settings` (no schema bump); Tasks list groups folder tasks; **238** tests |
| Nested buttons after header and folders | On main (2026-11-23) | https://github.com/ramilbatoy/ScheduleApp/pull/17 — folder chip no longer sits inside a row `<button>`; folder-card reorder buttons sit beside the open control. Month cells, drawer rows, header menu, and checkbox/switch rows stay non-nested. **238** tests |
| Main audit + sideload APK | Done (2026-11-23) | `npm test` **241** passed, `npm run typecheck` clean. No product bugs. `assembleRelease` APK signed with the debug keystore: `~/Desktop/git/ScheduleApp/Finalinstall/NeoOrganizer-1.0.0-release.apk` (`com.dayplanner.app` 1.0.0). |

### In progress / remaining

| Item | Status | Notes |
| --- | --- | --- |
| Device re-verify | Optional | Emulator/device smoke of clipping + scheduled alarms on a physical phone |
| Production signing | Optional | Replace debug-keystore release with Play/EAS credentials when publishing |
| Merge theme + Paper UI PR | Pending review | Branch `cursor/theme-paper-ui-39f4` → `main` |
| Merge folders + drawer PR | On main | https://github.com/ramilbatoy/ScheduleApp/pull/15 |
| Merge header + folder-first Tasks | Pending review | https://github.com/ramilbatoy/ScheduleApp/pull/16 |

### Known issues / limitations (live)

- Web reminders only while the tab is open
- Exact Android alarm delivery depends on OS / exact-alarm permission (`alarmClock` vs `bestEffort`)
- Local `assembleRelease` uses the debug keystore until Play/EAS production credentials
- Expo Go is not acceptance; use EAS/dev/Gradle APK
- Package/display name remain placeholders (`com.dayplanner.app` / DayPlanner)
- Nested subtasks are per-occurrence (not series template); new recurring instances start with an empty checklist
- “Overdue since” is derived from stored dates (original occurrence date, assigned day, deadline local date, carry-forward and late reschedule history). There is no separate overdue timestamp. A task entered today with an earlier assigned date is overdue from the day after that assigned date.
- Folder progress counts occurrences on or before today. Future recurring instances are excluded so a daily habit does not dilute the percent. Events are excluded from the percent.
- `npm run lint` has no committed ESLint config. The first `expo lint` run installs ESLint and then fails on pre-existing files.
- Header branding is separate from the Android launcher (`DayPlanner` / `com.dayplanner.app`). A custom logo is PNG/JPEG/WebP bytes in `app_settings` (max 1.5 MB). Invalid or missing bytes show the name NeoOrganizer.
- The folder-first list is the main Tasks screen only. Today, Calendar, statistics, carry-forward, and recurrence still use individual tasks. Folder target dates and priorities do not rewrite task dates or priorities.

## How to work

1. Branch from updated `main` (#11/#12 merged; theme Paper PR may be tip).
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
