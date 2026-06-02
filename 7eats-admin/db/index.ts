import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema/index";

type DbType = ReturnType<typeof drizzle<typeof schema>>;

function createDb(): DbType {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL environment variable is not set");
  const sql = neon(url);
  return drizzle(sql, { schema });
}

let _db: DbType | undefined;

function getDb(): DbType {
  if (!_db) _db = createDb();
  return _db;
}

export const db = new Proxy({} as DbType, {
  get(_target, prop: string | symbol) {
    const instance = getDb();
    const value = (instance as unknown as Record<string | symbol, unknown>)[
      prop
    ];
    if (typeof value === "function") {
      return value.bind(instance);
    }
    return value;
  },
});
