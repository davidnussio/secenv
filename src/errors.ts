import { Schema } from "effect";

export class SecretNotFoundError extends Schema.TaggedError<SecretNotFoundError>()(
  "SecretNotFoundError",
  {
    key: Schema.String,
    context: Schema.String,
    message: Schema.String,
  }
) {}

export class KeychainError extends Schema.TaggedError<KeychainError>()(
  "KeychainError",
  {
    command: Schema.String,
    stderr: Schema.String,
    message: Schema.String,
  }
) {}

export class MetadataStoreError extends Schema.TaggedError<MetadataStoreError>()(
  "MetadataStoreError",
  {
    operation: Schema.String,
    message: Schema.String,
  }
) {}

export class InvalidKeyError extends Schema.TaggedError<InvalidKeyError>()(
  "InvalidKeyError",
  {
    key: Schema.String,
    message: Schema.String,
  }
) {}

export class CommandNotFoundError extends Schema.TaggedError<CommandNotFoundError>()(
  "CommandNotFoundError",
  {
    name: Schema.String,
    message: Schema.String,
  }
) {}

export class EmptyValueError extends Schema.TaggedError<EmptyValueError>()(
  "EmptyValueError",
  {
    field: Schema.String,
    message: Schema.String,
  }
) {}

export class AbortedError extends Schema.TaggedError<AbortedError>()(
  "AbortedError",
  {
    message: Schema.String,
  }
) {}

export class CommandExecutionError extends Schema.TaggedError<CommandExecutionError>()(
  "CommandExecutionError",
  {
    command: Schema.String,
    exitCode: Schema.Number,
    message: Schema.String,
  }
) {}

export class MissingSecretsError extends Schema.TaggedError<MissingSecretsError>()(
  "MissingSecretsError",
  {
    keys: Schema.Array(Schema.String),
    context: Schema.String,
    message: Schema.String,
  }
) {}

export class UnsupportedPlatformError extends Schema.TaggedError<UnsupportedPlatformError>()(
  "UnsupportedPlatformError",
  {
    platform: Schema.String,
    message: Schema.String,
  }
) {}

export class FileAccessError extends Schema.TaggedError<FileAccessError>()(
  "FileAccessError",
  {
    path: Schema.String,
    message: Schema.String,
  }
) {}
