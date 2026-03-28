import { Args, Command, Options } from "@effect/cli";
import { Console, Effect, Option } from "effect";
import type { MetadataStoreError } from "../errors.js";
import { SecretStore } from "../services/secret-store.js";
import { badge, bold, icons } from "../ui.js";
import { isJsonOutput, requireContext } from "./root.js";

const pattern = Args.text({ name: "pattern" }).pipe(Args.optional);

const to = Options.text("to").pipe(
  Options.withAlias("t"),
  Options.withDescription("Target context to copy secrets to")
);

const all = Options.boolean("all").pipe(
  Options.withDescription("Copy all secrets from source context"),
  Options.withDefault(false)
);

const force = Options.boolean("force").pipe(
  Options.withAlias("f"),
  Options.withDescription("Overwrite target secrets if they already exist"),
  Options.withDefault(false)
);

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

/** Convert a glob pattern (with * and ?) to a RegExp */
const globToRegex = (pat: string): RegExp => {
  const escaped = pat.replace(/[.+^${}()|[\]\\]/g, "\\$&");
  const withWildcards = escaped.replace(/\*/g, ".*").replace(/\?/g, ".");
  return new RegExp(`^${withWildcards}$`);
};

/** Resolve which keys to operate on based on --all flag or glob pattern */
const resolveKeys = (
  sourceCtx: string,
  pat: Option.Option<string>,
  useAll: boolean
): Effect.Effect<string[], MetadataStoreError | Error, SecretStore> =>
  Effect.gen(function* () {
    if (useAll) {
      const items = yield* SecretStore.list(sourceCtx);
      return items.map((i) => i.key);
    }
    if (Option.isNone(pat)) {
      return yield* Effect.fail(
        new Error(
          "Provide a <pattern> argument or use --all to copy everything"
        )
      );
    }
    const p = pat.value;
    if (p.includes("*") || p.includes("?")) {
      const items = yield* SecretStore.list(sourceCtx);
      const regex = globToRegex(p);
      return items.filter((i) => regex.test(i.key)).map((i) => i.key);
    }
    return [p];
  });

/** Check for conflicts in target context */
const checkConflicts = (
  targetCtx: string,
  keys: string[]
): Effect.Effect<void, Error, SecretStore> =>
  Effect.gen(function* () {
    const targetItems = yield* SecretStore.list(targetCtx).pipe(
      Effect.catchTag("MetadataStoreError", () => Effect.succeed([]))
    );
    const targetKeys = new Set(targetItems.map((i) => i.key));
    const conflicts = keys.filter((k) => targetKeys.has(k));
    if (conflicts.length > 0) {
      yield* Effect.fail(
        new Error(
          `Target context "${targetCtx}" already has: ${conflicts.join(", ")}. Use --force to overwrite.`
        )
      );
    }
  });

export const copyCommand = Command.make(
  "copy",
  { pattern, to, all, force, yes },
  ({ pattern, to, all, force, yes }) =>
    Effect.gen(function* () {
      const sourceCtx = yield* requireContext;
      const jsonMode = yield* isJsonOutput;

      if (sourceCtx === to) {
        return yield* Effect.fail(
          new Error(
            "Source and target contexts are the same. Use 'rename' to rename secrets within a context."
          )
        );
      }

      const keys = yield* resolveKeys(sourceCtx, pattern, all);

      if (keys.length === 0) {
        yield* Console.log(
          `${icons.empty} No secrets matched in context ${bold(`"${sourceCtx}"`)}.`
        );
        return;
      }

      if (keys.length > 1 && !yes) {
        const confirmed = yield* readConfirmation(
          `${icons.warning} Copy ${badge(keys.length, "secret")} from ${bold(`"${sourceCtx}"`)} to ${bold(`"${to}"`)}?`
        );
        if (!confirmed) {
          yield* Console.log(`${icons.cancel} Cancelled.`);
          return;
        }
      }

      if (!force) {
        yield* checkConflicts(to, keys);
      }

      yield* SecretStore.beginBatch();
      let copied = 0;
      for (const key of keys) {
        const value = yield* SecretStore.get(sourceCtx, key);
        const meta = yield* SecretStore.getMetadata(sourceCtx, key);
        yield* SecretStore.set(to, key, value, meta.expires_at);
        copied++;
      }
      yield* SecretStore.endBatch();

      if (jsonMode) {
        yield* Console.log(
          JSON.stringify({
            action: "copy",
            from: sourceCtx,
            to,
            keys,
            count: copied,
          })
        );
      } else {
        yield* Console.log(
          `${icons.success} Copied ${badge(copied, "secret")} from ${bold(`"${sourceCtx}"`)} ${icons.arrow} ${bold(`"${to}"`)}`
        );
      }
    })
);
