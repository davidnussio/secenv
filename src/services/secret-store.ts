import { Effect } from "effect";
import { parse as parseSecretKey } from "../domain/secret-key.js";
import { SecretNotFoundError } from "../errors.js";
import { PlatformKeychainAccessLive } from "../implementations/platform-keychain-access.js";
import { SqliteMetadataStoreLive } from "../implementations/sqlite-metadata-store.js";
import { DatabaseConfigDefault } from "./database-config.js";
import { KeychainAccess } from "./keychain-access.js";
import { MetadataStore } from "./metadata-store.js";

/** Prefix to identify base64-encoded values stored by envsec.
 *  Allows backward compatibility with legacy plaintext secrets. */
const B64_PREFIX = "envsec:b64:";

/** Encode secret values to base64 before storing in OS credential stores.
 *  This avoids platform-specific encoding issues (e.g. macOS security CLI
 *  returns hex for non-ASCII values, Windows cmdkey has escaping quirks). */
const encodeValue = (value: string): string =>
  `${B64_PREFIX}${Buffer.from(value, "utf8").toString("base64")}`;

const decodeValue = (raw: string): string => {
  if (raw.startsWith(B64_PREFIX)) {
    return Buffer.from(raw.slice(B64_PREFIX.length), "base64").toString("utf8");
  }
  // Legacy: return plaintext values as-is for backward compatibility
  return raw;
};

export class SecretStore extends Effect.Service<SecretStore>()("SecretStore", {
  accessors: true,
  dependencies: [
    PlatformKeychainAccessLive,
    SqliteMetadataStoreLive,
    DatabaseConfigDefault,
  ],
  scoped: Effect.gen(function* () {
    const keychain = yield* KeychainAccess;
    const metadata = yield* MetadataStore;

    const set = Effect.fn("SecretStore.set")(function* (
      context: string,
      key: string,
      value: string,
      expiresAt?: string | null
    ) {
      const parsed = yield* parseSecretKey(key, context);
      yield* keychain.set(parsed.service, parsed.account, encodeValue(value));
      yield* metadata
        .upsert(context, key, expiresAt)
        .pipe(
          Effect.catchAll((metadataError) =>
            keychain
              .remove(parsed.service, parsed.account)
              .pipe(Effect.ignore, Effect.andThen(Effect.fail(metadataError)))
          )
        );
    });

    const get = Effect.fn("SecretStore.get")(function* (
      context: string,
      key: string
    ) {
      yield* metadata.get(context, key);
      const parsed = yield* parseSecretKey(key, context);
      return yield* keychain.get(parsed.service, parsed.account).pipe(
        Effect.map(decodeValue),
        Effect.catchTag("SecretNotFoundError", () =>
          Effect.fail(
            new SecretNotFoundError({
              key,
              context,
              message: `Secret "${key}" has metadata in context "${context}" but is missing from the OS keychain. Run: envsec delete -c ${context} ${key}`,
            })
          )
        )
      );
    });

    const getMetadata = Effect.fn("SecretStore.getMetadata")(function* (
      context: string,
      key: string
    ) {
      return yield* metadata.get(context, key);
    });

    const remove = Effect.fn("SecretStore.remove")(function* (
      context: string,
      key: string
    ) {
      const parsed = yield* parseSecretKey(key, context);
      yield* keychain
        .remove(parsed.service, parsed.account)
        .pipe(Effect.catchTag("KeychainError", () => Effect.void));
      yield* metadata.remove(context, key);
    });

    const search = Effect.fn("SecretStore.search")(function* (
      context: string,
      pattern: string
    ) {
      return yield* metadata.search(context, pattern);
    });

    const list = Effect.fn("SecretStore.list")(function* (context: string) {
      return yield* metadata.list(context);
    });

    const searchContexts = Effect.fn("SecretStore.searchContexts")(function* (
      pattern: string
    ) {
      return yield* metadata.searchContexts(pattern);
    });

    const listContexts = Effect.fn("SecretStore.listContexts")(function* () {
      return yield* metadata.listContexts();
    });

    const saveCommand = Effect.fn("SecretStore.saveCommand")(function* (
      name: string,
      command: string,
      context: string
    ) {
      yield* metadata.saveCommand(name, command, context);
    });

    const getCommand = Effect.fn("SecretStore.getCommand")(function* (
      name: string
    ) {
      return yield* metadata.getCommand(name);
    });

    const searchCommands = Effect.fn("SecretStore.searchCommands")(function* (
      pattern: string,
      field: "name" | "command" | "all"
    ) {
      return yield* metadata.searchCommands(pattern, field);
    });

    const listCommands = Effect.fn("SecretStore.listCommands")(function* () {
      return yield* metadata.listCommands();
    });

    const removeCommand = Effect.fn("SecretStore.removeCommand")(function* (
      name: string
    ) {
      yield* metadata.removeCommand(name);
    });

    const beginBatch = Effect.fn("SecretStore.beginBatch")(function* () {
      yield* metadata.beginBatch();
    });

    const endBatch = Effect.fn("SecretStore.endBatch")(function* () {
      yield* metadata.endBatch();
    });

    const listExpiring = Effect.fn("SecretStore.listExpiring")(function* (
      context: string,
      withinMs: number
    ) {
      return yield* metadata.listExpiring(context, withinMs);
    });

    const listAllExpiring = Effect.fn("SecretStore.listAllExpiring")(function* (
      withinMs: number
    ) {
      return yield* metadata.listAllExpiring(withinMs);
    });

    const trackEnvFileExport = Effect.fn("SecretStore.trackEnvFileExport")(
      function* (context: string, path: string) {
        yield* metadata.trackEnvFileExport(context, path);
      }
    );

    const listEnvFileExports = Effect.fn("SecretStore.listEnvFileExports")(
      function* () {
        return yield* metadata.listEnvFileExports();
      }
    );

    const removeEnvFileExport = Effect.fn("SecretStore.removeEnvFileExport")(
      function* (path: string) {
        yield* metadata.removeEnvFileExport(path);
      }
    );

    return {
      set,
      get,
      getMetadata,
      remove,
      search,
      list,
      searchContexts,
      listContexts,
      saveCommand,
      getCommand,
      searchCommands,
      listCommands,
      removeCommand,
      beginBatch,
      endBatch,
      listExpiring,
      listAllExpiring,
      trackEnvFileExport,
      listEnvFileExports,
      removeEnvFileExport,
    };
  }),
}) {}
