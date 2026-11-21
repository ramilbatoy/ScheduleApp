import * as DocumentPicker from 'expo-document-picker';
import { Directory, File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import { safetyCopyDate } from '../domain/services/backupService';

export interface PickedFile {
  name: string;
  text: string;
}

export interface SafetyCopy {
  name: string;
  savedAt: string | null;
  read(): Promise<string>;
}

const SAFETY_DIR = 'safety-backups';
const KEEP_SAFETY_COPIES = 5;

function safetyDir(): Directory {
  const dir = new Directory(Paths.document, SAFETY_DIR);
  if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
  return dir;
}

function isCancel(e: unknown): boolean {
  return e instanceof Error && /cancel/i.test(e.message);
}

/** Android/iOS: Storage Access Framework folder picker, share sheet, document picker, app-private safety copies. */
export const backupFiles = {
  /** Native can write straight into a user-chosen folder (Downloads, SD card, Drive…). */
  canSaveToFolder: true,
  canShare: true,

  /** Returns the folder name written to, or null if the user cancelled. */
  async saveToFolder(fileName: string, json: string): Promise<string | null> {
    let dir: Directory;
    try {
      dir = await Directory.pickDirectoryAsync();
    } catch (e) {
      if (isCancel(e)) return null;
      throw e;
    }
    if (!dir) return null;
    const file = dir.createFile(fileName, 'application/json');
    await file.write(json);
    return dir.name || 'the selected folder';
  },

  /** Hands the backup to the share sheet. Resolves when the sheet closes. */
  async share(fileName: string, json: string): Promise<void> {
    if (!(await Sharing.isAvailableAsync())) throw new Error('Sharing is not available on this device.');
    const file = new File(Paths.cache, fileName);
    if (file.exists) file.delete();
    file.create();
    await file.write(json);
    await Sharing.shareAsync(file.uri, { mimeType: 'application/json', dialogTitle: 'Save DayPlanner backup', UTI: 'public.json' });
  },

  async pick(): Promise<PickedFile | null> {
    const result = await DocumentPicker.getDocumentAsync({
      type: ['application/json', 'text/plain', 'application/octet-stream'],
      copyToCacheDirectory: true,
      multiple: false,
    });
    if (result.canceled || !result.assets?.length) return null;
    const asset = result.assets[0];
    return { name: asset.name, text: await new File(asset.uri).text() };
  },

  async saveSafetyCopy(fileName: string, json: string): Promise<string> {
    const dir = safetyDir();
    const file = new File(dir, fileName);
    if (file.exists) file.delete();
    file.create();
    await file.write(json);
    const old = (await this.listSafetyCopies()).slice(KEEP_SAFETY_COPIES);
    for (const c of old) {
      const f = new File(dir, c.name);
      if (f.exists) f.delete();
    }
    return 'app storage (Settings → Undo last restore)';
  },

  /** Newest first. */
  async listSafetyCopies(): Promise<SafetyCopy[]> {
    const dir = safetyDir();
    return dir
      .list()
      .filter((e): e is File => e instanceof File && e.name.endsWith('.json'))
      .map((f) => ({
        name: f.name,
        savedAt: safetyCopyDate(f.name),
        read: () => f.text(),
      }))
      .sort((a, b) => b.name.localeCompare(a.name));
  },
};
