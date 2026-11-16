import pg from "pg";

/** Direct database access for test setup only (local stack). */
export async function sql<T extends pg.QueryResultRow = pg.QueryResultRow>(
  text: string,
  params: unknown[] = [],
): Promise<T[]> {
  const client = new pg.Client({
    connectionString:
      process.env.DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:54342/postgres",
  });
  await client.connect();
  try {
    return (await client.query<T>(text, params)).rows;
  } finally {
    await client.end();
  }
}

/** A unique address so parallel tests never share an inbox or rate limit. */
export function uniqueEmail(prefix: string, domain = "aus.edu") {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@${domain}`;
}
