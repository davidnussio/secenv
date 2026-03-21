import { Args, Command, Options } from "@effect/cli";
import { Console, Effect } from "effect";
import { SecretStore } from "../services/secret-store.js";
import { requireContext } from "./root.js";

const key = Args.text({ name: "key" });

const yes = Options.boolean("yes").pipe(
  Options.withAlias("y"),
  Options.withDescription("Skip confirmation prompt"),
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

const handler = ({ key, yes }: { key: string; yes: boolean }) =>
  Effect.gen(function* () {
    const ctx = yield* requireContext;

    if (!yes) {
      const confirmed = yield* readConfirmation(
        `Delete secret "${key}" from context "${ctx}"?`
      );
      if (!confirmed) {
        yield* Console.log("Cancelled.");
        return;
      }
    }

    yield* SecretStore.remove(ctx, key);
    yield* Console.log(`🗑️  Secret "${key}" removed from context "${ctx}"`);
  });

export const deleteCommand = Command.make("delete", { key, yes }, handler);

export const delCommand = Command.make("del", { key, yes }, handler);
