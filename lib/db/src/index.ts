import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import pg, { type PoolClient } from "pg";
import { bindPublicInsightsSeed } from "./seed-public-insights";
import * as schema from "./schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

export const pool = new Pool({ connectionString: process.env.DATABASE_URL });
export type WorkspaceDatabase = NodePgDatabase<typeof schema>;
export const db: WorkspaceDatabase = drizzle(pool, { schema });

export function databaseForClient(client: PoolClient): WorkspaceDatabase {
  return drizzle(client, { schema });
}

export * from "./schema";

export const seedPublicInsights = bindPublicInsightsSeed(db);
