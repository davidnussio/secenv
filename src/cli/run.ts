import { execSync } from "node:child_process";
import { Args, Command, Options } from "@effect/cli";
import { Console, Effect, Option } from "effect";
import { CommandExecutionError, EmptyValueError } from "../errors.js";
import { SecretStore } from "../services/secret-store.js";
import type { ResolvedCommand } from "./resolve-command.js";
import { resolveCommand } from "./resolve-command.js";
import { requireContext } from "./root.js";

const cmd = Args.text({ name: "command" }).pipe(
  Args.withDescription(
    "Command to execute. Use {key} placeholders for secret interpolation"
  )
);

const save = Options.boolean("save").pipe(
  Options.withAlias("s"),
  Options.withDescription("Save this command for later use"),
  Options.withDefault(false)
);

const name = Options.text("name").pipe(
  Options.withAlias("n"),
  Options.withDescription("Name for the saved command"),
  Options.optional
);

const readLine = (prompt: string): Effect.Effect<string> =>
  Effect.async((resume) => {
    process.stdout.write(prompt);
    process.stdin.resume();
    process.stdin.setEncoding("utf-8");

    const onData = (chunk: string) => {
      process.stdin.removeListener("data", onData);
      process.stdin.pause();
      resume(Effect.succeed(chunk.toString().trim()));
    };

    process.stdin.on("data", onData);
  });

const executeCommand = (
  resolved: ResolvedCommand
): Effect.Effect<void, CommandExecutionError> =>
  Effect.try({
    try: () => {
      execSync(resolved.command, {
        stdio: "inherit",
        shell: process.platform === "win32" ? "cmd.exe" : "/bin/sh",
        env: { ...process.env, ...resolved.env },
      });
    },
    catch: (e) => {
      const status =
        e instanceof Error && "status" in e
          ? (e as { status: number }).status
          : 1;
      return new CommandExecutionError({
        command: resolved.command,
        exitCode: status,
        message: `Command exited with code ${status}`,
      });
    },
  });

export const runCommand = Command.make(
  "run",
  { cmd, save, name },
  ({ cmd, save, name }) =>
    Effect.gen(function* () {
      const ctx = yield* requireContext;

      if (save) {
        const cmdName = Option.isSome(name)
          ? name.value
          : yield* readLine("Command name: ");

        if (cmdName.trim() === "") {
          return yield* new EmptyValueError({
            field: "name",
            message: "Command name cannot be empty when using --save",
          });
        }

        yield* SecretStore.saveCommand(cmdName, cmd, ctx);
        yield* Console.log(`💾 Command "${cmdName}" saved`);
      }

      const resolved = yield* resolveCommand(cmd, ctx);
      yield* executeCommand(resolved);
    })
);
