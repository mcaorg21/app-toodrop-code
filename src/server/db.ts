import pg from "pg";

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
  max: 10,
});

// Convert SQLite ? placeholders to PostgreSQL $1, $2, ...
function toPostgres(sql: string): string {
  let i = 0;
  // Also replace SQLite datetime('now', '+N hours') with PostgreSQL equivalent
  let s = sql.replace(/datetime\('now',\s*'([^']+)'\)/gi, (_m, interval) => {
    // e.g. '+24 hours' -> NOW() + INTERVAL '24 hours'
    const clean = interval.replace(/^\+/, "").trim();
    return `NOW() + INTERVAL '${clean}'`;
  });
  s = s.replace(/\?/g, () => `$${++i}`);
  return s;
}

interface D1Statement {
  bind(...params: unknown[]): D1Statement;
  run(): Promise<{ success: boolean; meta: { changes: number } }>;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<{ results: T[] }>;
}

function prepare(sql: string): D1Statement {
  let params: unknown[] = [];

  const stmt: D1Statement = {
    bind(...args: unknown[]): D1Statement {
      params = args;
      return stmt;
    },
    async run() {
      const result = await pool.query(toPostgres(sql), params);
      return { success: true, meta: { changes: result.rowCount ?? 0 } };
    },
    async first<T = Record<string, unknown>>(): Promise<T | null> {
      const result = await pool.query(toPostgres(sql), params);
      return (result.rows[0] as T) ?? null;
    },
    async all<T = Record<string, unknown>>(): Promise<{ results: T[] }> {
      const result = await pool.query(toPostgres(sql), params);
      return { results: result.rows as T[] };
    },
  };
  return stmt;
}

export const db = { prepare };
export type DB = typeof db;
