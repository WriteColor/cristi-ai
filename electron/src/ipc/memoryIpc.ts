import { ipcMain, app } from 'electron';
import path from 'path';
import fs from 'fs';
import { MemoryRecord, MemoryLoadResult, MemorySaveResult } from '../types/electron.types';

interface SqliteDatabaseSync {
  exec(sql: string): void;
  prepare(sql: string): {
    all(): Array<{ payload: string }>;
    run(...params: unknown[]): unknown;
  };
}

let memoryDatabase: SqliteDatabaseSync | null = null;
let memoryDatabaseUnavailable = false;

function getMemoryDatabase(): SqliteDatabaseSync | null {
  if (memoryDatabase || memoryDatabaseUnavailable) return memoryDatabase;
  try {
    // Dynamic require so older node runtimes fail gracefully without crash
     
    const { DatabaseSync } = require('node:sqlite');
    const dbPath = path.join(app.getPath('userData'), 'cristi-memory.sqlite');
    memoryDatabase = new DatabaseSync(dbPath) as SqliteDatabaseSync;
    memoryDatabase.exec(`
      CREATE TABLE IF NOT EXISTS memories (
        id TEXT PRIMARY KEY,
        payload TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS memories_updated_at_idx ON memories(updated_at);
    `);
    return memoryDatabase;
  } catch (error) {
    memoryDatabaseUnavailable = true;
    console.warn('[Memory] SQLite no disponible; usando JSON atómico:', (error as Error)?.message || String(error));
    return null;
  }
}

function memoryJsonPath(): string {
  return path.join(app.getPath('userData'), 'cristi-memories.json');
}

function memoryInitializedPath(): string {
  return path.join(app.getPath('userData'), 'cristi-memory.initialized');
}

/**
 * Registers persistent memory IPC handlers with SQLite and atomic JSON fallback.
 */
export function registerMemoryIpc(): void {
  ipcMain.handle('memory-load', async (): Promise<MemoryLoadResult> => {
    const db = getMemoryDatabase();
    if (db) {
      try {
        const rows = db.prepare('SELECT payload FROM memories ORDER BY updated_at DESC').all();
        if (rows.length > 0) {
          return {
            success: true,
            backend: 'sqlite',
            memories: rows.map((row) => JSON.parse(row.payload) as MemoryRecord),
          };
        }
        try {
          await fs.promises.access(memoryInitializedPath());
          return { success: true, backend: 'sqlite', memories: [] };
        } catch (_) {
          return { success: true, backend: 'sqlite', memories: null };
        }
      } catch (error) {
        console.warn('[Memory] Error leyendo SQLite:', (error as Error)?.message || String(error));
      }
    }

    try {
      const content = await fs.promises.readFile(memoryJsonPath(), 'utf8');
      const memories = JSON.parse(content);
      return {
        success: true,
        backend: 'json',
        memories: Array.isArray(memories) ? (memories as MemoryRecord[]) : [],
      };
    } catch (_) {
      return { success: true, backend: db ? 'sqlite' : 'json', memories: null };
    }
  });

  ipcMain.handle('memory-save', async (_event, memories: unknown): Promise<MemorySaveResult> => {
    const records = Array.isArray(memories) ? (memories as MemoryRecord[]).slice(0, 20000) : [];
    const db = getMemoryDatabase();

    if (db) {
      try {
        db.exec('BEGIN');
        db.exec('DELETE FROM memories');
        const insert = db.prepare('INSERT INTO memories (id, payload, updated_at) VALUES (?, ?, ?)');
        for (const memory of records) {
          if (!memory?.id) continue;
          insert.run(
            String(memory.id),
            JSON.stringify(memory),
            String(memory.updatedAt || new Date().toISOString())
          );
        }
        db.exec('COMMIT');
        await fs.promises.mkdir(path.dirname(memoryInitializedPath()), { recursive: true });
        await fs.promises.writeFile(memoryInitializedPath(), 'initialized', 'utf8');
        return { success: true, backend: 'sqlite', count: records.length };
      } catch (error) {
        try {
          db.exec('ROLLBACK');
        } catch (_) {}
        console.warn('[Memory] Error guardando SQLite; usando JSON:', (error as Error)?.message || String(error));
      }
    }

    const target = memoryJsonPath();
    const temp = `${target}.${process.pid}.${Date.now()}.tmp`;
    try {
      await fs.promises.mkdir(path.dirname(target), { recursive: true });
      await fs.promises.writeFile(temp, JSON.stringify(records, null, 2), 'utf8');
      await fs.promises.rename(temp, target);
      await fs.promises.writeFile(memoryInitializedPath(), 'initialized', 'utf8');
      return { success: true, backend: 'json', count: records.length };
    } catch (error) {
      try {
        await fs.promises.unlink(temp);
      } catch (_) {}
      return { success: false, error: (error as Error)?.message || String(error) };
    }
  });
}
