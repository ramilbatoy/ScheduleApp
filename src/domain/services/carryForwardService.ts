import type { Database } from '../../db/types';
import { nowIso, todayKey, type Clock } from '../dates';
import { createRepos } from '../repos/repositories';
import { carryOccurrence } from './occurrenceOps';

export interface CarryResult {
  ran: boolean;
  moved: number;
  missed: number;
  taskIds: string[];
}

/**
 * Moves unfinished task occurrences from past days onto today.
 *
 * Idempotent by construction: after a run no pending task occurrence is dated
 * before today, so a second run (same day, another tab, a crash-retry) finds
 * nothing to do. Completed, cancelled, missed and deleted items are never
 * selected, events never carry, and manual future dates are untouched.
 */
export class CarryForwardService {
  constructor(
    private readonly db: Database,
    private readonly clock: Clock,
  ) {}

  /** Automatic run (startup, resume, midnight). No-op when the setting is off. */
  async runAuto(): Promise<CarryResult> {
    const settings = await createRepos(this.db).settings.getAll();
    if (!settings.autoCarryForward) return { ran: false, moved: 0, missed: 0, taskIds: [] };
    return this.run();
  }

  /** Runs regardless of the setting (the manual "Carry forward now" action). */
  async run(): Promise<CarryResult> {
    return this.db.transaction(async (tx) => {
      const repos = createRepos(tx);
      const now = nowIso(this.clock);
      const today = todayKey(this.clock);
      const stale = await repos.occurrences.listPendingBefore(today);
      const tasks = new Map((await repos.tasks.listByIds([...new Set(stale.map((o) => o.taskId))])).map((t) => [t.id, t]));
      let moved = 0;
      let missed = 0;
      const touched = new Set<string>();
      // Oldest first so a series' newest stale instance is the one that survives.
      for (const occ of stale) {
        const task = tasks.get(occ.taskId);
        if (!task) continue;
        const outcome = await carryOccurrence(repos, occ, task, today, now);
        if (outcome === 'moved') moved++;
        if (outcome === 'missed') missed++;
        if (outcome !== 'skipped') touched.add(task.id);
      }
      await repos.settings.set('lastCarryForwardRunDate', today, now);
      return { ran: true, moved, missed, taskIds: [...touched] };
    });
  }
}
