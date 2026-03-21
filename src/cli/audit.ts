import { Command, Options } from "@effect/cli";
import { Console, Duration, Effect, Option } from "effect";
import { formatTimeDistance, parseDuration } from "../domain/duration.js";
import type { SecretMetadata } from "../services/metadata-store.js";
import { SecretStore } from "../services/secret-store.js";
import { isJsonOutput, optionalContext } from "./root.js";

const DEFAULT_WINDOW = "30d";

const withinOption = Options.text("within").pipe(
  Options.withAlias("w"),
  Options.withDescription(
    "Show secrets expiring within this duration (default: 30d). Use 0d to show only already-expired."
  ),
  Options.optional
);

const isExpired = (expiresAt: string | null, now: number): boolean =>
  expiresAt ? new Date(`${expiresAt}Z`).getTime() <= now : false;

const formatLine = (
  key: string,
  expiresAt: string | null,
  now: number,
  prefix?: string
): string => {
  const distance = expiresAt ? formatTimeDistance(expiresAt) : "unknown";
  const expired = isExpired(expiresAt, now);
  const icon = expired ? "\u274C" : "\u23F3";
  const label = expired ? "expired" : "expires";
  const ctx = prefix ? `[${prefix}] ` : "";
  return `  ${icon} ${ctx}${key}  ${label} ${distance}`;
};

const countExpired = (
  secrets: Array<{ expires_at: string | null }>,
  now: number
): { expired: number; expiring: number } => {
  const expired = secrets.filter((s) => isExpired(s.expires_at, now)).length;
  return { expired, expiring: secrets.length - expired };
};

const auditForContext = (
  ctx: string,
  secrets: SecretMetadata[],
  windowStr: string,
  now: number,
  jsonMode: boolean
) =>
  Effect.gen(function* () {
    if (jsonMode) {
      const items = secrets.map((s) => ({
        context: ctx,
        key: s.key,
        expires_at: s.expires_at,
        expired: isExpired(s.expires_at, now),
      }));
      yield* Console.log(JSON.stringify(items));
      return;
    }
    if (secrets.length === 0) {
      yield* Console.log(
        `\u2705 No secrets expiring within ${windowStr} in "${ctx}"`
      );
      return;
    }
    yield* Console.log(
      `\uD83D\uDD0D Secrets expiring within ${windowStr} in "${ctx}":\n`
    );
    for (const s of secrets) {
      yield* Console.log(formatLine(s.key, s.expires_at, now));
    }
    const { expired, expiring } = countExpired(secrets, now);
    yield* Console.log(
      `\n\uD83D\uDCCA ${expired} expired, ${expiring} expiring soon (${secrets.length} total)`
    );
  });

const auditAllContexts = (
  secrets: Array<SecretMetadata & { env: string }>,
  windowStr: string,
  now: number,
  jsonMode: boolean
) =>
  Effect.gen(function* () {
    if (jsonMode) {
      const items = secrets.map((s) => ({
        context: s.env,
        key: s.key,
        expires_at: s.expires_at,
        expired: isExpired(s.expires_at, now),
      }));
      yield* Console.log(JSON.stringify(items));
      return;
    }
    if (secrets.length === 0) {
      yield* Console.log(
        `\u2705 No secrets expiring within ${windowStr} across all contexts`
      );
      return;
    }
    yield* Console.log(
      `\uD83D\uDD0D Secrets expiring within ${windowStr} across all contexts:\n`
    );
    for (const s of secrets) {
      yield* Console.log(formatLine(s.key, s.expires_at, now, s.env));
    }
    const { expired, expiring } = countExpired(secrets, now);
    const contextCount = new Set(secrets.map((s) => s.env)).size;
    yield* Console.log(
      `\n\uD83D\uDCCA ${expired} expired, ${expiring} expiring soon across ${contextCount} context${contextCount === 1 ? "" : "s"} (${secrets.length} total)`
    );
  });

export const auditCommand = Command.make(
  "audit",
  { within: withinOption },
  ({ within }) =>
    Effect.gen(function* () {
      const context = yield* optionalContext;
      const jsonMode = yield* isJsonOutput;
      const windowStr = Option.isSome(within) ? within.value : DEFAULT_WINDOW;
      const windowDuration = yield* parseDuration(windowStr);
      const windowMs = Duration.toMillis(windowDuration);
      const now = Date.now();

      if (Option.isSome(context)) {
        const secrets = yield* SecretStore.listExpiring(
          context.value,
          windowMs
        );
        yield* auditForContext(
          context.value,
          secrets,
          windowStr,
          now,
          jsonMode
        );
        return;
      }

      const secrets = yield* SecretStore.listAllExpiring(windowMs);
      yield* auditAllContexts(secrets, windowStr, now, jsonMode);
    })
);
