import type { Database } from '../../db/types';
import { addDaysKey, nowIso, todayKey, type Clock } from '../dates';
import type { DateKey } from '../models';
import { createRepos } from '../repos/repositories';
import { GENERATION_WINDOW_DAYS, generateInstances } from './occurrenceOps';

export class RecurrenceService {
  constructor(
    private readonly db: Database,
    private readonly clock: Clock,
  ) {}

  /** Materializes instances through today + window for every live series. */
  ensureWindow(): Promise<number> {
    return this.ensureThrough(addDaysKey(todayKey(this.clock), GENERATION_WINDOW_DAYS));
  }

  /** Extends generation so a calendar range far in the future has its instances. */
  async ensureThrough(end: DateKey): Promise<number> {
    return this.db.transaction(async (tx) => {
      const repos = createRepos(tx);
      const now = nowIso(this.clock);
      const tasks = (await repos.tasks.listActive()).filter((t) => t.recurringRuleId);
      let created = 0;
      for (const task of tasks) {
        const rule = await repos.rules.get(task.recurringRuleId!);
        if (!rule) continue;
        if (rule.generatedUntil && rule.generatedUntil >= end) continue;
        if (rule.endDate && rule.generatedUntil && rule.generatedUntil >= rule.endDate) continue;
        created += await generateInstances(repos, task, rule, rule.startDate, end, now);
      }
      return created;
    });
  }
}
