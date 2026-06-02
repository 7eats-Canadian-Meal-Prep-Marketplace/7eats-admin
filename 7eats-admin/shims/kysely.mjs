// Shim that re-exports kysely and adds missing migration constants
// that @better-auth/kysely-adapter expects but were removed from the main export
export * from "kysely";
export const DEFAULT_MIGRATION_TABLE = "kysely_migration";
export const DEFAULT_MIGRATION_LOCK_TABLE = "kysely_migration_lock";
