import { Schema } from "effect";

/**
 * Valid context names: alphanumeric, dots, hyphens, underscores.
 * Must start and end with an alphanumeric character.
 * No path traversal, no shell metacharacters.
 *
 * Examples: "myapp.dev", "stripe-api.prod", "work.staging"
 */

const maxLength = 128;

const contextPattern = /^[a-zA-Z0-9]([a-zA-Z0-9._-]*[a-zA-Z0-9])?$/;

const reservedNames = new Set([
  ".",
  "..",
  "__proto__",
  "constructor",
  "prototype",
]);

export const ContextName = Schema.String.pipe(
  Schema.filter((s) => s.length > 0 || "Context name cannot be empty"),
  Schema.filter(
    (s) =>
      s.length <= maxLength ||
      `Context name is too long (${s.length} chars, max ${maxLength})`
  ),
  Schema.filter(
    (s) =>
      !(s.includes("/") || s.includes("\\")) ||
      `Context name "${s}" must not contain path separators (/ or \\)`
  ),
  Schema.filter(
    (s) =>
      !reservedNames.has(s) ||
      `Context name "${s}" is reserved and cannot be used`
  ),
  Schema.filter(
    (s) =>
      contextPattern.test(s) ||
      `Context name "${s}" is invalid — use only alphanumeric characters, dots, hyphens, and underscores (e.g. "myapp.dev", "stripe-api.prod")`
  ),
  Schema.brand("ContextName")
);

export type ContextName = Schema.Schema.Type<typeof ContextName>;
