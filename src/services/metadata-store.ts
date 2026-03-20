import { Context, type Effect } from "effect";
import type {
  CommandNotFoundError,
  MetadataStoreError,
  SecretNotFoundError,
} from "../errors.js";

export interface SecretMetadata {
  readonly created_at: string;
  readonly key: string;
  readonly updated_at: string;
}

export class MetadataStore extends Context.Tag("MetadataStore")<
  MetadataStore,
  {
    readonly upsert: (
      env: string,
      key: string
    ) => Effect.Effect<void, MetadataStoreError>;
    readonly get: (
      env: string,
      key: string
    ) => Effect.Effect<
      SecretMetadata,
      SecretNotFoundError | MetadataStoreError
    >;
    readonly remove: (
      env: string,
      key: string
    ) => Effect.Effect<void, MetadataStoreError>;
    readonly search: (
      env: string,
      pattern: string
    ) => Effect.Effect<Array<{ key: string }>, MetadataStoreError>;
    readonly list: (
      env: string
    ) => Effect.Effect<
      Array<{ key: string; updated_at: string }>,
      MetadataStoreError
    >;
    readonly searchContexts: (
      pattern: string
    ) => Effect.Effect<
      Array<{ context: string; count: number }>,
      MetadataStoreError
    >;
    readonly listContexts: () => Effect.Effect<
      Array<{ context: string; count: number }>,
      MetadataStoreError
    >;
    readonly saveCommand: (
      name: string,
      command: string,
      context: string
    ) => Effect.Effect<void, MetadataStoreError>;
    readonly getCommand: (
      name: string
    ) => Effect.Effect<
      CommandMetadata,
      CommandNotFoundError | MetadataStoreError
    >;
    readonly searchCommands: (
      pattern: string,
      field: "name" | "command" | "all"
    ) => Effect.Effect<CommandMetadata[], MetadataStoreError>;
    readonly listCommands: () => Effect.Effect<
      CommandMetadata[],
      MetadataStoreError
    >;
    readonly removeCommand: (
      name: string
    ) => Effect.Effect<void, CommandNotFoundError | MetadataStoreError>;
  }
>() {}

export interface CommandMetadata {
  readonly command: string;
  readonly context: string;
  readonly created_at: string;
  readonly name: string;
}
