import { Command, Options } from "@effect/cli";

const context = Options.text("context").pipe(
  Options.withAlias("c"),
  Options.withDescription(
    "Context name (e.g. myapp.dev, stripe-api.prod, work.staging)"
  ),
  Options.optional
);

const debug = Options.boolean("debug").pipe(
  Options.withAlias("d"),
  Options.withDescription("Enable debug logging"),
  Options.withDefault(false)
);

export const rootCommand = Command.make("envsec", { context, debug });
