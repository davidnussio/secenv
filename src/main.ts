#!/usr/bin/env node
import { Command } from "@effect/cli"
import { NodeContext, NodeRuntime } from "@effect/platform-node"
import { Effect } from "effect"
import { createRequire } from "node:module"
import { rootCommand } from "./cli/root.js"
import { addCommand } from "./cli/add.js"
import { getCommand } from "./cli/read.js"
import { deleteCommand, delCommand } from "./cli/delete.js"
import { searchCommand } from "./cli/search.js"
import { listCommand } from "./cli/list.js"
import { runCommand } from "./cli/run.js"
import { envFileCommand } from "./cli/env-file.js"
import { SecretStore } from "./services/SecretStore.js"

const require = createRequire(import.meta.url)
const pkg = require("../package.json") as { version: string }

const command = rootCommand.pipe(
  Command.withSubcommands([addCommand, getCommand, deleteCommand, delCommand, searchCommand, listCommand, runCommand, envFileCommand]),
)

const cli = Command.run(command, {
  name: "secenv",
  version: pkg.version,
})

cli(process.argv).pipe(
  Effect.provide(SecretStore.Default),
  Effect.provide(NodeContext.layer),
  NodeRuntime.runMain,
)
