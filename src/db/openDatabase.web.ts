import { IndexedDbPersistence } from './indexeddb/idbPersistence';
import { MemoryDatabase } from './memory/memoryDriver';
import type { Database } from './types';

export const DATABASE_NAME = 'schedule-app';

/** Web: IndexedDB is the durable store; queries run on an in-memory mirror. */
export async function openAppDatabase(): Promise<Database> {
  const persistence = await IndexedDbPersistence.open(DATABASE_NAME);
  if (navigator.storage?.persist) {
    navigator.storage.persist().catch(() => undefined);
  }
  return MemoryDatabase.open(persistence, 'indexeddb');
}
