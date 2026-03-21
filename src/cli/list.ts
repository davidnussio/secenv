import { Command } from "@effect/cli";
import { Console, Effect, Option } from "effect";
import { formatTimeDistance } from "../domain/duration.js";
import { SecretStore } from "../services/secret-store.js";
import { isJsonOutput, optionalContext } from "./root.js";

const formatSecretLine = (
  item: { key: string; updated_at: string; expires_at: string | null },
  now: number
): string => {
  let suffix = `updated: ${item.updated_at}`;
  if (item.expires_at) {
    const expiresMs = new Date(`${item.expires_at}Z`).getTime();
    const expired = expiresMs <= now;
    const distance = formatTimeDistance(item.expires_at);
    suffix += expired
      ? `  \u274C expired ${distance}`
      : `  \u23F3 expires ${distance}`;
  }
  return `\uD83D\uDD10 ${item.key}  ${suffix}`;
};

const listContexts = (jsonMode: boolean) =>
  Effect.gen(function* () {
    const contexts = yield* SecretStore.listContexts();
    if (jsonMode) {
      yield* Console.log(JSON.stringify(contexts));
      return;
    }
    if (contexts.length === 0) {
      yield* Console.log("\uD83D\uDCED No contexts found.");
      return;
    }
    for (const item of contexts) {
      yield* Console.log(
        `\uD83D\uDCE6 ${item.context}  (${item.count} secrets)`
      );
    }
  });

const listSecrets = (ctx: string, jsonMode: boolean) =>
  Effect.gen(function* () {
    const results = yield* SecretStore.list(ctx);
    if (jsonMode) {
      yield* Console.log(JSON.stringify(results));
      return;
    }
    if (results.length === 0) {
      yield* Console.log("\uD83D\uDCED No secrets found.");
      return;
    }
    const now = Date.now();
    for (const item of results) {
      yield* Console.log(formatSecretLine(item, now));
    }
    yield* Console.log(
      `\n\uD83D\uDCCA ${results.length} secret${results.length === 1 ? "" : "s"} in ${ctx}`
    );
  });

export const listCommand = Command.make("list", {}, () =>
  Effect.gen(function* () {
    const context = yield* optionalContext;
    const jsonMode = yield* isJsonOutput;

    if (Option.isNone(context)) {
      yield* listContexts(jsonMode);
      return;
    }
    yield* listSecrets(context.value, jsonMode);
  })
);
