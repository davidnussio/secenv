import { Console, Effect } from "effect";
import {
  type InvalidKeyError,
  type KeychainError,
  type MetadataStoreError,
  MissingSecretsError,
  type SecretNotFoundError,
} from "../errors.js";
import { SecretStore } from "../services/secret-store.js";

const placeholderPattern = /\{([^}]+)\}/g;

export interface ResolvedCommand {
  readonly command: string;
  readonly env: Record<string, string>;
}

const toEnvVarName = (key: string, index: number): string =>
  `ENVSEC_${index}_${key.replace(/[^a-zA-Z0-9]/g, "_").toUpperCase()}`;

export const resolveCommand = (
  cmd: string,
  ctx: string
): Effect.Effect<
  ResolvedCommand,
  KeychainError | MetadataStoreError | InvalidKeyError | MissingSecretsError,
  SecretStore
> =>
  Effect.gen(function* () {
    const placeholders = [...cmd.matchAll(placeholderPattern)];

    if (placeholders.length === 0) {
      return { command: cmd, env: {} };
    }

    const missing: string[] = [];
    let resolved = cmd;
    const env: Record<string, string> = {};

    for (const [index, match] of placeholders.entries()) {
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
        const envVar = toEnvVarName(key, index);
        env[envVar] = result.value;
        const shellRef =
          process.platform === "win32" ? `%${envVar}%` : `$${envVar}`;
        resolved = resolved.replaceAll(`{${key}}`, shellRef);
      } else {
        missing.push(result.key);
      }
    }

    if (missing.length > 0) {
      const keys = missing.map((k) => `  - ${k}`).join("\n");
      const message = `Missing secrets in context "${ctx}":\n${keys}\n\nAdd them with: envsec -c ${ctx} add <key>`;
      yield* Console.error(`❌ ${message}`);
      return yield* new MissingSecretsError({
        keys: missing,
        context: ctx,
        message,
      });
    }

    yield* Console.log(`🔑 Resolved ${placeholders.length} secret(s)`);
    return { command: resolved, env };
  });
