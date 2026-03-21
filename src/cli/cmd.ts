import { execSync } from "node:child_process";
import { Args, Command, Options } from "@effect/cli";
import { Console, Effect, Option, Schema } from "effect";
import { ContextName } from "../domain/context-name.js";
import { CommandExecutionError } from "../errors.js";
import { SecretStore } from "../services/secret-store.js";
import { resolveCommand } from "./resolve-command.js";

// --- cmd run <name> ---

const cmdRunName = Args.text({ name: "name" }).pipe(
  Args.withDescription("Name of the saved command to execute")
);

const cmdRunContextOverride = Options.text("override-context").pipe(
  Options.withAlias("o"),
  Options.withDescription("Override the saved context"),
  Options.optional
);

const cmdRunCommand = Command.make(
  "run",
  { name: cmdRunName, context: cmdRunContextOverride },
  ({ name, context }) =>
    Effect.gen(function* () {
      const saved = yield* SecretStore.getCommand(name);
      const rawCtx = Option.isSome(context) ? context.value : saved.context;
      const ctx = yield* Schema.decode(ContextName)(rawCtx);

      const resolved = yield* resolveCommand(saved.command, ctx);

      yield* Effect.try({
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
    })
);

// --- cmd search <pattern> ---

const cmdSearchPattern = Args.text({ name: "pattern" }).pipe(
  Args.withDescription("Search pattern")
);

const cmdSearchName = Options.boolean("name").pipe(
  Options.withAlias("n"),
  Options.withDescription("Search only in command names"),
  Options.withDefault(false)
);

const cmdSearchCommand = Options.boolean("command").pipe(
  Options.withAlias("m"),
  Options.withDescription("Search only in command strings"),
  Options.withDefault(false)
);

const cmdSearchCommandDef = Command.make(
  "search",
  {
    pattern: cmdSearchPattern,
    nameOnly: cmdSearchName,
    commandOnly: cmdSearchCommand,
  },
  ({ pattern, nameOnly, commandOnly }) =>
    Effect.gen(function* () {
      let field: "name" | "command" | "all";
      if (nameOnly) {
        field = "name";
      } else if (commandOnly) {
        field = "command";
      } else {
        field = "all";
      }
      const results = yield* SecretStore.searchCommands(pattern, field);

      if (results.length === 0) {
        yield* Console.log("🔍 No commands found.");
        return;
      }

      for (const item of results) {
        yield* Console.log(
          `⚡ ${item.name}  →  ${item.command}  (ctx: ${item.context})`
        );
      }
    })
);

// --- cmd list ---

const cmdListCommand = Command.make("list", {}, () =>
  Effect.gen(function* () {
    const results = yield* SecretStore.listCommands();

    if (results.length === 0) {
      yield* Console.log("📭 No saved commands.");
      return;
    }

    for (const item of results) {
      yield* Console.log(
        `⚡ ${item.name}  →  ${item.command}  (ctx: ${item.context})`
      );
    }
  })
);

// --- cmd delete <name> ---

const cmdDeleteName = Args.text({ name: "name" }).pipe(
  Args.withDescription("Name of the command to delete")
);

const cmdDeleteCommand = Command.make(
  "delete",
  { name: cmdDeleteName },
  ({ name }) =>
    Effect.gen(function* () {
      yield* SecretStore.removeCommand(name);
      yield* Console.log(`🗑️  Command "${name}" removed`);
    })
);

// --- cmd (parent) ---

export const cmdCommand = Command.make("cmd", {}).pipe(
  Command.withSubcommands([
    cmdRunCommand,
    cmdSearchCommandDef,
    cmdListCommand,
    cmdDeleteCommand,
  ])
);
