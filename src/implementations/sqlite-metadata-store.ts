import {
  chmodSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { dirname } from "node:path";
import { Effect, Layer } from "effect";
import initSqlJs, { type Database } from "sql.js";
import {
  CommandNotFoundError,
  MetadataStoreError,
  SecretNotFoundError,
} from "../errors.js";
import { DatabaseConfig } from "../services/database-config.js";
import {
  type CommandMetadata,
  MetadataStore,
  type SecretMetadata,
} from "../services/metadata-store.js";

const DIR_PERMISSIONS = 0o700;
const FILE_PERMISSIONS = 0o600;

const initDb = async (dbPath: string): Promise<Database> => {
  const dbDir = dirname(dbPath);
  mkdirSync(dbDir, { recursive: true, mode: DIR_PERMISSIONS });
  chmodSync(dbDir, DIR_PERMISSIONS);
  const SQL = await initSqlJs();
  const db = existsSync(dbPath)
    ? new SQL.Database(readFileSync(dbPath))
    : new SQL.Database();
  db.run(
    "CREATE TABLE IF NOT EXISTS secrets (id INTEGER PRIMARY KEY AUTOINCREMENT, env TEXT NOT NULL, key TEXT NOT NULL, type TEXT NOT NULL DEFAULT 'string', created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')), UNIQUE(env, key))"
  );
  db.run(
    "CREATE TABLE IF NOT EXISTS commands (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE, command TEXT NOT NULL, context TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT (datetime('now')))"
  );
  db.run(
    "CREATE TABLE IF NOT EXISTS env_exports (id INTEGER PRIMARY KEY AUTOINCREMENT, context TEXT NOT NULL, path TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT (datetime('now')))"
  );
  db.run(
    "CREATE UNIQUE INDEX IF NOT EXISTS idx_env_exports_path ON env_exports(path)"
  );
  const cols = db
    .exec("PRAGMA table_info(secrets)")
    .flatMap((r) => r.values.map((v) => v[1]));
  if (!cols.includes("expires_at")) {
    db.run("ALTER TABLE secrets ADD COLUMN expires_at TEXT DEFAULT NULL");
  }
  persist(db, dbPath);
  return db;
};

const persist = (db: Database, dbPath: string) => {
  writeFileSync(dbPath, Buffer.from(db.export()), { mode: FILE_PERMISSIONS });
};

const make = Effect.gen(function* () {
  const { path: dbPath } = yield* DatabaseConfig;
  const db = yield* Effect.acquireRelease(
    Effect.tryPromise({
      try: () => initDb(dbPath),
      catch: (error) =>
        new MetadataStoreError({
          operation: "init",
          message: `Failed to initialize database: ${error}`,
        }),
    }),
    (db) => Effect.sync(() => db.close())
  );
  let batching = false;
  let dirty = false;
  const maybePersist = () => {
    if (batching) {
      dirty = true;
      return;
    }
    persist(db, dbPath);
  };
  return MetadataStore.of({
    beginBatch: Effect.fn("SqliteMetadataStore.beginBatch")(function* () {
      yield* Effect.sync(() => {
        batching = true;
        dirty = false;
      });
    }),
    endBatch: Effect.fn("SqliteMetadataStore.endBatch")(function* () {
      batching = false;
      if (dirty) {
        yield* Effect.try({
          try: () => {
            persist(db, dbPath);
            dirty = false;
          },
          catch: (error) =>
            new MetadataStoreError({
              operation: "endBatch",
              message: `Failed to persist batched changes: ${error}`,
            }),
        });
      }
    }),
    upsert: Effect.fn("SqliteMetadataStore.upsert")(function* (
      env: string,
      key: string,
      expiresAt?: string | null
    ) {
      yield* Effect.try({
        try: () => {
          db.run(
            "INSERT INTO secrets (env, key, type, expires_at) VALUES (?, ?, 'string', ?) ON CONFLICT(env, key) DO UPDATE SET updated_at = datetime('now'), expires_at = ?",
            [env, key, expiresAt ?? null, expiresAt ?? null]
          );
          maybePersist();
        },
        catch: (error) =>
          new MetadataStoreError({
            operation: "upsert",
            message: `Failed to upsert metadata for ${env}/${key}: ${error}`,
          }),
      });
    }),
    get: Effect.fn("SqliteMetadataStore.get")(function* (
      env: string,
      key: string
    ) {
      const row = yield* Effect.try({
        try: () => {
          const stmt = db.prepare(
            "SELECT key, created_at, updated_at, expires_at FROM secrets WHERE env = ? AND key = ?"
          );
          stmt.bind([env, key]);
          if (!stmt.step()) {
            stmt.free();
            return null;
          }
          const result = stmt.getAsObject() as unknown as SecretMetadata;
          stmt.free();
          return result;
        },
        catch: (error) =>
          new MetadataStoreError({
            operation: "get",
            message: `Failed to get metadata for ${env}/${key}: ${error}`,
          }),
      });
      if (!row) {
        return yield* new SecretNotFoundError({
          key,
          context: env,
          message: `Secret metadata not found: ${env}/${key}`,
        });
      }
      return row;
    }),
    remove: Effect.fn("SqliteMetadataStore.remove")(function* (
      env: string,
      key: string
    ) {
      yield* Effect.try({
        try: () => {
          db.run("DELETE FROM secrets WHERE env = ? AND key = ?", [env, key]);
          maybePersist();
        },
        catch: (error) =>
          new MetadataStoreError({
            operation: "remove",
            message: `Failed to remove metadata for ${env}/${key}: ${error}`,
          }),
      });
    }),
    search: Effect.fn("SqliteMetadataStore.search")(function* (
      env: string,
      pattern: string
    ) {
      return yield* Effect.try({
        try: () => {
          const results: Array<{ key: string }> = [];
          const stmt = db.prepare(
            "SELECT key FROM secrets WHERE env = ? AND key GLOB ?"
          );
          stmt.bind([env, pattern]);
          while (stmt.step()) {
            results.push(stmt.getAsObject() as { key: string });
          }
          stmt.free();
          return results;
        },
        catch: (error) =>
          new MetadataStoreError({
            operation: "search",
            message: `Failed to search metadata for ${env}/${pattern}: ${error}`,
          }),
      });
    }),
    list: Effect.fn("SqliteMetadataStore.list")(function* (env: string) {
      return yield* Effect.try({
        try: () => {
          const results: Array<{
            key: string;
            updated_at: string;
            expires_at: string | null;
          }> = [];
          const stmt = db.prepare(
            "SELECT key, updated_at, expires_at FROM secrets WHERE env = ? ORDER BY key"
          );
          stmt.bind([env]);
          while (stmt.step()) {
            results.push(
              stmt.getAsObject() as {
                key: string;
                updated_at: string;
                expires_at: string | null;
              }
            );
          }
          stmt.free();
          return results;
        },
        catch: (error) =>
          new MetadataStoreError({
            operation: "list",
            message: `Failed to list metadata for ${env}: ${error}`,
          }),
      });
    }),
    searchContexts: Effect.fn("SqliteMetadataStore.searchContexts")(function* (
      pattern: string
    ) {
      return yield* Effect.try({
        try: () => {
          const results: Array<{ context: string; count: number }> = [];
          const stmt = db.prepare(
            "SELECT env, COUNT(*) as count FROM secrets WHERE env GLOB ? GROUP BY env ORDER BY env"
          );
          stmt.bind([pattern]);
          while (stmt.step()) {
            const row = stmt.getAsObject() as { env: string; count: number };
            results.push({ context: row.env, count: row.count });
          }
          stmt.free();
          return results;
        },
        catch: (error) =>
          new MetadataStoreError({
            operation: "searchContexts",
            message: `Failed to search contexts for ${pattern}: ${error}`,
          }),
      });
    }),
    listContexts: Effect.fn("SqliteMetadataStore.listContexts")(function* () {
      return yield* Effect.try({
        try: () => {
          const results: Array<{ context: string; count: number }> = [];
          const stmt = db.prepare(
            "SELECT env, COUNT(*) as count FROM secrets GROUP BY env ORDER BY env"
          );
          while (stmt.step()) {
            const row = stmt.getAsObject() as { env: string; count: number };
            results.push({ context: row.env, count: row.count });
          }
          stmt.free();
          return results;
        },
        catch: (error) =>
          new MetadataStoreError({
            operation: "listContexts",
            message: `Failed to list contexts: ${error}`,
          }),
      });
    }),
    saveCommand: Effect.fn("SqliteMetadataStore.saveCommand")(function* (
      name: string,
      command: string,
      context: string
    ) {
      yield* Effect.try({
        try: () => {
          db.run(
            "INSERT INTO commands (name, command, context) VALUES (?, ?, ?) ON CONFLICT(name) DO UPDATE SET command = excluded.command, context = excluded.context",
            [name, command, context]
          );
          maybePersist();
        },
        catch: (error) =>
          new MetadataStoreError({
            operation: "saveCommand",
            message: `Failed to save command "${name}": ${error}`,
          }),
      });
    }),
    getCommand: Effect.fn("SqliteMetadataStore.getCommand")(function* (
      name: string
    ) {
      const row = yield* Effect.try({
        try: () => {
          const stmt = db.prepare(
            "SELECT name, command, context, created_at FROM commands WHERE name = ?"
          );
          stmt.bind([name]);
          if (!stmt.step()) {
            stmt.free();
            return null;
          }
          const result = stmt.getAsObject() as unknown as CommandMetadata;
          stmt.free();
          return result;
        },
        catch: (error) =>
          new MetadataStoreError({
            operation: "getCommand",
            message: `Failed to get command "${name}": ${error}`,
          }),
      });
      if (!row) {
        return yield* new CommandNotFoundError({
          name,
          message: `Command not found: "${name}"`,
        });
      }
      return row;
    }),
    searchCommands: Effect.fn("SqliteMetadataStore.searchCommands")(function* (
      pattern: string,
      field: "name" | "command" | "all"
    ) {
      return yield* Effect.try({
        try: () => {
          const results: CommandMetadata[] = [];
          let query: string;
          if (field === "name") {
            query =
              "SELECT name, command, context, created_at FROM commands WHERE name GLOB ? ORDER BY name";
          } else if (field === "command") {
            query =
              "SELECT name, command, context, created_at FROM commands WHERE command GLOB ? ORDER BY name";
          } else {
            query =
              "SELECT name, command, context, created_at FROM commands WHERE name GLOB ? OR command GLOB ? ORDER BY name";
          }
          const stmt = db.prepare(query);
          stmt.bind(field === "all" ? [pattern, pattern] : [pattern]);
          while (stmt.step()) {
            results.push(stmt.getAsObject() as unknown as CommandMetadata);
          }
          stmt.free();
          return results;
        },
        catch: (error) =>
          new MetadataStoreError({
            operation: "searchCommands",
            message: `Failed to search commands for "${pattern}": ${error}`,
          }),
      });
    }),
    listCommands: Effect.fn("SqliteMetadataStore.listCommands")(function* () {
      return yield* Effect.try({
        try: () => {
          const results: CommandMetadata[] = [];
          const stmt = db.prepare(
            "SELECT name, command, context, created_at FROM commands ORDER BY name"
          );
          while (stmt.step()) {
            results.push(stmt.getAsObject() as unknown as CommandMetadata);
          }
          stmt.free();
          return results;
        },
        catch: (error) =>
          new MetadataStoreError({
            operation: "listCommands",
            message: `Failed to list commands: ${error}`,
          }),
      });
    }),
    removeCommand: Effect.fn("SqliteMetadataStore.removeCommand")(function* (
      name: string
    ) {
      const rowsModified = yield* Effect.try({
        try: () => {
          db.run("DELETE FROM commands WHERE name = ?", [name]);
          return db.getRowsModified();
        },
        catch: (error) =>
          new MetadataStoreError({
            operation: "removeCommand",
            message: `Failed to remove command "${name}": ${error}`,
          }),
      });
      if (rowsModified === 0) {
        return yield* new CommandNotFoundError({
          name,
          message: `Command not found: "${name}"`,
        });
      }
      yield* Effect.try({
        try: () => maybePersist(),
        catch: (error) =>
          new MetadataStoreError({
            operation: "removeCommand",
            message: `Failed to persist after removing command "${name}": ${error}`,
          }),
      });
    }),
    listExpiring: Effect.fn("SqliteMetadataStore.listExpiring")(function* (
      env: string,
      withinMs: number
    ) {
      return yield* Effect.try({
        try: () => {
          const cutoff = new Date(Date.now() + withinMs)
            .toISOString()
            .replace("T", " ")
            .replace("Z", "")
            .slice(0, 19);
          const results: SecretMetadata[] = [];
          const stmt = db.prepare(
            "SELECT key, created_at, updated_at, expires_at FROM secrets WHERE env = ? AND expires_at IS NOT NULL AND expires_at <= ? ORDER BY expires_at"
          );
          stmt.bind([env, cutoff]);
          while (stmt.step()) {
            results.push(stmt.getAsObject() as unknown as SecretMetadata);
          }
          stmt.free();
          return results;
        },
        catch: (error) =>
          new MetadataStoreError({
            operation: "listExpiring",
            message: `Failed to list expiring secrets for ${env}: ${error}`,
          }),
      });
    }),
    listAllExpiring: Effect.fn("SqliteMetadataStore.listAllExpiring")(
      function* (withinMs: number) {
        return yield* Effect.try({
          try: () => {
            const cutoff = new Date(Date.now() + withinMs)
              .toISOString()
              .replace("T", " ")
              .replace("Z", "")
              .slice(0, 19);
            const results: Array<SecretMetadata & { env: string }> = [];
            const stmt = db.prepare(
              "SELECT env, key, created_at, updated_at, expires_at FROM secrets WHERE expires_at IS NOT NULL AND expires_at <= ? ORDER BY expires_at"
            );
            stmt.bind([cutoff]);
            while (stmt.step()) {
              results.push(
                stmt.getAsObject() as unknown as SecretMetadata & {
                  env: string;
                }
              );
            }
            stmt.free();
            return results;
          },
          catch: (error) =>
            new MetadataStoreError({
              operation: "listAllExpiring",
              message: `Failed to list all expiring secrets: ${error}`,
            }),
        });
      }
    ),
    trackEnvFileExport: Effect.fn("SqliteMetadataStore.trackEnvFileExport")(
      function* (context: string, path: string) {
        yield* Effect.try({
          try: () => {
            db.run(
              "INSERT INTO env_exports (context, path) VALUES (?, ?) ON CONFLICT(path) DO UPDATE SET context = excluded.context, created_at = datetime('now')",
              [context, path]
            );
            maybePersist();
          },
          catch: (error) =>
            new MetadataStoreError({
              operation: "trackEnvFileExport",
              message: `Failed to track env file export: ${error}`,
            }),
        });
      }
    ),
    listEnvFileExports: Effect.fn("SqliteMetadataStore.listEnvFileExports")(
      function* () {
        return yield* Effect.try({
          try: () => {
            const results: Array<{
              context: string;
              path: string;
              created_at: string;
            }> = [];
            const stmt = db.prepare(
              "SELECT context, path, created_at FROM env_exports ORDER BY created_at DESC"
            );
            while (stmt.step()) {
              results.push(
                stmt.getAsObject() as unknown as {
                  context: string;
                  path: string;
                  created_at: string;
                }
              );
            }
            stmt.free();
            return results;
          },
          catch: (error) =>
            new MetadataStoreError({
              operation: "listEnvFileExports",
              message: `Failed to list env file exports: ${error}`,
            }),
        });
      }
    ),
    removeEnvFileExport: Effect.fn("SqliteMetadataStore.removeEnvFileExport")(
      function* (path: string) {
        yield* Effect.try({
          try: () => {
            db.run("DELETE FROM env_exports WHERE path = ?", [path]);
            maybePersist();
          },
          catch: (error) =>
            new MetadataStoreError({
              operation: "removeEnvFileExport",
              message: `Failed to remove env file export: ${error}`,
            }),
        });
      }
    ),
  });
});

export const SqliteMetadataStoreLive = Layer.scoped(MetadataStore, make);
