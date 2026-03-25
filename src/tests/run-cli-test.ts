import { join } from "node:path";
import { Command } from "@effect/cli";
import { NodeContext } from "@effect/platform-node";
import { Effect, Layer } from "effect";
import { vi } from "vitest";
import { allCommands } from "../cli/index.js";
import { DatabaseConfigFrom } from "../services/database-config.js";
import { SecretStore } from "../services/secret-store.js";
import { KeychainAccessTest } from "./keychain-access-test.js";

export function buildTestCli() {
  const dbPath = join(process.cwd(), "db", "test.db");
  const dbLayer = DatabaseConfigFrom(dbPath);
  const secretStoreLayer = SecretStore.Default.pipe(Layer.provide(dbLayer));
  const testingLayers = Layer.mergeAll(
    secretStoreLayer,
    KeychainAccessTest,
    NodeContext.layer
  );

  return (arg: string) => {
    const logs: string[] = [];

    const consoleSpy = vi
      .spyOn(console, "log")
      .mockImplementation((...args) => {
        logs.push(args.map(String).join(" "));
      });

    const run = Command.run(allCommands, {
      name: "envsec",
      version: "0.0.0-test",
    });

    const effect = run(["node", "envsec", ...arg.split(" ")]).pipe(
      Effect.provide(testingLayers),
      Effect.tapError(() => Effect.void)
    ) as Effect.Effect<void, unknown, never>;

    return Effect.runPromise(effect)
      .catch(() => {
        consoleSpy.mockRestore();
      })
      .finally(() => consoleSpy.mockRestore())
      .then(() => logs);
  };
}
