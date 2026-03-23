import { Command, Options } from "@effect/cli";
import { Console, Effect } from "effect";
import type { SecretNotFoundError } from "../errors.js";
import { SecretStore } from "../services/secret-store.js";
import { requireContext } from "./root.js";

type Shell = "bash" | "zsh" | "fish" | "powershell";

const shell = Options.choice("shell", [
  "bash",
  "zsh",
  "fish",
  "powershell",
]).pipe(
  Options.withAlias("s"),
  Options.withDescription("Target shell syntax (default: bash)"),
  Options.withDefault("bash" as Shell)
);

const unset = Options.boolean("unset").pipe(
  Options.withAlias("u"),
  Options.withDescription("Output unset/remove commands instead of export"),
  Options.withDefault(false)
);

const toEnvKey = (key: string): string =>
  key.toUpperCase().replaceAll(".", "_");

const formatExport = (key: string, value: string, sh: Shell): string => {
  switch (sh) {
    case "fish": {
      const escaped = value.replaceAll("\\", "\\\\").replaceAll("'", "\\'");
      return `set -gx ${key} '${escaped}'`;
    }
    case "powershell": {
      const escaped = value.replaceAll("'", "''");
      return `$env:${key} = '${escaped}'`;
    }
    default: {
      const escaped = value.replaceAll("\\", "\\\\").replaceAll("'", "'\\''");
      return `export ${key}='${escaped}'`;
    }
  }
};

const formatUnset = (key: string, sh: Shell): string => {
  switch (sh) {
    case "fish":
      return `set -e ${key}`;
    case "powershell":
      return `Remove-Item Env:\\${key}`;
    default:
      return `unset ${key}`;
  }
};

export const envCommand = Command.make(
  "env",
  { shell, unset },
  ({ shell, unset }) =>
    Effect.gen(function* () {
      const ctx = yield* requireContext;
      const secrets = yield* SecretStore.list(ctx);

      if (secrets.length === 0) {
        yield* Console.error(`📭 No secrets found for context "${ctx}"`);
        return;
      }

      if (unset) {
        for (const item of secrets) {
          const envKey = toEnvKey(item.key);
          yield* Console.log(formatUnset(envKey, shell));
        }
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

      const skipped: string[] = [];
      for (const result of results) {
        if (!result.found) {
          skipped.push(result.key);
          continue;
        }
        const envKey = toEnvKey(result.key);
        yield* Console.log(formatExport(envKey, result.value, shell));
      }

      if (skipped.length > 0) {
        yield* Console.error(
          `⚠️  Skipped ${skipped.length} secret(s) no longer in keychain: ${skipped.join(", ")}`
        );
      }
    })
);
