import { writeFileSync } from "node:fs";
import { Command, Options } from "@effect/cli";
import { Console, Effect } from "effect";
import { FileAccessError, type SecretNotFoundError } from "../errors.js";
import { SecretStore } from "../services/secret-store.js";
import { requireContext } from "./root.js";

const output = Options.text("output").pipe(
  Options.withAlias("o"),
  Options.withDescription("Output file path (default: .env)"),
  Options.withDefault(".env")
);

export const envFileCommand = Command.make(
  "env-file",
  { output },
  ({ output }) =>
    Effect.gen(function* () {
      const ctx = yield* requireContext;

      const secrets = yield* SecretStore.list(ctx);

      if (secrets.length === 0) {
        yield* Console.log(`📭 No secrets found for context "${ctx}"`);
        return;
      }

      const results = yield* Effect.forEach(
        secrets,
        (item) =>
          SecretStore.get(ctx, item.key).pipe(
            Effect.map((value) => ({
              key: item.key,
              found: true as const,
              value: String(value),
            })),
            Effect.catchTag("SecretNotFoundError", (_: SecretNotFoundError) =>
              Effect.succeed({
                key: item.key,
                found: false as const,
                value: "",
              })
            )
          ),
        { concurrency: 10 }
      );

      const lines: string[] = [];
      const skipped: string[] = [];
      for (const result of results) {
        if (!result.found) {
          skipped.push(result.key);
          continue;
        }
        const envKey = result.key.toUpperCase().replaceAll(".", "_");
        const escaped = result.value
          .replaceAll("\\", "\\\\")
          .replaceAll('"', '\\"')
          .replaceAll("\n", "\\n");
        lines.push(`${envKey}="${escaped}"`);
      }

      if (skipped.length > 0) {
        yield* Console.log(
          `⚠️  Skipped ${skipped.length} secret(s) no longer in keychain: ${skipped.join(", ")}`
        );
      }

      yield* Effect.try({
        try: () => writeFileSync(output, `${lines.join("\n")}\n`, "utf-8"),
        catch: (error) =>
          new FileAccessError({
            path: output,
            message: `Failed to write env file: ${error}`,
          }),
      });
      yield* Console.log(`📝 Written ${lines.length} secret(s) to ${output}`);
    })
);
