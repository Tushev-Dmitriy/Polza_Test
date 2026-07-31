import { Pool } from "pg";

const connectionString =
  process.env.DATABASE_URL ?? "postgresql://polza:polza@localhost:5432/polza";

const globalForDb = globalThis as unknown as { dbPool?: Pool };

export const db =
  globalForDb.dbPool ??
  new Pool({
    connectionString,
    max: 10,
    idleTimeoutMillis: 30_000,
  });

if (process.env.NODE_ENV !== "production") globalForDb.dbPool = db;
