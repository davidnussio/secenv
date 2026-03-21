import { Args, Command } from "@effect/cli";
import { Console, Effect } from "effect";
import { formatTimeDistance } from "../domain/duration.js";
import { SecretStore } from "../services/secret-store.js";
import { isJsonOutput, requireContext } from "./root.js";

const key = Args.text({ name: "key" });

export const getCommand = Command.make("get", { key }, ({ key }) =>
  Effect.gen(function* () {
    const ctx = yield* requireContext;
    const jsonMode = yield* isJsonOutput;

    const meta = yield* SecretStore.getMetadata(ctx, key);
    const value = yield* SecretStore.get(ctx, key);

    if (jsonMode) {
      yield* Console.log(
        JSON.stringify({
          context: ctx,
          key,
          value,
          expires_at: meta.expires_at ?? null,
        })
      );
    } else {
      yield* Console.log(value);

      if (meta.expires_at) {
        const expiresMs = new Date(`${meta.expires_at}Z`).getTime();
        const now = Date.now();
        if (expiresMs <= now) {
          yield* Console.error(
            `⚠️  Warning: this secret expired ${formatTimeDistance(meta.expires_at)}`
          );
        } else {
          const oneDayMs = 24 * 60 * 60 * 1000;
          if (expiresMs - now < oneDayMs) {
            yield* Console.error(
              `⏳ Heads up: this secret expires ${formatTimeDistance(meta.expires_at)}`
            );
          }
        }
      }
    }
  })
);
