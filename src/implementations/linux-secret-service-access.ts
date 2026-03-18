import { execFile } from "node:child_process";
import { Effect, Layer } from "effect";
import { KeychainError, SecretNotFoundError } from "../errors.js";
import { KeychainAccess } from "../services/keychain-access.js";

/**
 * Linux implementation using `secret-tool` (libsecret).
 *
 * Stores secrets via the freedesktop.org Secret Service API (D-Bus),
 * backed by GNOME Keyring, KDE Wallet, or any compatible provider.
 *
 * Requires: `libsecret-tools` package
 *   - Debian/Ubuntu: sudo apt install libsecret-tools
 *   - Fedora:        sudo dnf install libsecret
 *   - Arch:          sudo pacman -S libsecret
 */

const run = (args: string[], stdin?: string) =>
  Effect.async<
    { exitCode: number; stdout: string; stderr: string },
    KeychainError
  >((resume) => {
    const child = execFile("secret-tool", args, (error, stdout, stderr) => {
      if (error && "code" in error && error.code === "ENOENT") {
        resume(
          Effect.fail(
            new KeychainError({
              command: args[0] ?? "unknown",
              stderr: "secret-tool not found. Install libsecret-tools.",
              message:
                "secret-tool is not installed. Install it with your package manager (e.g. apt install libsecret-tools).",
            })
          )
        );
        return;
      }
      let exitCode = 0;
      if (error) {
        exitCode = typeof error.code === "number" ? error.code : 1;
      }
      resume(
        Effect.succeed({
          exitCode,
          stdout,
          stderr,
        })
      );
    });

    // secret-tool store reads the password from stdin
    if (stdin !== undefined) {
      child.stdin?.write(stdin);
      child.stdin?.end();
    }
  });

const make = KeychainAccess.of({
  set: Effect.fn("LinuxSecretServiceAccess.set")(function* (
    service: string,
    account: string,
    password: string
  ) {
    // secret-tool store --label="<label>" <attribute> <value> ...
    // Password is read from stdin
    const result = yield* run(
      [
        "store",
        "--label",
        `envsec:${service}/${account}`,
        "service",
        service,
        "account",
        account,
      ],
      password
    );

    if (result.exitCode !== 0) {
      return yield* new KeychainError({
        command: "store",
        stderr: result.stderr,
        message: `Failed to store secret: ${service}/${account}`,
      });
    }
  }),

  get: Effect.fn("LinuxSecretServiceAccess.get")(function* (
    service: string,
    account: string
  ) {
    // secret-tool lookup <attribute> <value> ...
    const result = yield* run([
      "lookup",
      "service",
      service,
      "account",
      account,
    ]);

    // secret-tool returns exit 0 with empty stdout when not found
    if (result.exitCode !== 0 || result.stdout === "") {
      return yield* new SecretNotFoundError({
        key: account,
        context: service,
        message: `Secret not found: ${service}/${account}`,
      });
    }

    return result.stdout.trimEnd();
  }),

  remove: Effect.fn("LinuxSecretServiceAccess.remove")(function* (
    service: string,
    account: string
  ) {
    // secret-tool clear <attribute> <value> ...
    const result = yield* run([
      "clear",
      "service",
      service,
      "account",
      account,
    ]);

    if (result.exitCode !== 0) {
      return yield* new KeychainError({
        command: "clear",
        stderr: result.stderr,
        message: `Failed to remove secret: ${service}/${account}`,
      });
    }
  }),
});

export const LinuxSecretServiceAccessLive = Layer.succeed(KeychainAccess, make);
