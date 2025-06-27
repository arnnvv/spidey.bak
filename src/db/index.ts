import { Pool } from "@neondatabase/serverless";

export function getDatabase(connectionString: string): Pool {
  const pool = new Pool({ connectionString });

  return pool;
}
