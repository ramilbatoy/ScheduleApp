import type { Database } from '../../db/types';
import { nowIso, type Clock } from '../dates';
import type { AppSettings } from '../models';
import { createRepos } from '../repos/repositories';

export class SettingsService {
  constructor(
    private readonly db: Database,
    private readonly clock: Clock,
  ) {}

  get(): Promise<AppSettings> {
    return createRepos(this.db).settings.getAll();
  }

  async set<K extends keyof AppSettings>(key: K, value: AppSettings[K]): Promise<AppSettings> {
    return this.db.transaction(async (tx) => {
      const repos = createRepos(tx);
      await repos.settings.set(key, value, nowIso(this.clock));
      return repos.settings.getAll();
    });
  }
}
