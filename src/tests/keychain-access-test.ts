import { Effect, Layer } from "effect";
import { SecretNotFoundError } from "../errors.js";
import { KeychainAccess } from "../services/keychain-access.js";

const keychainKey = (service: string, account: string) =>
  `${service}::${account}`;

const keychainStore = new Map<string, string>();

export const KeychainAccessTest = Layer.succeed(KeychainAccess, {
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
