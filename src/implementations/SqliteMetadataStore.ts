import { Effect, Layer } from "effect"
import Database from "better-sqlite3"
import { mkdirSync } from "node:fs"
import { homedir } from "node:os"
import { join } from "node:path"
import { MetadataStore } from "../services/MetadataStore.js"
import { MetadataStoreError, SecretNotFoundError } from "../errors.js"

const dbPath = join(homedir(), ".secenv", "store.sqlite")

const initDb = () => {
  mkdirSync(join(homedir(), ".secenv"), { recursive: true })
  const db = new Database(dbPath)
  db.exec(`
    CREATE TABLE IF NOT EXISTS secrets (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      env        TEXT NOT NULL,
      key        TEXT NOT NULL,
      type       TEXT NOT NULL CHECK(type IN ('string', 'number', 'boolean')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(env, key)
    )
  `)
  return db
}

const make = Effect.gen(function* () {
  const db = yield* Effect.try({
    try: () => initDb(),
    catch: (error) =>
      new MetadataStoreError({
        operation: "init",
        message: `Failed to initialize database: ${error}`,
      }),
  })

  return MetadataStore.of({
    upsert: Effect.fn("SqliteMetadataStore.upsert")(function* (
      env: string,
      key: string,
      type: string,
    ) {
      yield* Effect.try({
        try: () => {
          db.prepare(
            `INSERT INTO secrets (env, key, type)
             VALUES (?, ?, ?)
             ON CONFLICT(env, key) DO UPDATE SET
               type = excluded.type,
               updated_at = datetime('now')`,
          ).run(env, key, type)
        },
        catch: (error) =>
          new MetadataStoreError({
            operation: "upsert",
            message: `Failed to upsert metadata for ${env}/${key}: ${error}`,
          }),
      })
    }),

    get: Effect.fn("SqliteMetadataStore.get")(function* (
      env: string,
      key: string,
    ) {
      const row = yield* Effect.try({
        try: () =>
          db
            .prepare(
              `SELECT key, type, created_at, updated_at FROM secrets WHERE env = ? AND key = ?`,
            )
            .get(env, key) as
            | { key: string; type: string; created_at: string; updated_at: string }
            | null,
        catch: (error) =>
          new MetadataStoreError({
            operation: "get",
            message: `Failed to get metadata for ${env}/${key}: ${error}`,
          }),
      })

      if (!row) {
        return yield* new SecretNotFoundError({
          key,
          env,
          message: `Secret metadata not found: ${env}/${key}`,
        })
      }

      return row
    }),

    remove: Effect.fn("SqliteMetadataStore.remove")(function* (
      env: string,
      key: string,
    ) {
      yield* Effect.try({
        try: () => {
          db.prepare(`DELETE FROM secrets WHERE env = ? AND key = ?`).run(env, key)
        },
        catch: (error) =>
          new MetadataStoreError({
            operation: "remove",
            message: `Failed to remove metadata for ${env}/${key}: ${error}`,
          }),
      })
    }),

    search: Effect.fn("SqliteMetadataStore.search")(function* (
      env: string,
      pattern: string,
    ) {
      return yield* Effect.try({
        try: () =>
          db
            .prepare(
              `SELECT key, type FROM secrets WHERE env = ? AND key GLOB ?`,
            )
            .all(env, pattern) as Array<{ key: string; type: string }>,
        catch: (error) =>
          new MetadataStoreError({
            operation: "search",
            message: `Failed to search metadata for ${env}/${pattern}: ${error}`,
          }),
      })
    }),

    list: Effect.fn("SqliteMetadataStore.list")(function* (env: string) {
      return yield* Effect.try({
        try: () =>
          db
            .prepare(
              `SELECT key, type, updated_at FROM secrets WHERE env = ? ORDER BY key`,
            )
            .all(env) as Array<{
            key: string
            type: string
            updated_at: string
          }>,
        catch: (error) =>
          new MetadataStoreError({
            operation: "list",
            message: `Failed to list metadata for ${env}: ${error}`,
          }),
      })
    }),
  })
})

export const SqliteMetadataStoreLive = Layer.effect(MetadataStore, make)
