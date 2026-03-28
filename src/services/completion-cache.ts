import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { Effect } from "effect";
import { SecretStore } from "./secret-store.js";

const FILE_PERMISSIONS = 0o600;
const DIR_PERMISSIONS = 0o700;

/**
 * Rebuild the completion cache from the current SecretStore state.
 * Called after mutating operations (add, delete, load, cmd save, etc.)
 * and after slow-path completion queries.
 */
export const refreshCache = (
  cachePath: string
): Effect.Effect<void, never, SecretStore> =>
  Effect.gen(function* () {
    const contexts = yield* SecretStore.listContexts();
    const contextNames = contexts.map((c) => c.context);

    const keys: Record<string, string[]> = {};
    for (const ctx of contextNames) {
      const secrets = yield* SecretStore.list(ctx);
      keys[ctx] = secrets.map((s) => s.key);
    }

    const cmds = yield* SecretStore.listCommands();
    const commandNames = cmds.map((c) => c.name);

    const data = {
      commands: commandNames,
      contexts: contextNames,
      keys,
      updatedAt: Date.now(),
    };

    const dir = dirname(cachePath);
    mkdirSync(dir, { recursive: true, mode: DIR_PERMISSIONS });
    writeFileSync(cachePath, JSON.stringify(data), { mode: FILE_PERMISSIONS });
  }).pipe(Effect.catchAll(() => Effect.void));
