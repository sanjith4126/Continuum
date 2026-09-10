import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";
import * as relations from "./relations";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set");
}

const connectionUrl = new URL(process.env.DATABASE_URL);
if (["prefer", "require", "verify-ca"].includes(connectionUrl.searchParams.get("sslmode") ?? "")) {
  // Preserve node-postgres's current certificate-verifying behavior when its
  // next major release adopts libpq's weaker meanings for these aliases.
  connectionUrl.searchParams.set("sslmode", "verify-full");
}

const pool = new Pool({
  connectionString: connectionUrl.toString(),
  connectionTimeoutMillis: 10000,
  idleTimeoutMillis: 30000,
  statement_timeout: 10000,
  max: 10,
});

export const db = drizzle(pool, { schema: { ...schema, ...relations } });
export { pool };
