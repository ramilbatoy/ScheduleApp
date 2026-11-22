# Architecture — DayPlanner

Offline-first scheduling app. Android (APK) is primary; Expo Web is for development/testing. No backend, no auth.

Full design notes: Project store `docs/architecture-plan.md`. Authoritative playbook: `.cursor/skills/schedule/SKILL.md` (mirrored from Project store).

## Layers

```
UI (Expo Router + components)
        │
Domain services (Task, Occurrence ops, CarryForward, Recurrence,
                 Reminder, Stats, Backup, Settings, Category, Agenda)
        │
Repositories (SQL-shaped API over Database)
        │
    ┌───┴───┐
 SQLite   Memory + IndexedDB
 (Android)     (Web)
```

**Rules**

1. UI never talks to SQLite/IndexedDB directly.
2. Services own business invariants (idempotent carry-forward, recurrence dedupe).
3. Repositories own persistence; drivers implement `Database`.
4. Zustand holds UI/session cache only — never durable source of truth.
5. Platform adapters (`src/platform/`) wrap notifications and backup file I/O.

## Key modules

| Path | Role |
| --- | --- |
| `src/app/` | Screens: tabs, item detail/edit, quick-add, categories |
| `src/domain/` | Models, repos, services, pure date/recurrence helpers |
| `src/db/` | Schema, migrations, SQLite + memory/IndexedDB drivers |
| `src/state/` | Zustand store |
| `src/ui/` | Theme tokens, primitives, shared components |
| `src/platform/` | `notifications(.web)`, `backupFiles(.web)` |

## Carry-forward

- Applies to **tasks only** (not events).
- Moves pending occurrence to the next civil day; records history; increments `carry_forward_count`.
- Idempotent via `last_carry_forward_run_date` + unique active occurrence constraints.
- Completed / deleted definitions stop rollover. Manual date changes are respected.

## Recurrence

- Rules on `recurring_rules`; instances on `task_occurrences` with `recurrence_instance_key`.
- Edit/delete scopes: this occurrence | this and following | entire series.
- Stale pending instances become `missed` when a newer series instance exists (no duplicate day copies).

## Reminders

- Desired triggers derived from task offsets + pending occurrences (14-day horizon, cap 200).
- `reminders` table is source of truth; OS notification ids are a cache, rebuilt on sync / app open / permission grant.
- Android: `expo-notifications` DATE trigger; uses `alarmClock` delivery when exact-alarm permission is granted, else `bestEffort`.
- Web: best-effort while the tab is open.

## Backup

- Versioned JSON export/import.
- Restore: validate → write safety copy → single transaction replace → cancel stale notification ids → run maintenance.
- Undo last restore from the latest safety copy when available.

## Platform limits

| Concern | Android | Web |
| --- | --- | --- |
| Storage | expo-sqlite | MemoryDatabase + IndexedDB |
| Notifications | Local alarms | Tab-open only |
| Backup I/O | Share / document picker | Download / file input |
| Acceptance | Gradle/EAS APK | Dev QA only |
