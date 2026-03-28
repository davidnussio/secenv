import { createRequire } from "node:module";
import { Command } from "@effect/cli";
import { NodeContext, NodeRuntime } from "@effect/platform-node";
import { Cause, Console, Effect, Layer } from "effect";
import { addCommand } from "./cli/add.js";
import { auditCommand } from "./cli/audit.js";
import { cmdCommand } from "./cli/cmd.js";
import { handleComplete } from "./cli/complete.js";
import { delCommand, deleteCommand } from "./cli/delete.js";
import { envCommand } from "./cli/env.js";
import { envFileCommand } from "./cli/env-file.js";
import { getCommand } from "./cli/get.js";
import { listCommand } from "./cli/list.js";
import { loadCommand } from "./cli/load.js";
import { rootCommand } from "./cli/root.js";
import { runCommand } from "./cli/run.js";
import { searchCommand } from "./cli/search.js";
import { shareCommand } from "./cli/share.js";
import { generateCompletions, type ShellType } from "./completions/index.js";
import { refreshCache } from "./services/completion-cache.js";
import {
  DatabaseConfigDefault,
  DatabaseConfigFrom,
} from "./services/database-config.js";
import { SecretStore } from "./services/secret-store.js";
import { dim, icons, red } from "./ui.js";

const require = createRequire(import.meta.url);
const pkg = require("../package.json") as { version: string };

const command = rootCommand.pipe(
  Command.withSubcommands([
    addCommand,
    getCommand,
    deleteCommand,
    delCommand,
    searchCommand,
    listCommand,
    runCommand,
    envCommand,
    envFileCommand,
    loadCommand,
    cmdCommand,
    auditCommand,
    shareCommand,
  ])
);

const cli = Command.run(command, {
  name: "envsec",
  version: pkg.version,
});

const interceptCompletions = (): ShellType | null => {
  const idx = process.argv.indexOf("--completions");
  if (idx === -1) {
    return null;
  }
  const shell = process.argv[idx + 1];
  if (shell === "bash" || shell === "zsh" || shell === "fish") {
    return shell;
  }
  if (shell === "sh") {
    return "bash";
  }
  return null;
};

const interceptComplete = (): { type: string; arg?: string } | null => {
  const args = process.argv.slice(2);
  if (args[0] !== "__complete") {
    return null;
  }
  return { type: args[1] ?? "", arg: args[2] };
};

/** Commands that mutate secrets or saved commands — trigger cache refresh. */
const MUTATING_COMMANDS = new Set(["add", "delete", "del", "load", "cmd"]);

const isMutatingCommand = (): boolean => {
  const args = process.argv.slice(2);
  return args.some((a) => MUTATING_COMMANDS.has(a));
};

/** Check if --debug flag is present in argv. */
const isDebugMode = (): boolean => {
  const args = process.argv.slice(2);
  return args.includes("--debug") || args.includes("-d");
};

/**
 * Extract a user-friendly message from an Effect Cause.
 * Returns undefined if the cause doesn't contain a known tagged error.
 */
const extractErrorMessage = (
  cause: Cause.Cause<unknown>
): string | undefined => {
  const failures = Cause.failures(cause);
  for (const err of failures) {
    if (
      typeof err === "object" &&
      err !== null &&
      "_tag" in err &&
      "message" in err &&
      typeof (err as { message: unknown }).message === "string"
    ) {
      return (err as { message: string }).message;
    }
  }

  const defects = Cause.defects(cause);
  for (const d of defects) {
    if (d instanceof Error) {
      return d.message;
    }
  }

  return undefined;
};

/**
 * Wrap an effect with user-friendly error handling.
 * In normal mode, prints a clean one-line error and exits.
 * In debug mode (--debug), falls through to the default Effect error output.
 */
const withUserErrors = <A, E, R>(
  effect: Effect.Effect<A, E, R>
): Effect.Effect<A, E, R> => {
  if (isDebugMode()) {
    return effect;
  }
  return effect.pipe(
    Effect.tapErrorCause((cause) =>
      Effect.sync(() => {
        const msg = extractErrorMessage(cause);
        if (msg) {
          process.stderr.write(`${icons.error} ${red(msg)}\n`);
          process.stderr.write(
            `${dim("  Run with --debug for full error details")}\n`
          );
          process.exit(1);
        }
      })
    )
  );
};

export const runCli = (
  customDbPath: string | undefined,
  cachePath: string
): void => {
  const shell = interceptCompletions();
  const complete = interceptComplete();

  if (shell) {
    const bin = "envsec";
    Console.log(generateCompletions(shell, bin)).pipe(NodeRuntime.runMain);
    return;
  }

  const dbLayer = customDbPath
    ? DatabaseConfigFrom(customDbPath)
    : DatabaseConfigDefault;
  const secretStoreLayer = SecretStore.Default.pipe(Layer.provide(dbLayer));

  if (complete) {
    handleComplete(complete.type, complete.arg, cachePath).pipe(
      Effect.provide(secretStoreLayer),
      NodeRuntime.runMain
    );
    return;
  }

  const shouldRefreshCache = isMutatingCommand();

  const program = shouldRefreshCache
    ? cli(process.argv).pipe(Effect.tap(() => refreshCache(cachePath)))
    : cli(process.argv);

  withUserErrors(program).pipe(
    Effect.provide(secretStoreLayer),
    Effect.provide(NodeContext.layer),
    NodeRuntime.runMain
  );
};
