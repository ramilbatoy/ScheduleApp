import { format } from 'date-fns';

import { ValidationError } from '@/domain/models';
import type { BackupSummary, ValidatedBackup } from '@/domain/services/backupService';
import type { AppServices } from '@/domain/services/container';
import { backupFiles } from '@/platform/backupFiles';

import { choose, confirm } from './components/dialogs';

export type FlowResult = { ok: true; message: string } | { ok: false; message: string } | null;

const describe = (s: BackupSummary) =>
  `${s.tasks} task${s.tasks === 1 ? '' : 's'}, ${s.events} event${s.events === 1 ? '' : 's'}, ${s.categories} categor${s.categories === 1 ? 'y' : 'ies'}`;

const when = (iso: string) => new Date(iso).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });

/** Export → choose destination → write. Returns null if the user backed out. */
export async function exportBackupFlow(services: AppServices): Promise<FlowResult> {
  const fileName = `dayplanner-backup-${format(services.clock.now(), 'yyyy-MM-dd-HHmm')}.json`;
  let target: 'folder' | 'share' | null = 'folder';
  if (backupFiles.canSaveToFolder) {
    target = await choose<'folder' | 'share' | null>(
      'Export backup',
      'Saves everything — tasks, events, history, categories and settings — as one JSON file.',
      [
        { label: 'Save to a folder on this device', value: 'folder', tone: 'primary' },
        ...(backupFiles.canShare ? [{ label: 'Share / send to another app', value: 'share' as const, tone: 'secondary' as const }] : []),
        { label: 'Cancel', value: null, tone: 'ghost' },
      ],
    );
  }
  if (!target) return null;
  const json = await services.backup.exportJson();
  if (target === 'share') {
    await backupFiles.share(fileName, json);
    await services.backup.markBackedUp();
    return { ok: true, message: 'Backup ready to share' };
  }
  const where = await backupFiles.saveToFolder(fileName, json);
  if (!where) return null;
  await services.backup.markBackedUp();
  return { ok: true, message: `Saved ${fileName} to ${where}` };
}

async function confirmAndRestore(services: AppServices, validated: ValidatedBackup, title: string): Promise<FlowResult> {
  const current = await services.backup.currentSummary();
  const lines = [
    `Backup from ${when(validated.summary.exportedAt)}: ${describe(validated.summary)}.`,
    `This replaces everything on this device (${describe(current)}).`,
    'A safety copy of your current data is saved first, so you can undo.',
    ...validated.warnings.slice(0, 3).map((w) => `Note: ${w}`),
  ];
  if (!(await confirm(title, lines.join('\n\n'), 'Replace my data', true))) return null;
  const { safetyCopy } = await services.restoreBackup(validated, (name, json) => backupFiles.saveSafetyCopy(name, json));
  return { ok: true, message: `Restored ${describe(validated.summary)}. Previous data saved to ${safetyCopy}.` };
}

/** Pick → validate → confirm overwrite → safety copy → restore. */
export async function restoreBackupFlow(services: AppServices): Promise<FlowResult> {
  const picked = await backupFiles.pick();
  if (!picked) return null;
  let validated: ValidatedBackup;
  try {
    validated = services.backup.validate(picked.text);
  } catch (e) {
    if (!(e instanceof ValidationError)) throw e;
    await choose(`Can't restore “${picked.name}”`, `${e.message}\n\nYour current data was not changed.`, [{ label: 'OK', value: true }]);
    return { ok: false, message: 'Restore cancelled — the file is not a valid backup' };
  }
  return confirmAndRestore(services, validated, 'Replace all data?');
}

/** Restores the automatic copy taken before the most recent restore. */
export async function undoRestoreFlow(services: AppServices): Promise<FlowResult> {
  const [latest] = await backupFiles.listSafetyCopies();
  if (!latest) return { ok: false, message: 'There is no earlier restore to undo' };
  const validated = services.backup.validate(await latest.read());
  return confirmAndRestore(services, validated, 'Undo last restore?');
}

export async function latestSafetyCopyDate(): Promise<string | null> {
  const [latest] = await backupFiles.listSafetyCopies();
  return latest ? (latest.savedAt ?? '') : null;
}
