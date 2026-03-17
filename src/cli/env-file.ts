import { Command, Options } from "@effect/cli"
import { Effect } from "effect"
import { SecretStore } from "../services/SecretStore.js"
import { rootCommand } from "./root.js"
import { writeFileSync } from "node:fs"

const output = Options.text("output").pipe(
  Options.withAlias("o"),
  Options.withDescription("Output file path (default: .env)"),
  Options.withDefault(".env"),
)

export const envFileCommand = Command.make(
  "env-file",
  { output },
  ({ output }) =>
    Effect.gen(function* () {
      const { env } = yield* rootCommand
      const secrets = yield* SecretStore.list(env)

      if (secrets.length === 0) {
        yield* Effect.log(`No secrets found for env "${env}"`)
        return
      }

      const lines: Array<string> = []
      for (const item of secrets) {
        const value = yield* SecretStore.get(env, item.key)
        const envKey = item.key.toUpperCase().replaceAll(".", "_")
        lines.push(`${envKey}=${String(value)}`)
      }

      writeFileSync(output, lines.join("\n") + "\n", "utf-8")
      yield* Effect.log(`Written ${secrets.length} secret(s) to ${output}`)
    }),
)
