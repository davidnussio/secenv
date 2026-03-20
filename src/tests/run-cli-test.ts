import { spyOn } from "bun:test";
import { Command } from "@effect/cli";
import { NodeContext } from "@effect/platform-node";
import { Effect, type Layer } from "effect";
import { rootCommand } from "../cli/root.js";
import type { MetadataStoreError } from "../errors.js";
import type { SecretStore } from "../services/secret-store.js";

type CommandType =
  | "list"
  | "add"
  | "get"
  | "delete"
  | "del"
  | "search"
  | "run"
  | "env-file"
  | "load"
  | "cmd";

export function runCli<T extends CommandType>(
  command: Command.Command<
    T,
    SecretStore | Command.Command.Context<"envsec">,
    MetadataStoreError,
    Readonly<Record<string, unknown>>
  >,
  secretStoreLayer: Layer.Layer<SecretStore, MetadataStoreError | Error, never>
) {
  return (argv: string[]) => {
    const logs: string[] = [];

    const consoleSpy = spyOn(console, "log").mockImplementation((...args) => {
      logs.push(args.map(String).join(" "));
    });

    const fullCommand = rootCommand.pipe(Command.withSubcommands([command]));
    const run = Command.run(fullCommand, {
      name: "envsec",
      version: "0.0.0-test",
    });

    return run(["node", "envsec", ...argv])
      .pipe(Effect.provide(secretStoreLayer), Effect.provide(NodeContext.layer))
      .pipe(Effect.runPromise)
      .finally(() => consoleSpy.mockRestore())
      .then(() => logs);
  };
}
