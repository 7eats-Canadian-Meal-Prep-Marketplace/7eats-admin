/**
 * Patches kysely@0.29.2 to export migration constants expected by
 * @better-auth/kysely-adapter. These constants were moved to internal
 * modules in kysely 0.28+, but the adapter still imports them from
 * the main package export.
 *
 * This script runs automatically via the "postinstall" npm lifecycle hook.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const kyselyIndex = join(
  process.cwd(),
  "node_modules/.pnpm/kysely@0.29.2/node_modules/kysely/dist/index.js",
);

try {
  const content = readFileSync(kyselyIndex, "utf8");

  const shim = `\n// Compat shim: re-export migration constants for @better-auth/kysely-adapter\nexport { DEFAULT_MIGRATION_TABLE, DEFAULT_MIGRATION_LOCK_TABLE } from './migration/migrator.js';\nexport { DefaultQueryCompiler } from './query-compiler/default-query-compiler.js';`;

  if (!content.includes("DEFAULT_MIGRATION_TABLE")) {
    writeFileSync(kyselyIndex, content + shim);
    console.log("✓ Applied kysely compat shim");
  }
} catch {
  // kysely may not be installed in this pnpm version path — skip silently
}
