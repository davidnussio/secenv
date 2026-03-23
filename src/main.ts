#!/usr/bin/env node
import { createRequire } from "node:module";
import { Command } from "@effect/cli";
import { NodeContext, NodeRuntime } from "@effect/platform-node";
import { Effect, Layer } from "effect";
import { allCommands } from "./cli/index.js";
import {
  DatabaseConfigDefault,
  DatabaseConfigFrom,
} from "./services/database-config.js";
import { SecretStore } from "./services/secret-store.js";

const require = createRequire(import.meta.url);
const pkg = require("../package.json") as { version: string };

const cli = Command.run(allCommands, {
  name: "envsec",
  version: pkg.version,
});

/**
 * Resolve custom database path from --db flag or ENVSEC_DB env var.
 * Pre-parsed from argv since the layer must be built before CLI parsing.
 */
const resolveCustomDbPath = (): string | undefined => {
  const dbIndex = process.argv.indexOf("--db");
  if (dbIndex !== -1 && dbIndex + 1 < process.argv.length) {
    return process.argv[dbIndex + 1];
  }
  const envDb = process.env.ENVSEC_DB;
  if (envDb && envDb.trim() !== "") {
    return envDb.trim();
  }
  return undefined;
};

const customDbPath = resolveCustomDbPath();
const dbLayer = customDbPath
  ? DatabaseConfigFrom(customDbPath)
  : DatabaseConfigDefault;

const secretStoreLayer = SecretStore.Default.pipe(Layer.provide(dbLayer));

cli(process.argv).pipe(
  Effect.provide(secretStoreLayer),
  Effect.provide(NodeContext.layer),
  NodeRuntime.runMain
);
