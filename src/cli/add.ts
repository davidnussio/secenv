import { Args, Command, Options } from "@effect/cli";
import { Console, Effect, Option } from "effect";
import { AbortedError, EmptyValueError } from "../errors.js";
import { SecretStore } from "../services/secret-store.js";
import { requireContext } from "./root.js";

const key = Args.text({ name: "key" });
const valueOption = Options.text("value").pipe(
  Options.withAlias("v"),
  Options.withDescription("Value to store (omit for interactive prompt)"),
  Options.optional
);

const isNewline = (ch: string): boolean => ch === "\r" || ch === "\n";
const isInterrupt = (ch: string): boolean => ch === "\u0003";
const isBackspace = (ch: string): boolean => ch === "\u007F" || ch === "\b";

const readSecret = (prompt: string): Effect.Effect<string, AbortedError> =>
  Effect.async((resume) => {
    process.stdout.write(prompt);

    const wasRaw = process.stdin.isRaw;

    if (process.stdin.isTTY) {
      process.stdin.setRawMode(true);
    }
    process.stdin.resume();
    process.stdin.setEncoding("utf-8");

    let input = "";

    const cleanup = () => {
      process.stdin.removeListener("data", onData);
      if (process.stdin.isTTY) {
        process.stdin.setRawMode(wasRaw);
      }
      process.stdin.pause();
    };

    const handleChar = (ch: string): boolean => {
      if (isNewline(ch)) {
        cleanup();
        process.stdout.write("\n");
        resume(Effect.succeed(input));
        return true;
      }
      if (isInterrupt(ch)) {
        cleanup();
        process.stdout.write("\n");
        resume(
          Effect.fail(new AbortedError({ message: "User aborted input" }))
        );
        return true;
      }
      if (isBackspace(ch) && input.length > 0) {
        input = input.slice(0, -1);
        process.stdout.write("\b \b");
      } else if (!isBackspace(ch)) {
        input += ch;
        process.stdout.write("*");
      }
      return false;
    };

    const onData = (chunk: string) => {
      for (const ch of chunk) {
        if (handleChar(ch)) {
          return;
        }
      }
    };

    process.stdin.on("data", onData);
  });

export const addCommand = Command.make(
  "add",
  { key, value: valueOption },
  ({ key, value }) =>
    Effect.gen(function* () {
      const ctx = yield* requireContext;

      const secret = Option.isSome(value)
        ? value.value
        : yield* readSecret("Enter secret value: ");

      if (secret.trim() === "") {
        return yield* new EmptyValueError({
          field: "secret",
          message: "Secret value cannot be empty",
        });
      }

      yield* SecretStore.set(ctx, key, secret);
      yield* Console.log(`✅ Secret "${key}" stored in context "${ctx}"`);
    })
);
