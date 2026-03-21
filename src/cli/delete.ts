import { Args, Command, Options } from "@effect/cli";
import { Console, Effect, Option } from "effect";
import { SecretStore } from "../services/secret-store.js";
import { requireContext } from "./root.js";

const key = Args.text({ name: "key" }).pipe(Args.optional);

const yes = Options.boolean("yes").pipe(
  Options.withAlias("y"),
  Options.withDescription("Skip confirmation prompt"),
  Options.withDefault(false)
);

const all = Options.boolean("all").pipe(
  Options.withDescription("Delete all secrets in the context"),
  Options.withDefault(false)
);

const readConfirmation = (message: string): Effect.Effect<boolean, Error> =>
  Effect.async((resume) => {
    process.stdout.write(`${message} [y/N] `);
    process.stdin.resume();
    process.stdin.setEncoding("utf-8");

    const onData = (chunk: string) => {
      process.stdin.removeListener("data", onData);
      process.stdin.pause();
      const answer = chunk.toString().trim().toLowerCase();
      resume(Effect.succeed(answer === "y" || answer === "yes"));
    };

    process.stdin.on("data", onData);
  });

const handler = ({
  key,
  yes,
  all,
}: {
  key: Option.Option<string>;
  yes: boolean;
  all: boolean;
}) =>
  Effect.gen(function* () {
    const ctx = yield* requireContext;

    if (all) {
      const keys = yield* SecretStore.list(ctx);

      if (keys.length === 0) {
        yield* Console.log(`No secrets found in context "${ctx}".`);
        return;
      }

      if (!yes) {
        const confirmed = yield* readConfirmation(
          `Delete all ${keys.length} secret(s) from context "${ctx}"?`
        );
        if (!confirmed) {
          yield* Console.log("Cancelled.");
          return;
        }
      }

      yield* SecretStore.beginBatch();
      yield* Effect.forEach(keys, (k) => SecretStore.remove(ctx, k.key), {
        concurrency: 1,
      });
      yield* SecretStore.endBatch();
      yield* Console.log(
        `🗑️  Removed ${keys.length} secret(s) from context "${ctx}"`
      );
      return;
    }

    if (Option.isNone(key)) {
      yield* Effect.fail(
        new Error("Provide a <key> argument or use --all to delete everything")
      );
      return;
    }

    const keyValue = key.value;

    if (!yes) {
      const confirmed = yield* readConfirmation(
        `Delete secret "${keyValue}" from context "${ctx}"?`
      );
      if (!confirmed) {
        yield* Console.log("Cancelled.");
        return;
      }
    }

    yield* SecretStore.remove(ctx, keyValue);
    yield* Console.log(`🗑️  Secret "${keyValue}" removed from context "${ctx}"`);
  });

export const deleteCommand = Command.make("delete", { key, yes, all }, handler);

export const delCommand = Command.make("del", { key, yes, all }, handler);
