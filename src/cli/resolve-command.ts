import { Console, Effect } from "effect";
import type { SecretNotFoundError } from "../errors.js";
import { SecretStore } from "../services/secret-store.js";

const placeholderPattern = /\{([^}]+)\}/g;

export const resolveCommand = (
  cmd: string,
  ctx: string
): Effect.Effect<string, Error, SecretStore> =>
  Effect.gen(function* () {
    const placeholders = [...cmd.matchAll(placeholderPattern)];

    if (placeholders.length === 0) {
      return cmd;
    }

    const missing: string[] = [];
    let resolved = cmd;

    for (const match of placeholders) {
      const key = match[1];
      if (key === undefined) {
        continue;
      }

      const result = yield* SecretStore.get(ctx, key).pipe(
        Effect.map((value) => ({ found: true as const, value: String(value) })),
        Effect.catchTag("SecretNotFoundError", (e: SecretNotFoundError) =>
          Effect.succeed({ found: false as const, key: e.key })
        )
      );

      if (result.found) {
        resolved = resolved.replaceAll(`{${key}}`, result.value);
      } else {
        missing.push(result.key);
      }
    }

    if (missing.length > 0) {
      const keys = missing.map((k) => `  - ${k}`).join("\n");
      const message = `Missing secrets in context "${ctx}":\n${keys}\n\nAdd them with: envsec -c ${ctx} add <key>`;
      yield* Console.error(`❌ ${message}`);
      return yield* Effect.fail(new Error(message));
    }

    yield* Console.log(`🔑 Resolved ${placeholders.length} secret(s)`);
    return resolved;
  });
