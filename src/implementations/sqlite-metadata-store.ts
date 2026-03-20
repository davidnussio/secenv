import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { Effect, Layer } from "effect";
import initSqlJs, { type Database } from "sql.js";
import {
  CommandNotFoundError,
  MetadataStoreError,
  SecretNotFoundError,
} from "../errors.js";
import {
  type CommandMetadata,
  MetadataStore,
} from "../services/metadata-store.js";

const dbDir = join(homedir(), ".envsec");
const dbPath = join(dbDir, "store.sqlite");

const initDb = async (): Promise<Database> => {
  mkdirSync(dbDir, { recursive: true });
  const SQL = await initSqlJs();
  const db = existsSync(dbPath)
    ? new SQL.Database(readFileSync(dbPath))
    : new SQL.Database();
  db.run(`
    CREATE TABLE IF NOT EXISTS secrets (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      env        TEXT NOT NULL,
      key        TEXT NOT NULL,
      type       TEXT NOT NULL DEFAULT 'string',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(env, key)
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS commands (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      name       TEXT NOT NULL UNIQUE,
      command    TEXT NOT NULL,
      context    TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
  persist(db);
  return db;
};

const persist = (db: Database) => {
  writeFileSync(dbPath, Buffer.from(db.export()));
};

const make = Effect.gen(function* () {
  const db = yield* Effect.tryPromise({
    try: () => initDb(),
    catch: (error) =>
      new MetadataStoreError({
        operation: "init",
        message: `Failed to initialize database: ${error}`,
      }),
  });

  return MetadataStore.of({
    upsert: Effect.fn("SqliteMetadataStore.upsert")(function* (
      env: string,
      key: string
    ) {
      yield* Effect.try({
        try: () => {
          db.run(
            `INSERT INTO secrets (env, key, type)
             VALUES (?, ?, 'string')
             ON CONFLICT(env, key) DO UPDATE SET
               updated_at = datetime('now')`,
            [env, key]
          );
          persist(db);
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
            "SELECT key, created_at, updated_at FROM secrets WHERE env = ? AND key = ?"
          );
          stmt.bind([env, key]);
          if (!stmt.step()) {
            stmt.free();
            return null;
          }
          const result = stmt.getAsObject() as {
            key: string;
            created_at: string;
            updated_at: string;
          };
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
          persist(db);
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
          }> = [];
          const stmt = db.prepare(
            "SELECT key, updated_at FROM secrets WHERE env = ? ORDER BY key"
          );
          stmt.bind([env]);
          while (stmt.step()) {
            results.push(
              stmt.getAsObject() as {
                key: string;
                updated_at: string;
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
            const row = stmt.getAsObject() as {
              env: string;
              count: number;
            };
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
            const row = stmt.getAsObject() as {
              env: string;
              count: number;
            };
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
            `INSERT INTO commands (name, command, context)
             VALUES (?, ?, ?)
             ON CONFLICT(name) DO UPDATE SET
               command = excluded.command,
               context = excluded.context`,
            [name, command, context]
          );
          persist(db);
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
      yield* Effect.try({
        try: () => {
          db.run("DELETE FROM commands WHERE name = ?", [name]);
          const rowsModified = db.getRowsModified();
          if (rowsModified === 0) {
            throw new CommandNotFoundError({
              name,
              message: `Command not found: "${name}"`,
            });
          }
          persist(db);
        },
        catch: (error) => {
          if (error instanceof CommandNotFoundError) {
            return error;
          }
          return new MetadataStoreError({
            operation: "removeCommand",
            message: `Failed to remove command "${name}": ${error}`,
          });
        },
      });
    }),
  });
});

export const SqliteMetadataStoreLive = Layer.effect(MetadataStore, make);
