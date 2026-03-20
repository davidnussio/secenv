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
  if (parts.length < 2) {
    return yield* new InvalidKeyError({
      key,
      message: `Key "${key}" must have at least 2 dot-separated parts (e.g. "service.account")`,
    });
  }

  if (parts.some((p) => p === "")) {
    return yield* new InvalidKeyError({
      key,
      message: `Key "${key}" contains empty parts — each dot-separated segment must be non-empty`,
    });
  }

  const account = parts.at(-1);
  const serviceParts = parts.slice(0, -1);

  if (!account) {
    return yield* new InvalidKeyError({
      key,
      message: `Key "${key}" must have at least 2 dot-separated parts (e.g. "service.account")`,
    });
  }

  return {
    service: `envsec.${env}.${serviceParts.join(".")}`,
    account,
  } satisfies ParsedKey;
});
