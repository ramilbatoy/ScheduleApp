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
| App | Expo SDK 58 + TypeScript strict; package `com.dayplanner.app`; launcher display name **NeoOrganizer** (was DayPlanner in 1.0.0) |
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

- `src/db/` — drivers, migrations, types (schema through v3 folders)
- `src/domain/` — models, repos, services (Task, CarryForward, Recurrence, Reminder, Stats, Backup, Settings, Category, Folder, agenda, `plannerGroups`)
- `src/app/` — Expo Router (tabs, projects/folders, theme-settings, about, item edit, quick-add, categories)
- `src/theme/` — semantic tokens, presets, ThemeProvider, Paper bridge
- `src/ui/` — AppHeader, App* wrappers, PlannerFolderGroups, primitives, screens/components
- `src/platform/` — notifications, backup file I/O adapters
- `docs/information.docx` — in-repo app details (from code); `Finalinstall/` — sideload APKs (gitignored)

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
- Header branding: default text **NeoOrganizer**; optional local logo bytes in `app_settings` (not the Android launcher icon)
- Folders: explicit task priority always wins; otherwise inherit folder priority. Folder target date is a project deadline and never rewrites occurrence dates. Progress is computed. Backup format 2 includes folders and `navigation` prefs; device notification prefs are not overwritten
- Folder-first display: Today / Week / Month group assigned tasks under folders (expand/collapse); unassigned stay individual. Tasks screen defaults to individual list + optional Group by Folder. Occurrence dates stay authoritative
- Drawer: AppHeader hamburger, bottom tabs stay. Default shortcuts Tasks / Folders / About (other ids remain reachable via tabs/routes). Brand text/logo in AppHeader navigates to Today and closes the drawer; hamburger stays separate
- Timed items apply Settings default reminder offset; OS alarms use `alarmClock` when exact-alarm granted else `bestEffort`
- Android button/chip/segment labels: `includeFontPadding: false` + vertical padding; EmptyState labels use `flexShrink: 0` + `textBreakStrategy: simple` (Phase 5 clipping fix)
- Web: never nest `<button>` (Pressable / Paper `accessibilityRole="button"`). Outer cards that wrap chips use non-button parents

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
| Centralized theme + Paper UI | Merged to main (2026-11-22) | https://github.com/ramilbatoy/ScheduleApp/pull/13 — Paper MD3, 10 presets, Theme Settings, semantic tokens; audit `/cursor/stores/self/docs/theme-ui-audit.md`; **207** tests |
| App details Word doc | Merged to main (2026-11-23) | https://github.com/ramilbatoy/ScheduleApp/pull/14 — `docs/information.docx` from live code (not Agent Store mirrors) |
| Folders / projects + navigation drawer | Merged to main (2026-11-23) | https://github.com/ramilbatoy/ScheduleApp/pull/15 — schema v3, backup format 2, Projects + folder detail, customizable drawer; **230** tests |
| Shared header, NeoOrganizer branding, folder-first Tasks | Merged to main (2026-11-23) | https://github.com/ramilbatoy/ScheduleApp/pull/16 — `AppHeader`; logo bytes in `app_settings`; Tasks folder cards; **238** tests |
| Nested buttons after header and folders | Merged to main (2026-11-23) | https://github.com/ramilbatoy/ScheduleApp/pull/17 — AgendaRow folder chip + Projects reorder; no nested web `<button>`; **238** tests |
| Folder-first Today / Week / Month | Merged to main (2026-11-23) | https://github.com/ramilbatoy/ScheduleApp/pull/18 — `plannerGroups` + `PlannerFolderGroups`; Tasks individual + optional Group by Folder; **241** tests |
| Main audit + sideload APK | Merged to main (2026-11-23) | https://github.com/ramilbatoy/ScheduleApp/pull/19 — audit clean (**241** tests, typecheck). APK: `~/Desktop/git/ScheduleApp/Finalinstall/NeoOrganizer-1.0.0-release.apk` (~98 MB, `assembleRelease`, debug keystore, `com.dayplanner.app` 1.0.0). `Finalinstall/*.apk` gitignored |
| Today tab minimal redesign | Merged to main (2026-11-23) | https://github.com/ramilbatoy/ScheduleApp/pull/21 — date strip + status dropdown + selected-date progress; ReadyScreen bootstrap gate; **245** tests |
| Drawer / forms / Week / Settings polish | Merged to main (2026-11-23) | https://github.com/ramilbatoy/ScheduleApp/pull/22 — drawer defaults, searchable folder + priority dropdowns, Week folder cards, Settings polish; **247** tests |
| NeoOrganizer 1.1.0 upgrade APK | Merged to main (2026-11-24 Asia/Manila) | https://github.com/ramilbatoy/ScheduleApp/pull/23 — `versionName` 1.1.0 / `versionCode` 2, launcher NeoOrganizer, Finalinstall/1.1.0 APK |
| Quick Add / Edit forms / Reminder / Day polish | Merged to main (2026-11-24 Asia/Manila) | https://github.com/ramilbatoy/ScheduleApp/pull/24 — Quick Add folder+priority row (Auto inherit); current-time picker seed; Event / Start·End Date/Time; Alert reminder modal; Day tab rename + 20px heading; Day Priority/Category/Folder filters; Week/Month responsive filters; empty “Nothing is currently listed here.” **248** tests. Report: `/cursor/stores/self/docs/quick-add-forms-today-report.md` |
| NeoOrganizer 1.2.0 sideload packages | Merged to main (2026-11-24 Asia/Manila) | https://github.com/ramilbatoy/ScheduleApp/pull/25 — `versionName` 1.2.0 / `versionCode` 3; same package `com.dayplanner.app` + debug keystore SHA-1 `5E:8F:16:06:…:F6:25`. Android APK: `~/Desktop/git/ScheduleApp/Finalinstall/1.2.0/NeoOrganizer-1.2.0-release.apk`. iOS under `Finalinstall/1.2.0/ios/` (simulator `.app`, unsigned xcarchive/IPA; device IPA needs Apple signing). Report: `/cursor/stores/self/docs/neoorganizer-1.2.0-build-report.md` |
| Tasks + Projects minimalist filters | Open PR (2026-11-25 Asia/Manila) | https://github.com/ramilbatoy/ScheduleApp/pull/26 — `/tasks` and `/projects` status/sort (and Tasks kind/priority/category/folder/target) as wrapping dropdowns (WeekFilterBar pattern); Group by Folder kept; **248** tests. Report: `/cursor/stores/self/docs/tasks-filters-minimal-report.md` |

