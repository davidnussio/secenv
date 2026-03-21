import { execSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { Command, Options } from "@effect/cli";
import { Console, Effect, Option } from "effect";
import {
  FileAccessError,
  GPGEncryptionError,
  type SecretNotFoundError,
} from "../errors.js";
import { SecretStore } from "../services/secret-store.js";
import { isJsonOutput, requireContext } from "./root.js";

const encryptTo = Options.text("encrypt-to").pipe(
  Options.withDescription(
    "GPG recipient key (email, key ID, or fingerprint) to encrypt for"
  )
);

const output = Options.text("output").pipe(
  Options.withAlias("o"),
  Options.withDescription(
    "Output file path (default: stdout). Use - for stdout explicitly"
  ),
  Options.optional
);

const gpgEncrypt = (
  plaintext: string,
  recipient: string
): Effect.Effect<string, GPGEncryptionError> =>
  Effect.try({
    try: () =>
      execSync(
        `gpg --batch --yes --trust-model always --encrypt --armor --recipient ${JSON.stringify(recipient)}`,
        { input: plaintext, encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] }
      ),
    catch: (e) =>
      new GPGEncryptionError({
        recipient,
        message: `GPG encryption failed: ${e instanceof Error ? e.message : String(e)}`,
      }),
  });

export const shareCommand = Command.make(
  "share",
  { encryptTo, output },
  ({ encryptTo, output }) =>
    Effect.gen(function* () {
      const ctx = yield* requireContext;
      const jsonOutput = yield* isJsonOutput;
      const secrets = yield* SecretStore.list(ctx);

      if (secrets.length === 0) {
        yield* Console.error(`📭 No secrets found for context "${ctx}"`);
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
      const entries: Array<{ key: string; value: string }> = [];
      for (const result of results) {
        if (!result.found) {
          skipped.push(result.key);
          continue;
        }
        entries.push({ key: result.key, value: result.value });
      }

      if (skipped.length > 0) {
        yield* Console.error(
          `⚠️  Skipped ${skipped.length} secret(s) no longer in keychain: ${skipped.join(", ")}`
        );
      }

      const plaintext = jsonOutput
        ? JSON.stringify({ context: ctx, secrets: entries }, null, 2)
        : entries
            .map((e) => {
              const envKey = e.key.toUpperCase().replaceAll(".", "_");
              const escaped = e.value
                .replaceAll("\\", "\\\\")
                .replaceAll('"', '\\"')
                .replaceAll("\n", "\\n");
              return `${envKey}="${escaped}"`;
            })
            .join("\n");

      const encrypted = yield* gpgEncrypt(plaintext, encryptTo);

      if (Option.isSome(output) && output.value !== "-") {
        yield* Effect.try({
          try: () => writeFileSync(output.value, encrypted, "utf-8"),
          catch: (error) =>
            new FileAccessError({
              path: output.value,
              message: `Failed to write share file: ${error}`,
            }),
        });
        yield* Console.error(
          `🔒 Encrypted ${entries.length} secret(s) from "${ctx}" for ${encryptTo} → ${output.value}`
        );
      } else {
        yield* Console.log(encrypted);
      }
    })
);
