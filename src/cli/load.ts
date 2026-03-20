import { readFileSync } from "node:fs";
import { Command, Options } from "@effect/cli";
import { Console, Effect, Option } from "effect";
import { SecretStore } from "../services/secret-store.js";
import { rootCommand } from "./root.js";

const input = Options.text("input").pipe(
  Options.withAlias("i"),
  Options.withDescription("Input .env file path (default: .env)"),
  Options.withDefault(".env")
);

const force = Options.boolean("force").pipe(
  Options.withAlias("f"),
  Options.withDescription("Overwrite existing secrets without prompting")
);

const parseLine = (line: string): { key: string; value: string } | null => {
  const trimmed = line.trim();
  if (trimmed === "" || trimmed.startsWith("#")) {
    return null;
  }
  const eqIndex = trimmed.indexOf("=");
  if (eqIndex === -1) {
    return null;
  }
  const key = trimmed.slice(0, eqIndex).trim();
  const value = trimmed
    .slice(eqIndex + 1)
    .trim()
    .replace(/^["']|["']$/g, "");
  return { key, value };
};

export const loadCommand = Command.make(
  "load",
  { input, force },
  ({ input, force }) =>
    Effect.gen(function* () {
      const { context } = yield* rootCommand;

      if (Option.isNone(context)) {
        return yield* Effect.fail(
          new Error("Missing required option --context (-c)")
        );
      }
      const ctx = context.value;

      const content = yield* Effect.try({
        try: () => readFileSync(input, "utf-8"),
        catch: () => new Error(`Cannot read file: ${input}`),
      });

      const lines = content.split("\n");
      let added = 0;
      let skipped = 0;
      let overwritten = 0;

      const existingSecrets = yield* SecretStore.list(ctx);
      const existingKeys = new Set(existingSecrets.map((item) => item.key));

      for (const line of lines) {
        const parsed = parseLine(line);
        if (!parsed) {
          continue;
        }

        const secretKey = parsed.key.toLowerCase().replaceAll("_", ".");

        const exists = existingKeys.has(secretKey);

        if (exists && !force) {
          yield* Console.log(
            `⚠️  Skipped "${secretKey}": already exists (use --force to overwrite)`
          );
          skipped++;
          continue;
        }

        if (exists) {
          overwritten++;
        } else {
          added++;
        }

        yield* SecretStore.set(ctx, secretKey, parsed.value);
        existingKeys.add(secretKey);
      }

      yield* Console.log(
        `✅ Done: ${added} added, ${overwritten} overwritten, ${skipped} skipped`
      );
    })
);
