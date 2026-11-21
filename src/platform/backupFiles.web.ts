import { safetyCopyDate } from '../domain/services/backupService';
import type { PickedFile, SafetyCopy } from './backupFiles';

export type { PickedFile, SafetyCopy } from './backupFiles';

const SAFETY_PREFIX = 'dayplanner.safety-backup:';
const KEEP_SAFETY_COPIES = 2;

function download(fileName: string, json: string) {
  const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

function safetyKeys(): string[] {
  const keys: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k?.startsWith(SAFETY_PREFIX)) keys.push(k);
  }
  return keys.sort().reverse();
}

/** Browser: download/upload. Safety copies live in localStorage, or are downloaded when it is full. */
export const backupFiles = {
  canSaveToFolder: false,
  canShare: false,

  async saveToFolder(fileName: string, json: string): Promise<string | null> {
    download(fileName, json);
    return 'your Downloads folder';
  },

  async share(fileName: string, json: string): Promise<void> {
    download(fileName, json);
  },

  pick(): Promise<PickedFile | null> {
    return new Promise((resolve, reject) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json,application/json';
      input.style.display = 'none';
      input.addEventListener('change', () => {
        const f = input.files?.[0];
        input.remove();
        if (!f) return resolve(null);
        f.text().then((text) => resolve({ name: f.name, text }), reject);
      });
      input.addEventListener('cancel', () => {
        input.remove();
        resolve(null);
      });
      document.body.appendChild(input);
      input.click();
    });
  },

  async saveSafetyCopy(fileName: string, json: string): Promise<string> {
    try {
      localStorage.setItem(SAFETY_PREFIX + fileName, json);
      for (const k of safetyKeys().slice(KEEP_SAFETY_COPIES)) localStorage.removeItem(k);
      return 'browser storage (Settings → Undo last restore)';
    } catch {
      download(fileName, json);
      return 'your Downloads folder';
    }
  },

  async listSafetyCopies(): Promise<SafetyCopy[]> {
    return safetyKeys().map((k) => {
      const name = k.slice(SAFETY_PREFIX.length);
      return {
        name,
        savedAt: safetyCopyDate(name),
        read: async () => localStorage.getItem(k) ?? '',
      };
    });
  },
};
