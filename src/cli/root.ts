import { Command, Options } from "@effect/cli";
import { Effect, Option, Schema } from "effect";
import { ContextName } from "../domain/context-name.js";

const decodeContext = Schema.decode(ContextName);

const context = Options.text("context").pipe(
  Options.withAlias("c"),
  Options.withDescription(
    "Context name (e.g. myapp.dev, stripe-api.prod, work.staging). Also reads ENVSEC_CONTEXT env var."
  ),
  Options.optional
);

const debug = Options.boolean("debug").pipe(
  Options.withAlias("d"),
  Options.withDescription("Enable debug logging"),
  Options.withDefault(false)
);

const json = Options.boolean("json").pipe(
  Options.withDescription("Output in JSON format for scripting"),
  Options.withDefault(false)
);

export const rootCommand = Command.make("envsec", { context, debug, json });

/**
 * Resolve context from --context flag or ENVSEC_CONTEXT env var.
 */
const resolveRawContext = Effect.gen(function* () {
  const { context } = yield* rootCommand;

  if (Option.isSome(context)) {
    return context.value;
  }

  const envContext = process.env.ENVSEC_CONTEXT;
  if (envContext && envContext.trim() !== "") {
    return envContext.trim();
  }

  return yield* Effect.fail(
    new Error(
      "Missing required option --context (-c) or ENVSEC_CONTEXT env var"
    )
  );
});

/**
 * Extract and validate the required --context option.
 * Falls back to ENVSEC_CONTEXT env var if --context is not provided.
 * Fails with a user-friendly error if missing or invalid.
 */
export const requireContext = Effect.gen(function* () {
  const raw = yield* resolveRawContext;
  return yield* decodeContext(raw);
});

/**
 * Validate an optional context value (for commands where --context is optional).
 * Falls back to ENVSEC_CONTEXT env var if --context is not provided.
 */
export const optionalContext = Effect.gen(function* () {
  const { context } = yield* rootCommand;

  if (Option.isSome(context)) {
    const validated = yield* decodeContext(context.value);
    return Option.some(validated);
  }

  const envContext = process.env.ENVSEC_CONTEXT;
  if (envContext && envContext.trim() !== "") {
    const validated = yield* decodeContext(envContext.trim());
    return Option.some(validated);
  }

  return Option.none<ContextName>();
});

/**
 * Check if --json flag is set.
 */
export const isJsonOutput = Effect.gen(function* () {
  const { json } = yield* rootCommand;
  return json;
});
