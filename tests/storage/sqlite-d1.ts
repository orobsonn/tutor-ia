import { readFileSync } from 'node:fs';
import { DatabaseSync, type StatementSync } from 'node:sqlite';

import type {
  D1Like,
  D1PreparedLike,
  D1ResultLike,
} from '../../src/storage.ts';

type Binding = string | number | bigint | null | Uint8Array;

class SqlitePrepared implements D1PreparedLike {
  readonly owner: SqliteD1;
  readonly sql: string;
  readonly bindings: Binding[];

  constructor(owner: SqliteD1, sql: string, bindings: Binding[] = []) {
    this.owner = owner;
    this.sql = sql;
    this.bindings = bindings;
  }

  bind(...values: unknown[]): D1PreparedLike {
    return new SqlitePrepared(this.owner, this.sql, values as Binding[]);
  }

  async first<T = Record<string, unknown>>(columnName?: string): Promise<T | null> {
    const row = this.statement().get(...this.bindings) as Record<string, unknown> | undefined;
    if (row === undefined) return null;
    return (columnName === undefined ? row : row[columnName]) as T;
  }

  async all<T = Record<string, unknown>>(): Promise<{ results: T[]; success: boolean }> {
    return {
      results: this.statement().all(...this.bindings) as T[],
      success: true,
    };
  }

  async run(): Promise<D1ResultLike> {
    return this.executeRun();
  }

  executeRun(): D1ResultLike {
    const result = this.statement().run(...this.bindings);
    return {
      success: true,
      results: [],
      meta: {
        changes: Number(result.changes),
        last_row_id: Number(result.lastInsertRowid),
      },
    };
  }

  private statement(): StatementSync {
    return this.owner.database.prepare(this.sql);
  }
}

export class SqliteD1 implements D1Like {
  readonly database: DatabaseSync;

  constructor() {
    this.database = new DatabaseSync(':memory:');
    this.database.exec('PRAGMA foreign_keys = ON');
  }

  prepare(sql: string): D1PreparedLike {
    return new SqlitePrepared(this, sql);
  }

  async batch(statements: D1PreparedLike[]): Promise<D1ResultLike[]> {
    this.database.exec('BEGIN IMMEDIATE');
    try {
      const results = statements.map((statement) => {
        if (!(statement instanceof SqlitePrepared) || statement.owner !== this) {
          throw new TypeError('batch received a statement from another database');
        }
        return statement.executeRun();
      });
      this.database.exec('COMMIT');
      return results;
    } catch (error) {
      this.database.exec('ROLLBACK');
      throw error;
    }
  }

  exec(sql: string): void {
    this.database.exec(sql);
  }

  query<T = Record<string, unknown>>(sql: string, ...bindings: Binding[]): T[] {
    return this.database.prepare(sql).all(...bindings) as T[];
  }

  close(): void {
    this.database.close();
  }
}

export function createTestDatabase(): SqliteD1 {
  const database = new SqliteD1();
  const migration = readFileSync(
    new URL('../../migrations/0001_initial.sql', import.meta.url),
    'utf8',
  );
  database.exec(migration);
  return database;
}
