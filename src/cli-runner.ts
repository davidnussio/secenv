import { createRequire } from "node:module";
import { Command } from "@effect/cli";
import { NodeContext, NodeRuntime } from "@effect/platform-node";
import { Console, Effect, Layer } from "effect";
import { addCommand } from "./cli/add.js";
import { auditCommand } from "./cli/audit.js";
import { cmdCommand } from "./cli/cmd.js";
import { handleComplete } from "./cli/complete.js";
import { copyCommand } from "./cli/copy.js";
import { delCommand, deleteCommand } from "./cli/delete.js";
import { doctorCommand } from "./cli/doctor.js";
import { envCommand } from "./cli/env.js";
import { envFileCommand } from "./cli/env-file.js";
import { getCommand } from "./cli/get.js";
import { listCommand } from "./cli/list.js";
import { loadCommand } from "./cli/load.js";
import { moveCommand } from "./cli/move.js";
import { renameCommand } from "./cli/rename.js";
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

const require = createRequire(import.meta.url);
const pkg = require("../package.json") as { version: string };

const command = rootCommand.pipe(
  Command.withSubcommands([
    addCommand,
    getCommand,
    deleteCommand,
    delCommand,
    renameCommand,
    listCommand,
    searchCommand,
    moveCommand,
    copyCommand,
    runCommand,
    cmdCommand,
    envFileCommand,
    envCommand,
    loadCommand,
    shareCommand,
    auditCommand,
    doctorCommand,
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
const MUTATING_COMMANDS = new Set([
  "add",
  "delete",
  "del",
  "load",
  "cmd",
  "rename",
  "move",
  "copy",
]);

const isMutatingCommand = (): boolean => {
  const args = process.argv.slice(2);
  return args.some((a) => MUTATING_COMMANDS.has(a));
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

  program.pipe(
    Effect.provide(secretStoreLayer),
    Effect.provide(NodeContext.layer),
    NodeRuntime.runMain
  );
};
