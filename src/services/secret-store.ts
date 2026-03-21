import { Effect } from "effect";
import { parse as parseSecretKey } from "../domain/secret-key.js";
import { PlatformKeychainAccessLive } from "../implementations/platform-keychain-access.js";
import { SqliteMetadataStoreLive } from "../implementations/sqlite-metadata-store.js";
import { KeychainAccess } from "./keychain-access.js";
import { MetadataStore } from "./metadata-store.js";

export class SecretStore extends Effect.Service<SecretStore>()("SecretStore", {
  accessors: true,
  dependencies: [PlatformKeychainAccessLive, SqliteMetadataStoreLive],
  effect: Effect.gen(function* () {
    const keychain = yield* KeychainAccess;
    const metadata = yield* MetadataStore;

    const set = Effect.fn("SecretStore.set")(function* (
      context: string,
      key: string,
      value: string
    ) {
      const parsed = yield* parseSecretKey(key, context);
      yield* keychain.set(parsed.service, parsed.account, value);
      yield* metadata
        .upsert(context, key)
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
      return yield* keychain.get(parsed.service, parsed.account);
    });

    const remove = Effect.fn("SecretStore.remove")(function* (
      context: string,
      key: string
    ) {
      const parsed = yield* parseSecretKey(key, context);
      yield* keychain.remove(parsed.service, parsed.account);
      yield* metadata
        .remove(context, key)
        .pipe(
          Effect.catchAll((metadataError) =>
            keychain
              .set(parsed.service, parsed.account, "")
              .pipe(Effect.ignore, Effect.andThen(Effect.fail(metadataError)))
          )
        );
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

    return {
      set,
      get,
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
    };
  }),
}) {}
