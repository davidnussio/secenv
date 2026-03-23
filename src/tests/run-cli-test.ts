import { Command } from "@effect/cli";
import { NodeContext } from "@effect/platform-node";
import { Effect, Layer, type Layer as LayerType } from "effect";
import { vi } from "vitest";
import { allCommands } from "../cli/index.js";
import type { SecretStore } from "../services/secret-store.js";

export function buildTestCli(
  secretStoreLayer: LayerType.Layer<SecretStore, unknown, unknown>
) {
  const allLayers = Layer.mergeAll(secretStoreLayer, NodeContext.layer);

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
      Effect.provide(allLayers),
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
