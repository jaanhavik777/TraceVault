// Shared PostgreSQL pool. OWNER: shared (do not change without telling your partner).
import { Pool, QueryResultRow, types } from "pg";

// Column type 1114 = TIMESTAMP (without time zone). The database stores UTC (Docker default), but
// node-pg would read those values as the machine's LOCAL time, shifting every timestamp by the UTC
// offset (5h30m in India). Parse them explicitly as UTC so the browser can convert to local time.
types.setTypeParser(1114, (value: string) => new Date(value.replace(" ", "T") + "Z"));

const globalForPg = globalThis as unknown as { pgPool?: Pool };

function createPool(): Pool {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set. Copy .env.example to .env.local.");
  }
  // connectionTimeoutMillis: if the database is unreachable (e.g. Docker is not running), fail in 5 s
  // with a clear error instead of leaving the page on "Loading..." forever.
  return new Pool({ connectionString, connectionTimeoutMillis: 5000 });
}

export const pool: Pool = globalForPg.pgPool ?? createPool();
if (process.env.NODE_ENV !== "production") globalForPg.pgPool = pool;

export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[]
): Promise<T[]> {
  const res = await pool.query<T>(text, params);
  return res.rows;
}

/**
 * Run several statements in ONE transaction (BEGIN / COMMIT / ROLLBACK).
 * Used to demonstrate the Transactions advanced feature from the app layer.
 */
export async function withTransaction<T>(
  fn: (client: import("pg").PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
