#!/usr/bin/env node
import { Command } from "@effect/cli"
import { NodeContext, NodeRuntime } from "@effect/platform-node"
import { Effect } from "effect"
import { createRequire } from "node:module"
import { rootCommand } from "./cli/root.js"
import { addCommand } from "./cli/add.js"
import { readCommand } from "./cli/read.js"
import { searchCommand } from "./cli/search.js"
import { listCommand } from "./cli/list.js"
import { SecretStore } from "./services/SecretStore.js"

const require = createRequire(import.meta.url)
const pkg = require("../package.json") as { version: string }

const command = rootCommand.pipe(
  Command.withSubcommands([addCommand, readCommand, searchCommand, listCommand]),
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
