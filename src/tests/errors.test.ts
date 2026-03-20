import { describe, expect, test } from "bun:test";
import {
  CommandNotFoundError,
  InvalidKeyError,
  KeychainError,
  MetadataStoreError,
  SecretNotFoundError,
} from "../errors.js";

describe("SecretNotFoundError", () => {
  test("should create error with required fields", () => {
    const error = new SecretNotFoundError({
      key: "api-key",
      context: "myapp.prod",
      message: "Secret not found",
    });

    expect(error.key).toBe("api-key");
    expect(error.context).toBe("myapp.prod");
    expect(error.message).toBe("Secret not found");
  });
});

describe("KeychainError", () => {
  test("should create error with required fields", () => {
    const error = new KeychainError({
      command: "security find-generic-password",
      stderr: "The specified item could not be found in the keychain",
      message: "Keychain operation failed",
    });

    expect(error.command).toBe("security find-generic-password");
    expect(error.stderr).toContain("item could not be found");
    expect(error.message).toBe("Keychain operation failed");
  });
});

describe("MetadataStoreError", () => {
  test("should create error with required fields", () => {
    const error = new MetadataStoreError({
      operation: "INSERT",
      message: "Database constraint violation",
    });

    expect(error.operation).toBe("INSERT");
    expect(error.message).toBe("Database constraint violation");
  });
});

describe("InvalidKeyError", () => {
  test("should create error with required fields", () => {
    const error = new InvalidKeyError({
      key: "invalid..key",
      message: "Key contains invalid characters",
    });

    expect(error.key).toBe("invalid..key");
    expect(error.message).toBe("Key contains invalid characters");
  });
});

describe("CommandNotFoundError", () => {
  test("should create error with required fields", () => {
    const error = new CommandNotFoundError({
      name: "secret-tool",
      message: "Command not found in PATH",
    });

    expect(error.name).toBe("secret-tool");
    expect(error.message).toBe("Command not found in PATH");
  });
});
