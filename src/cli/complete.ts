import { Console, Effect } from "effect";
import { SecretStore } from "../services/secret-store.js";

/**
 * Handle `__complete <type> [arg]` — hidden completion helper.
 * Called by shell completion scripts to fetch dynamic values.
 * Silently succeeds with no output on any error.
 */
export const handleComplete = (
  type: string,
  arg?: string
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
  }).pipe(Effect.catchAll(() => Effect.void));
