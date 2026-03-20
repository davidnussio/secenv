import { Effect, Layer } from "effect";
import { SecretNotFoundError } from "../errors.js";
import {
  MetadataStoreConfig,
  SqliteMetadataStore,
} from "../implementations/sqlite-metadata-store.js";
import { KeychainAccess } from "../services/keychain-access.js";
import { SecretStore } from "../services/secret-store.js";

export const KeychainAccessTest = Layer.effect(
  KeychainAccess,
  Effect.sync(() => {
    const store = new Map<string, string>();
    const key = (service: string, account: string) => `${service}::${account}`;

    return {
      set: (service, account, password) =>
        Effect.sync(() => store.set(key(service, account), password)),

      get: (service, account) =>
        Effect.gen(function* () {
          const value = store.get(key(service, account));
          if (value === undefined) {
            return yield* new SecretNotFoundError({
              key: account,
              context: service,
              message: `Not found: ${service}/${account}`,
            });
          }
          return value;
        }),

      remove: (service, account) =>
        Effect.sync(() => store.delete(key(service, account))),
    };
  })
);

const ConfigTest = Layer.succeed(MetadataStoreConfig, { dbPath: ":memory:" });
export const SqliteMetadataStoreTest = SqliteMetadataStore.pipe(
  Layer.provide(ConfigTest)
);

export const SecretStoreTest = SecretStore.Default.pipe(
  Layer.provide(SqliteMetadataStoreTest),
  Layer.provide(KeychainAccessTest)
);
