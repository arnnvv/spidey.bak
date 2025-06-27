import { neon, type NeonQueryFunction } from "@neondatabase/serverless";

let db: NeonQueryFunction<false, false> | undefined;

export function getDatabase(
  connectionString: string,
): NeonQueryFunction<false, false> {
  db = neon(connectionString);
  return db;
}
