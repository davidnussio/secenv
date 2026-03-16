#!/usr/bin/env bun
import { Command } from "@effect/cli"
import { BunContext, BunRuntime } from "@effect/platform-bun"
import { Effect } from "effect"
import pkg from "../package.json"
import { rootCommand } from "./cli/root.js"
import { addCommand } from "./cli/add.js"
import { readCommand } from "./cli/read.js"
import { searchCommand } from "./cli/search.js"
import { listCommand } from "./cli/list.js"
import { SecretStore } from "./services/SecretStore.js"

const command = rootCommand.pipe(
  Command.withSubcommands([addCommand, readCommand, searchCommand, listCommand]),
)

const cli = Command.run(command, {
  name: "secenv",
  version: pkg.version,
})

cli(process.argv).pipe(
  Effect.provide(SecretStore.Default),
  Effect.provide(BunContext.layer),
  BunRuntime.runMain,
)
