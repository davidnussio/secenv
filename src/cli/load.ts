import { readFileSync } from "node:fs";
import { Command, Options } from "@effect/cli";
import { Console, Effect } from "effect";
import { FileAccessError } from "../errors.js";
import { SecretStore } from "../services/secret-store.js";
import { requireContext } from "./root.js";

const input = Options.text("input").pipe(
  Options.withAlias("i"),
  Options.withDescription("Input .env file path (default: .env)"),
  Options.withDefault(".env")
);

const force = Options.boolean("force").pipe(
  Options.withAlias("f"),
  Options.withDescription("Overwrite existing secrets without prompting")
);

const batch = Options.boolean("batch").pipe(
  Options.withAlias("b"),
  Options.withDescription(
    "Batch mode: defer database persistence until all secrets are imported"
  ),
  Options.withDefault(false)
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
  { input, force, batch },
  ({ input, force, batch }) =>
    Effect.gen(function* () {
      const ctx = yield* requireContext;

      const content = yield* Effect.try({
        try: () => readFileSync(input, "utf-8"),
        catch: () =>
          new FileAccessError({
            path: input,
            message: `Cannot read file: ${input}`,
          }),
      });

      const lines = content.split("\n");
      let added = 0;
      let skipped = 0;
      let overwritten = 0;

      const existingSecrets = yield* SecretStore.list(ctx);
      const existingKeys = new Set(existingSecrets.map((item) => item.key));

      if (batch) {
        yield* SecretStore.beginBatch();
      }

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

      if (batch) {
        yield* SecretStore.endBatch();
      }

      yield* Console.log(
        `✅ Done: ${added} added, ${overwritten} overwritten, ${skipped} skipped`
      );
    })
);
