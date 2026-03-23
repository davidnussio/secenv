import { Effect, Layer } from "effect";
import { SecretNotFoundError } from "../errors.js";
import {
  MetadataStoreConfig,
  SqliteMetadataStore,
} from "../implementations/sqlite-metadata-store.js";
import { DatabaseConfigFrom } from "../services/database-config.js";
import { KeychainAccess } from "../services/keychain-access.js";
import { SecretStore } from "../services/secret-store.js";

const keychainKey = (service: string, account: string) =>
  `${service}::${account}`;

const keychainStore = new Map<string, string>();

const KeychainAccessTest = Layer.succeed(KeychainAccess, {
  set: (service, account, password) =>
    Effect.sync(() =>
      keychainStore.set(keychainKey(service, account), password)
    ),

  get: (service, account) =>
    Effect.gen(function* () {
      const value = keychainStore.get(keychainKey(service, account));
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
    Effect.sync(() => keychainStore.delete(keychainKey(service, account))),
});

const ConfigTest = Layer.succeed(MetadataStoreConfig, {
  dbPath: `${process.cwd()}/db/test.db`,
});

const DatabaseConfigTest = DatabaseConfigFrom(`${process.cwd()}/db/test.db`);

export const SqliteMetadataStoreTest = SqliteMetadataStore.pipe(
  Layer.provide(ConfigTest),
  Layer.provide(DatabaseConfigTest)
);

export const SecretStoreTest = SecretStore.Default.pipe(
  Layer.provide(SqliteMetadataStoreTest),
  Layer.provide(KeychainAccessTest)
);
