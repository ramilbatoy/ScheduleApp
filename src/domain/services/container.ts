import type { Database } from '../../db/types';
import { nowIso, systemClock, todayKey, type Clock } from '../dates';
import { noopNotifications, type NotificationPort } from '../ports';
import { AgendaService } from './agendaService';
import { BackupService, safetyCopyName, type ValidatedBackup } from './backupService';
import { CarryForwardService, type CarryResult } from './carryForwardService';
import { CategoryService } from './categoryService';
import { RecurrenceService } from './recurrenceService';
import { ReminderService } from './reminderService';
import { SettingsService } from './settingsService';
import { StatsService } from './statsService';
import { TaskService } from './taskService';

export interface MaintenanceResult {
  date: string;
  generated: number;
  carry: CarryResult;
  reminderError: string | null;
}

/** Every service, wired to one database, one clock and one notification port. UI talks only to this. */
export class AppServices {
  readonly categories: CategoryService;
  readonly settings: SettingsService;
  readonly recurrence: RecurrenceService;
  readonly carryForward: CarryForwardService;
  readonly reminders: ReminderService;
  readonly tasks: TaskService;
  readonly agenda: AgendaService;
  readonly stats: StatsService;
  readonly backup: BackupService;
  private lastMaintenanceDate: string | null = null;

  constructor(
    readonly db: Database,
    readonly clock: Clock = systemClock,
    private readonly notifications: NotificationPort = noopNotifications,
  ) {
    this.categories = new CategoryService(db, clock);
    this.settings = new SettingsService(db, clock);
    this.recurrence = new RecurrenceService(db, clock);
    this.carryForward = new CarryForwardService(db, clock);
    this.reminders = new ReminderService(db, clock, notifications);
    this.tasks = new TaskService(db, clock, async (ids) => {
      await this.resyncReminders(ids);
    });
    this.agenda = new AgendaService(db, clock, this.recurrence);
    this.stats = new StatsService(db, clock);
    this.backup = new BackupService(db, clock);
  }

  private async resyncReminders(taskIds?: string[]): Promise<string | null> {
    try {
      await this.reminders.sync(taskIds);
      return null;
    } catch (e) {
      // Reminders are best-effort; a scheduling failure must never undo a saved edit.
      return e instanceof Error ? e.message : String(e);
    }
  }

  /** One-time startup work after the database is open and migrated. */
  async bootstrap(): Promise<MaintenanceResult> {
    await this.categories.seedDefaults();
    return this.runMaintenance();
  }

  /**
   * Day-boundary work: extend recurring series, carry unfinished tasks onto
   * today, refresh reminders. Safe to call any number of times.
   */
  async runMaintenance(): Promise<MaintenanceResult> {
    const generated = await this.recurrence.ensureWindow();
    const carry = await this.carryForward.runAuto();
    const reminderError = await this.resyncReminders();
    this.lastMaintenanceDate = todayKey(this.clock);
    return { date: this.lastMaintenanceDate, generated, carry, reminderError };
  }

  /**
   * Replaces all data with a validated backup. The current data is written
   * out through `saveSafetyCopy` first; if that fails nothing is replaced.
   */
  async restoreBackup(
    validated: ValidatedBackup,
    saveSafetyCopy: (fileName: string, json: string) => Promise<string>,
  ): Promise<{ safetyCopy: string; maintenance: MaintenanceResult }> {
    const safetyCopy = await saveSafetyCopy(safetyCopyName(nowIso(this.clock)), await this.backup.exportJson());
    const { staleNotificationIds } = await this.backup.restore(validated);
    for (const id of staleNotificationIds) await this.notifications.cancel(id).catch(() => undefined);
    const maintenance = await this.runMaintenance();
    return { safetyCopy, maintenance };
  }

  /** Runs maintenance only if the civil date changed since the last run. */
  async maintainIfNewDay(): Promise<MaintenanceResult | null> {
    if (this.lastMaintenanceDate === todayKey(this.clock)) return null;
    return this.runMaintenance();
  }
}
