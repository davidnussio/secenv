import { Command } from "@effect/cli";
import { addCommand } from "./add.js";
import { auditCommand } from "./audit.js";
import { cmdCommand } from "./cmd.js";
import { delCommand, deleteCommand } from "./delete.js";
import { envCommand } from "./env.js";
import { envFileCommand } from "./env-file.js";
import { getCommand } from "./get.js";
import { listCommand } from "./list.js";
import { loadCommand } from "./load.js";
import { rootCommand } from "./root.js";
import { runCommand } from "./run.js";
import { searchCommand } from "./search.js";
import { shareCommand } from "./share.js";

export const allCommands = rootCommand.pipe(
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
