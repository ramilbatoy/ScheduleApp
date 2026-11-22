# Database — DayPlanner

Single schema shared by Android (SQLite) and web (in-memory tables + IndexedDB persistence). Migrations are append-only; current version: **1** (`001_init`).

## Tables

### `categories`

Default seed: Personal, Work, Meetings, Health, Family, Finance, Projects, Others.

| Column | Type | Notes |
| --- | --- | --- |
| id | TEXT PK | UUID |
| name | TEXT | |
| color | TEXT | hex |
| is_default | INTEGER | seeded defaults |
| sort_order | INTEGER | |
| created_at / updated_at | TEXT | ISO |

### `recurring_rules`

| Column | Type | Notes |
| --- | --- | --- |
| id | TEXT PK | |
| frequency | TEXT | `daily` \| `weekly` \| `monthly` \| `yearly` |
| interval | INTEGER | ≥ 1 |
| by_weekday | TEXT NULL | JSON array Mon=1…Sun=7 |
| by_monthday | INTEGER NULL | monthly |
| start_date | TEXT | series anchor (civil date) |
| end_date | TEXT NULL | inclusive; null = indefinite |
| timezone | TEXT | IANA at create |
| generated_until | TEXT NULL | generation watermark |
| created_at / updated_at | TEXT | |

### `tasks` (definitions: tasks + events)

| Column | Type | Notes |
| --- | --- | --- |
| id | TEXT PK | |
| item_kind | TEXT | `task` \| `event` |
| title / notes | TEXT | |
| category_id | TEXT NULL FK | |
| priority | TEXT | low / medium / high / urgent |
| all_day | INTEGER | |
| default_start_time / default_end_time | TEXT NULL | `HH:mm` |
| deadline_at | TEXT NULL | absolute ISO; independent of assigned day |
| recurring_rule_id | TEXT NULL FK | |
| series_id | TEXT NULL | series membership |
| reminder_offset_minutes | INTEGER NULL | before start |
| deadline_reminder_offset_minutes | INTEGER NULL | |
| created_at | TEXT | **immutable original creation** |
| updated_at | TEXT | |
| deleted_at | TEXT NULL | soft delete |

### `task_occurrences`

| Column | Type | Notes |
| --- | --- | --- |
| id | TEXT PK | |
| task_id | TEXT FK | |
| occurrence_date | TEXT | civil `YYYY-MM-DD` |
| start_time / end_time | TEXT NULL | |
| status | TEXT | `pending` \| `completed` \| `cancelled` \| `missed` |
| completed_at | TEXT NULL | |
| is_carried_forward | INTEGER | |
| carry_forward_count | INTEGER | |
| source | TEXT | `manual` \| `recurrence` \| `carry_forward` |
| recurrence_instance_key | TEXT NULL | dedupe key |
| original_occurrence_date | TEXT NULL | pre-carry date |
| is_exception | INTEGER | series exception |
| title_override / notes_override | TEXT NULL | |
| created_at / updated_at | TEXT | |

**Unique (partial)**

- `(task_id, occurrence_date)` where status ∈ pending|completed — one active row per day
- `(task_id, recurrence_instance_key)` where key IS NOT NULL

### `reminders`

| Column | Type | Notes |
| --- | --- | --- |
| id | TEXT PK | |
| task_id | TEXT | |
| occurrence_id | TEXT NULL | null for deadline reminders |
| trigger_at | TEXT | ISO |
| kind | TEXT | `start` \| `deadline` |
| offset_minutes | INTEGER NULL | |
| notification_id | TEXT NULL | OS cache |
| enabled | INTEGER | |
| created_at / updated_at | TEXT | |

### `completion_history`

Audit trail for create / complete / reopen / carry / delete / date changes.

### `app_settings`

Key/value rows mapped to `AppSettings` (theme, auto carry-forward, notifications, default reminder offset, last carry/backup dates, categories seeded flag).

## Indexes

See `src/db/sqlite/migrations.ts` for task/occurrence/reminder/history indexes used by agenda and stats queries.

## Drivers

| Platform | Implementation |
| --- | --- |
| Android | `expo-sqlite` via `src/db/sqlite/sqliteDriver.ts` |
| Web | `MemoryDatabase` + atomic IndexedDB commit (`src/db/indexeddb/`) |
| Tests | `node:sqlite` + `fake-indexeddb` |

## Migrations

- SQLite: `PRAGMA user_version` + ordered statements in `SQLITE_MIGRATIONS`.
- Web: same logical schema applied in memory; schema version stored with persistence blob.
- **Never edit a shipped migration** — append a new version.
