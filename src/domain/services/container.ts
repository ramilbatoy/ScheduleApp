import type { Database } from '../../db/types';
import { systemClock, type Clock } from '../dates';
import { CategoryService } from './categoryService';
import { SettingsService } from './settingsService';

/** Every service, wired to one database and one clock. UI code talks only to this. */
export class AppServices {
  readonly categories: CategoryService;
  readonly settings: SettingsService;

  constructor(
    readonly db: Database,
    readonly clock: Clock = systemClock,
  ) {
    this.categories = new CategoryService(db, clock);
    this.settings = new SettingsService(db, clock);
  }

  /** One-time startup work after the database is open and migrated. */
  async bootstrap(): Promise<void> {
    await this.categories.seedDefaults();
  }
}