### In progress / remaining

| Item | Status | Notes |
| --- | --- | --- |
| Device re-verify | Optional | Physical phone smoke: install-over Finalinstall 1.2.0 APK (data keep), alarms, clipping |
| iOS signed IPA | Blocked | Needs Apple Developer team / certificates; see `Finalinstall/1.2.0/ios/README.md` |
| Production signing | Optional | Replace debug-keystore release with Play/EAS credentials when publishing |
| Project templates | Optional | Spec mentioned Website Launch / etc.; not required for core folders |
| Calendar-tab month titles | Known gap | Dashboard Month uses folder markers; Calendar tab month may still show task titles |

### Known issues / limitations (live)

- Web reminders only while the tab is open
- Exact Android alarm delivery depends on OS / exact-alarm permission (`alarmClock` vs `bestEffort`)
- Local `assembleRelease` / Finalinstall APK uses the debug keystore until Play/EAS production credentials
- Expo Go is not acceptance; use EAS/dev/Gradle APK or `Finalinstall/`
- Package id remains `com.dayplanner.app`; launcher display name **NeoOrganizer** (1.1.0+); in-app header branding also defaults to NeoOrganizer
- Nested subtasks are per-occurrence (not series template); new recurring instances start with an empty checklist
- “Overdue since” is derived from stored dates (original occurrence date, assigned day, deadline local date, carry-forward and late reschedule history). There is no separate overdue timestamp
- Folder progress counts occurrences on or before today. Future recurring instances and events are excluded from the percent
- Week/Day are folder-card first with compact status/priority/category/folder filter dropdowns; Month status is a dropdown. Weekly goals list removed from Week. Day heading shows Today or the selected date; bottom tab label is Day
- Tasks (`/tasks`) filters use one wrapping dropdown row (kind/status/priority/category/folder/folder-target/sort) plus Group by Folder toggle; no horizontal status/kind chip strips
- Projects / Folders (`/projects`) filters use Status + Sort wrapping dropdowns (no horizontal chip strips)
- Settings no longer shows App Branding or Navigation editors; branding bytes and drawer prefs still persist. Defaults for new installs: drawer Tasks / Folders / About; `collapseFoldersByDefault` true
- Existing installs keep a previously saved drawer order until that setting is rewritten
- `npm run lint` has no committed ESLint config; first `expo lint` can fail on pre-existing files
- Header branding is separate from the Android launcher. Custom logo is PNG/JPEG/WebP bytes in `app_settings` (max ~1.5 MB). Invalid/missing → NeoOrganizer
- Folder target dates and folder priorities never rewrite task dates or explicit task priorities
- Local-first: ship features on the Mac checkout at `~/Desktop/git/ScheduleApp` against `main`

## How to work

0. **Always** open this skill (and any other relevant Project skills) before planning or coding a change; treat skill rules as binding for this thread.
1. Branch from updated `main` (through #19). Prefer the Mac local checkout for all new work.
2. Keep domain services pure of UI; add tests on **both** SQLite and IndexedDB drivers for storage-touching logic.
3. Run `npm test` and `npm run typecheck` before declaring a slice done. Avoid nested web buttons.
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

APK / iOS artifacts:  
- Sideload Android (preferred, versioned): `~/Desktop/git/ScheduleApp/Finalinstall/<version>/NeoOrganizer-<version>-release.apk`  
  - `…/Finalinstall/1.2.0/NeoOrganizer-1.2.0-release.apk`  
  - `…/Finalinstall/1.1.0/NeoOrganizer-1.1.0-release.apk`  
  - Legacy flat: `…/Finalinstall/NeoOrganizer-1.0.0-release.apk`  
- iOS package (from 1.2.0): `~/Desktop/git/ScheduleApp/Finalinstall/<version>/ios/`  
- Earlier Project store copies: `/cursor/stores/self/artifacts/dayplanner-1.0.0-debug.apk`, `dayplanner-1.0.0-release.apk`  
Also under `/opt/cursor/artifacts/` on build VMs.

## Preference hooks

See `/cursor/stores/self/preferences.md` — auto-advance phases; tasks-only carry-forward; placeholder package until Android polish.
