import { Effect } from "effect";
import { InvalidKeyError } from "../errors.js";

export interface ParsedKey {
  readonly account: string;
  readonly service: string;
}

export const parse = Effect.fn("SecretKey.parse")(function* (
  key: string,
  env: string
) {
  const parts = key.split(".");

  if (parts.some((p) => p === "")) {
    return yield* new InvalidKeyError({
      key,
      message: `Key "${key}" contains empty parts — each dot-separated segment must be non-empty`,
    });
  }

  const account = parts.at(-1);

  if (!account) {
    return yield* new InvalidKeyError({
      key,
      message: `Key "${key}" must be a non-empty string`,
    });
  }

  const serviceParts = parts.slice(0, -1);
  const service =
    serviceParts.length > 0
      ? `envsec.${env}.${serviceParts.join(".")}`
      : `envsec.${env}`;

  return { service, account } satisfies ParsedKey;
});
