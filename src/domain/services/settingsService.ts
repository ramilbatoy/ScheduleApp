import type { Database } from '../../db/types';
import { nowIso, type Clock } from '../dates';
import type { AppSettings } from '../models';
import { DRAWER_ORDER_REVISION, sanitizeNavigation } from '../navigationPrefs';
import { createRepos } from '../repos/repositories';

export class SettingsService {
  constructor(
    private readonly db: Database,
    private readonly clock: Clock,
  ) {}

  /**
   * Load settings and persist the canonical drawer order when this install has
   * not yet been migrated to {@link DRAWER_ORDER_REVISION}.
   */
  async get(): Promise<AppSettings> {
    const repos = createRepos(this.db);
    const settings = await repos.settings.getAll();
    const row = await this.db.get('app_settings', 'navigation');
    let rawRevision: number | undefined;
    if (row && typeof row.value === 'string') {
      try {
        const parsed = JSON.parse(String(row.value)) as { orderRevision?: unknown };
        if (typeof parsed.orderRevision === 'number') rawRevision = parsed.orderRevision;
      } catch {
        rawRevision = undefined;
      }
    }
    if (rawRevision !== DRAWER_ORDER_REVISION) {
      await repos.settings.set('navigation', settings.navigation, nowIso(this.clock));
    }
    return settings;
  }

  async set<K extends keyof AppSettings>(key: K, value: AppSettings[K]): Promise<AppSettings> {
    return this.db.transaction(async (tx) => {
      const repos = createRepos(tx);
      let next = value;
      if (key === 'navigation') {
        const sanitized = sanitizeNavigation(value);
        // Stamp the current revision so the one-time canonical override does not
        // keep wiping intentional reorders after this install has migrated.
        next = {
          ...sanitized,
          order: [...sanitized.order],
          orderRevision: DRAWER_ORDER_REVISION,
        } as AppSettings[K];
      }
      await repos.settings.set(key, next, nowIso(this.clock));
      return repos.settings.getAll();
    });
  }
}
