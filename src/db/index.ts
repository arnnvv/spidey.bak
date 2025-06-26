import postgres, { Sql } from "postgres";

let db: Sql | null = null;

export function getDatabase(connectionString: string): Sql {
  if (!db) {
    db = postgres(connectionString, {
      ssl: "require",
      connect_timeout: 30,
      idle_timeout: 20,
      max_lifetime: 60 * 30,
    });
  }

  return db;
}
