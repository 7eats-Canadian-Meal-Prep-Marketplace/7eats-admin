// One-off: apply every db/migrations/*.sql file to the shared Neon DB, in order.
// Usage:  node scripts/apply-discount-migration.mjs
// Reads DATABASE_URL from process.env or from .env.local (no extra deps).
// Idempotent: statements hitting "already exists" are skipped so re-runs are safe.

import { readdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { neon } from "@neondatabase/serverless";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");

function loadDatabaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  try {
    const env = readFileSync(resolve(root, ".env.local"), "utf8");
    for (const line of env.split(/\r?\n/)) {
      const m = line.match(/^\s*DATABASE_URL\s*=\s*(.*)\s*$/);
      if (m) return m[1].replace(/^["']|["']$/g, "");
    }
  } catch {
    /* ignore */
  }
  return null;
}

const url = loadDatabaseUrl();
if (!url) {
  console.error("DATABASE_URL not found (env or .env.local)");
  process.exit(1);
}

function statementsOf(file) {
  return readFileSync(file, "utf8")
    .split(/\r?\n/)
    .filter((line) => !line.trimStart().startsWith("--"))
    .join("\n")
    .split(/;\s*\n/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

const migrationsDir = resolve(root, "db/migrations");
const files = readdirSync(migrationsDir)
  .filter((f) => f.endsWith(".sql"))
  .sort();

const sql = neon(url);

const run = async () => {
  for (const file of files) {
    console.error(`--- ${file} ---`);
    for (const stmt of statementsOf(resolve(migrationsDir, file))) {
      try {
        await sql.query(stmt);
      } catch (err) {
        const msg = String(err?.message ?? err);
        // Make re-runs safe: skip objects that already exist.
        if (/already exists/i.test(msg)) {
          console.error(
            `SKIP (exists): ${stmt.slice(0, 60).replace(/\s+/g, " ")}…`,
          );
          continue;
        }
        console.error(`FAILED: ${stmt.slice(0, 80).replace(/\s+/g, " ")}…`);
        console.error(msg);
        process.exit(1);
      }
    }
  }

  const cols = await sql.query(
    "SELECT column_name FROM information_schema.columns WHERE table_name = 'platform_discounts' ORDER BY 1",
  );
  console.error(
    `OK — platform_discounts columns: ${cols.map((c) => c.column_name).join(", ")}`,
  );
  const ordersCols = await sql.query(
    "SELECT column_name FROM information_schema.columns WHERE table_name = 'orders' AND column_name LIKE 'platform_discount%' ORDER BY 1",
  );
  console.error(
    `OK — orders new columns: ${ordersCols.map((c) => c.column_name).join(", ")}`,
  );
  const payCols = await sql.query(
    "SELECT column_name FROM information_schema.columns WHERE table_name = 'order_payments' AND (column_name LIKE 'platform_subsidy%' OR column_name LIKE 'stripe_topup%') ORDER BY 1",
  );
  console.error(
    `OK — order_payments new columns: ${payCols.map((c) => c.column_name).join(", ")}`,
  );
};

run();
