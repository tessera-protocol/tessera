import { DatabaseSync } from 'node:sqlite';

export function createNullifierRegistry(databasePath: string = ':memory:') {
  const database = new DatabaseSync(databasePath);

  database.exec(`
    CREATE TABLE IF NOT EXISTS presented_nullifiers (
      platform_id TEXT NOT NULL,
      nullifier TEXT NOT NULL,
      presented_at INTEGER NOT NULL,
      PRIMARY KEY (platform_id, nullifier)
    )
  `);

  const insertStatement = database.prepare(`
    INSERT OR IGNORE INTO presented_nullifiers (platform_id, nullifier, presented_at)
    VALUES (?, ?, ?)
  `);
  const existsStatement = database.prepare(`
    SELECT 1
    FROM presented_nullifiers
    WHERE platform_id = ? AND nullifier = ?
  `);
  const countStatement = database.prepare(`
    SELECT COUNT(*) AS count
    FROM presented_nullifiers
    WHERE platform_id = ?
  `);

  return {
    record(platformId: string, nullifier: string): boolean {
      const result = insertStatement.run(
        platformId,
        nullifier,
        Math.floor(Date.now() / 1000),
      );

      return result.changes > 0;
    },

    has(platformId: string, nullifier: string): boolean {
      return existsStatement.get(platformId, nullifier) !== undefined;
    },

    count(platformId: string): number {
      const row = countStatement.get(platformId) as { count: number } | undefined;
      return row?.count ?? 0;
    },

    close(): void {
      database.close();
    },
  };
}
