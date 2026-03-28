import { Console, Effect } from "effect";
import { refreshCache } from "../services/completion-cache.js";
import { SecretStore } from "../services/secret-store.js";

/**
 * Handle `__complete <type> [arg]` — slow path.
 * Called when the cache is missing, stale, or doesn't have the requested data.
 * Queries SecretStore directly and rebuilds the cache.
 */
export const handleComplete = (
  type: string,
  arg: string | undefined,
  cachePath: string
): Effect.Effect<void, never, SecretStore> =>
  Effect.gen(function* () {
    switch (type) {
      case "contexts": {
        const contexts = yield* SecretStore.listContexts();
        for (const c of contexts) {
          yield* Console.log(c.context);
        }
        break;
      }
      case "keys": {
        if (!arg) {
          break;
        }
        const secrets = yield* SecretStore.list(arg);
        for (const s of secrets) {
          yield* Console.log(s.key);
        }
        break;
      }
      case "commands": {
        const cmds = yield* SecretStore.listCommands();
        for (const c of cmds) {
          yield* Console.log(c.name);
        }
        break;
      }
      default:
        break;
    }

    // Rebuild cache after slow path query
    yield* refreshCache(cachePath);
  }).pipe(Effect.catchAll(() => Effect.void));
