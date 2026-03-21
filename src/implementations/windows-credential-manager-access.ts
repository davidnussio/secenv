import { execFile } from "node:child_process";
import { Effect, Layer } from "effect";
import { KeychainError, SecretNotFoundError } from "../errors.js";
import { KeychainAccess } from "../services/keychain-access.js";

/**
 * Windows implementation using PowerShell + Windows Credential Manager.
 *
 * Uses the built-in `cmdkey` for basic operations and PowerShell's
 * `System.Net.NetworkCredential` / `CredentialManager` for read/write.
 *
 * No extra dependencies required — uses only built-in Windows APIs via PowerShell.
 *
 * Credential target format: "envsec:<service>/<account>"
 */

const runPowerShell = (script: string) =>
  Effect.async<
    { exitCode: number; stdout: string; stderr: string },
    KeychainError
  >((resume) => {
    execFile(
      "powershell.exe",
      ["-NoProfile", "-NonInteractive", "-Command", script],
      (error, stdout, stderr) => {
        if (error && "code" in error && error.code === "ENOENT") {
          resume(
            Effect.fail(
              new KeychainError({
                command: "powershell",
                stderr: "powershell.exe not found",
                message:
                  "PowerShell is not available. Ensure you are running on Windows.",
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
      }
    );
  });

/**
 * Escape a string for use inside PowerShell single-quoted strings.
 * Single quotes are doubled, and the string is safe from backtick,
 * dollar sign, and other PS metacharacter interpretation.
 *
 * For here-string contexts or unquoted usage, additional characters
 * (backtick, $, ", null byte) are also escaped to prevent injection.
 */
const escapePS = (s: string): string =>
  s
    .replaceAll("'", "''")
    .replaceAll("`", "``")
    .replaceAll("$", "`$")
    .replaceAll('"', '`"')
    .replaceAll("\0", "");

const targetName = (service: string, account: string) =>
  `envsec:${service}/${account}`;

const make = KeychainAccess.of({
  set: Effect.fn("WindowsCredentialManagerAccess.set")(function* (
    service: string,
    account: string,
    password: string
  ) {
    const target = escapePS(targetName(service, account));
    const user = escapePS(account);
    const pass = escapePS(password);

    // Use cmdkey for simplicity — it's built-in and handles generic credentials
    const script = `cmdkey /generic:'${target}' /user:'${user}' /pass:'${pass}'`;

    const result = yield* runPowerShell(script);

    if (result.exitCode !== 0) {
      return yield* new KeychainError({
        command: "cmdkey /add",
        stderr: result.stderr || result.stdout,
        message: `Failed to store credential: ${service}/${account}`,
      });
    }
  }),

  get: Effect.fn("WindowsCredentialManagerAccess.get")(function* (
    service: string,
    account: string
  ) {
    const target = escapePS(targetName(service, account));

    // Read credential using .NET CredentialManager API via PowerShell
    // This is the only reliable way to read the password back from Credential Manager
    const script = [
      "Add-Type -AssemblyName System.Runtime.InteropServices",
      "$cred = [System.Runtime.InteropServices.Marshal]",
      `$target = '${target}'`,
      // Use P/Invoke to call CredReadW
      `Add-Type @'`,
      "using System;",
      "using System.Runtime.InteropServices;",
      "public class CredManager {",
      `  [DllImport("advapi32.dll", SetLastError=true, CharSet=CharSet.Unicode)]`,
      "  public static extern bool CredRead(string target, int type, int flags, out IntPtr cred);",
      `  [DllImport("advapi32.dll")]`,
      "  public static extern void CredFree(IntPtr cred);",
      "  [StructLayout(LayoutKind.Sequential, CharSet=CharSet.Unicode)]",
      "  public struct CREDENTIAL {",
      "    public int Flags; public int Type;",
      "    public string TargetName; public string Comment;",
      "    public long LastWritten; public int CredentialBlobSize;",
      "    public IntPtr CredentialBlob; public int Persist;",
      "    public int AttributeCount; public IntPtr Attributes;",
      "    public string TargetAlias; public string UserName;",
      "  }",
      "  public static string Read(string target) {",
      "    IntPtr ptr;",
      "    if (!CredRead(target, 1, 0, out ptr)) return null;",
      "    var c = (CREDENTIAL)Marshal.PtrToStructure(ptr, typeof(CREDENTIAL));",
      "    var pw = Marshal.PtrToStringUni(c.CredentialBlob, c.CredentialBlobSize / 2);",
      "    CredFree(ptr);",
      "    return pw;",
      "  }",
      "}",
      `'@`,
      `$result = [CredManager]::Read('${target}')`,
      "if ($result -eq $null) { exit 1 }",
      "Write-Output $result",
    ].join("\n");

    const result = yield* runPowerShell(script);

    if (result.exitCode !== 0) {
      return yield* new SecretNotFoundError({
        key: account,
        context: service,
        message: `Secret not found: ${service}/${account}`,
      });
    }

    return result.stdout.trim();
  }),

  remove: Effect.fn("WindowsCredentialManagerAccess.remove")(function* (
    service: string,
    account: string
  ) {
    const target = escapePS(targetName(service, account));
    const script = `cmdkey /delete:'${target}'`;

    const result = yield* runPowerShell(script);

    if (result.exitCode !== 0) {
      return yield* new KeychainError({
        command: "cmdkey /delete",
        stderr: result.stderr || result.stdout,
        message: `Failed to remove credential: ${service}/${account}`,
      });
    }
  }),
});

export const WindowsCredentialManagerAccessLive = Layer.succeed(
  KeychainAccess,
  make
);
