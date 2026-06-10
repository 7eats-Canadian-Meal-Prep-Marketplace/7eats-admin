import { Pool, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import ws from "ws";
import * as schema from "./schema/index";

// The neon-http driver has no transaction support, but several admin routes
// use db.transaction(). The WebSocket Pool driver supports interactive
// transactions, so use it here (runs on the Node runtime; `ws` is a dep).
neonConfig.webSocketConstructor = ws;

type DbType = ReturnType<typeof drizzle<typeof schema>>;

function createDb(): DbType {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL environment variable is not set");
  const pool = new Pool({ connectionString: url });
  return drizzle(pool, { schema });
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
