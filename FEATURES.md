# Features — DayPlanner

## Today dashboard

- Current date header; today’s events and tasks
- Completed vs pending progress
- Carried-forward / overdue indicators
- Upcoming deadlines
- Quick-add entry point

## Tasks & events

- Unified model (`item_kind`: task | event)
- CRUD with title, notes, date, optional start/end, deadline, category, priority
- All-day events; detail view; delete confirmation
- Complete / reopen; edit scopes for recurring series
- **Nested subtasks** (tasks only): multi-layer checklist under a main task occurrence — tick, edit title/notes, nest under a subtask; shown on Today / Tasks / detail / edit; ride with carry-forward; not separate agenda rows

## Carry-forward (tasks only)

- Unfinished assigned-date tasks roll to the next day until completed or deleted
- No duplicate active occurrences; history preserved; original `created_at` and deadlines kept
- Carry count + UI badges; setting to enable/disable; manual “carry now”
- Events never auto-carry

## Recurrence

- Daily, weekdays, weekends, weekly selected days, monthly, yearly, custom interval, end date or indefinite
- Generate occurrences ahead; edit/delete this | this-and-following | series
- Completed instances stay done; stale pending → `missed` when superseded

## Calendar

- Month grid with indicators/counts; week and day agendas
- Navigate to Today / Week / Month; tap day to focus; quick create from calendar context

## Deadlines & reminders

- Deadlines independent of assigned day
- Start and deadline reminder offsets; local Android notifications offline
- Permission + optional exact-alarm (precise timing) in Settings
- Timed quick-add / form items apply the default reminder offset from Settings
- Web: reminders only while the tab is open

## Productivity

- Priority visuals (low → urgent)
- Default + custom categories with colors
- Global search; filters (status, category, priority, carried, overdue, …)
- Statistics: today / week / month rates, totals, carry-forward, trends (plain RN charts)
- Quick-add with optional NL date/time/`!priority`/`#category` parsing
- JSON backup/restore with validation, safety copy, overwrite protection, undo last restore
- Theme: system / light / dark persisted

## Navigation

Bottom tabs: **Today · Calendar · Tasks · Statistics · Settings**. Modal quick-add and item edit flows.
