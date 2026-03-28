import { Args, Command, Options } from "@effect/cli";
import { Console, Effect } from "effect";
import { SecretStore } from "../services/secret-store.js";
import { bold, icons } from "../ui.js";
import { isJsonOutput, requireContext } from "./root.js";

const oldKey = Args.text({ name: "old-key" });
const newKey = Args.text({ name: "new-key" });

const force = Options.boolean("force").pipe(
  Options.withAlias("f"),
  Options.withDescription("Overwrite target if it already exists"),
  Options.withDefault(false)
);

export const renameCommand = Command.make(
  "rename",
  { oldKey, newKey, force },
  ({ oldKey, newKey, force }) =>
    Effect.gen(function* () {
      const ctx = yield* requireContext;
      const jsonMode = yield* isJsonOutput;

      if (oldKey === newKey) {
        yield* Effect.fail(
          new Error("Source and target keys are the same — nothing to rename")
        );
        return;
      }

      const value = yield* SecretStore.get(ctx, oldKey);
      const meta = yield* SecretStore.getMetadata(ctx, oldKey);

      if (!force) {
        yield* SecretStore.getMetadata(ctx, newKey).pipe(
          Effect.flatMap(() =>
            Effect.fail(
              new Error(
                `Secret "${newKey}" already exists in context "${ctx}". Use --force to overwrite.`
              )
            )
          ),
          Effect.catchTag("SecretNotFoundError", () => Effect.void)
        );
      }

      yield* SecretStore.beginBatch();
      yield* SecretStore.set(ctx, newKey, value, meta.expires_at);
      yield* SecretStore.remove(ctx, oldKey);
      yield* SecretStore.endBatch();

      if (jsonMode) {
        yield* Console.log(
          JSON.stringify({
            action: "rename",
            context: ctx,
            from: oldKey,
            to: newKey,
          })
        );
      } else {
        yield* Console.log(
          `${icons.success} Renamed ${bold(`"${oldKey}"`)} ${icons.arrow} ${bold(`"${newKey}"`)} in context ${bold(`"${ctx}"`)}`
        );
      }
    })
);
