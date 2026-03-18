#!/usr/bin/env node
import { createRequire } from "node:module";
import { Command } from "@effect/cli";
import { NodeContext, NodeRuntime } from "@effect/platform-node";
import { Effect, Layer, Logger, LogLevel } from "effect";
import { addCommand } from "./cli/add.js";
import { cmdCommand } from "./cli/cmd.js";
import { delCommand, deleteCommand } from "./cli/delete.js";
import { envFileCommand } from "./cli/env-file.js";
import { getCommand } from "./cli/get.js";
import { listCommand } from "./cli/list.js";
import { loadCommand } from "./cli/load.js";
import { rootCommand } from "./cli/root.js";
import { runCommand } from "./cli/run.js";
import { searchCommand } from "./cli/search.js";
import { SecretStore } from "./services/secret-store.js";

const require = createRequire(import.meta.url);
const pkg = require("../package.json") as { version: string };

const command = rootCommand.pipe(
  Command.withSubcommands([
    addCommand,
    getCommand,
    deleteCommand,
    delCommand,
    searchCommand,
    listCommand,
    runCommand,
    envFileCommand,
    loadCommand,
    cmdCommand,
  ])
);

const cli = Command.run(command, {
  name: "envsec",
  version: pkg.version,
});

const debugFlag =
  process.argv.includes("-d") || process.argv.includes("--debug");

const logLayer = debugFlag
  ? Logger.minimumLogLevel(LogLevel.All)
  : Logger.minimumLogLevel(LogLevel.None);

cli(process.argv).pipe(
  Effect.provide(SecretStore.Default),
  Effect.provide(NodeContext.layer),
  Effect.provide(Layer.mergeAll(logLayer)),
  NodeRuntime.runMain
);
