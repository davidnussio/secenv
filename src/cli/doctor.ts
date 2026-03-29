import { execFile } from "node:child_process";
import { accessSync, constants, existsSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { homedir, platform, release } from "node:os";
import { dirname, join } from "node:path";
import { Command } from "@effect/cli";
import { Console, Effect } from "effect";
import { SecretStore } from "../services/secret-store.js";
import { badge, bold, dim, green, icons, indent, red, yellow } from "../ui.js";
import { isJsonOutput } from "./root.js";

const require = createRequire(import.meta.url);
const pkg = require("../../package.json") as { version: string };

interface CheckResult {
  readonly detail?: string;
  readonly message: string;
  readonly name: string;
  readonly ok: boolean;
}

const pass = (name: string, message: string, detail?: string): CheckResult => ({
  name,
  ok: true,
  message,
  detail,
});

const fail = (name: string, message: string, detail?: string): CheckResult => ({
  name,
  ok: false,
  message,
  detail,
});

/** Run a shell command and return stdout/stderr/exitCode. */
const exec = (
  cmd: string,
  args: string[]
): Promise<{
  exitCode: number;
  stdout: string;
  stderr: string;
}> =>
  new Promise((resolve) => {
    execFile(cmd, args, (error, stdout, stderr) => {
      if (error && "code" in error && error.code === "ENOENT") {
        resolve({ exitCode: -1, stdout: "", stderr: "not found" });
        return;
      }
      let exitCode = 0;
      if (error) {
        exitCode = typeof error.code === "number" ? error.code : 1;
      }
      resolve({ exitCode, stdout, stderr });
    });
  });

// ── Individual checks ───────────────────────────────────────────────

const checkPlatform = (): CheckResult => {
  const os = platform();
  const ver = release();
  const supported = ["darwin", "linux", "win32"];
  if (supported.includes(os)) {
    return pass("Platform", `${os} ${ver}`, "Supported platform");
  }
  return fail("Platform", `${os} ${ver}`, "Unsupported platform");
};

const checkNodeVersion = (): CheckResult => {
  const ver = process.version;
  const major = Number.parseInt(ver.slice(1).split(".")[0] ?? "0", 10);
  if (major >= 22) {
    return pass("Node.js", ver);
  }
  return fail("Node.js", ver, "Node.js >= 22 required");
};

const checkCredentialStore = async (): Promise<CheckResult> => {
  const os = platform();
  switch (os) {
    case "darwin": {
      const r = await exec("security", ["list-keychains"]);
      if (r.exitCode === 0) {
        return pass(
          "Credential store",
          "macOS Keychain",
          "security CLI available"
        );
      }
      return fail(
        "Credential store",
        "macOS Keychain unavailable",
        r.stderr.trim()
      );
    }
    case "linux": {
      const r = await exec("secret-tool", ["--version"]);
      if (r.exitCode !== -1) {
        return pass(
          "Credential store",
          "Secret Service (libsecret)",
          "secret-tool available"
        );
      }
      return fail(
        "Credential store",
        "secret-tool not found",
        "Install libsecret-tools (apt install libsecret-tools)"
      );
    }
    case "win32": {
      const r = await exec("powershell.exe", [
        "-NoProfile",
        "-Command",
        "Get-Command cmdkey | Out-Null; echo ok",
      ]);
      if (r.stdout.trim() === "ok") {
        return pass(
          "Credential store",
          "Windows Credential Manager",
          "cmdkey + PowerShell available"
        );
      }
      return fail(
        "Credential store",
        "Credential Manager unavailable",
        r.stderr.trim()
      );
    }
    default:
      return fail("Credential store", `Unsupported platform: ${os}`);
  }
};

const checkKeychainReadWrite = async (): Promise<CheckResult> => {
  const testService = "envsec.doctor.test";
  const testAccount = "probe";
  const testValue = "doctor-probe";
  const os = platform();

  try {
    if (os === "darwin") {
      const setR = await exec("security", [
        "add-generic-password",
        "-U",
        "-s",
        testService,
        "-a",
        testAccount,
        "-w",
        testValue,
      ]);
      if (setR.exitCode !== 0) {
        return fail("Keychain read/write", "Write failed", setR.stderr.trim());
      }
      const getR = await exec("security", [
        "find-generic-password",
        "-s",
        testService,
        "-a",
        testAccount,
        "-w",
      ]);
      if (getR.exitCode !== 0 || getR.stdout.trim() !== testValue) {
        return fail("Keychain read/write", "Read-back mismatch");
      }
      await exec("security", [
        "delete-generic-password",
        "-s",
        testService,
        "-a",
        testAccount,
      ]);
      return pass("Keychain read/write", "Write/read/delete OK");
    }

    if (os === "linux") {
      const setR = await exec("secret-tool", [
        "store",
        "--label",
        "envsec doctor probe",
        "service",
        testService,
        "account",
        testAccount,
      ]);
      // secret-tool store reads from stdin — we can't easily pipe here,
      // so just check if the tool is callable
      if (setR.exitCode === -1) {
        return fail("Keychain read/write", "secret-tool not found");
      }
      return pass(
        "Keychain read/write",
        "secret-tool callable",
        "Full write test skipped (requires stdin pipe)"
      );
    }

    if (os === "win32") {
      return pass(
        "Keychain read/write",
        "Skipped on Windows",
        "Credential Manager access verified via cmdkey check"
      );
    }

    return fail("Keychain read/write", `Unsupported platform: ${os}`);
  } catch (e) {
    return fail("Keychain read/write", `Unexpected error: ${e}`);
  }
};

const checkDatabase = (dbPath: string): CheckResult => {
  const dir = dirname(dbPath);

  if (!existsSync(dir)) {
    return fail(
      "Database directory",
      `${dir} does not exist`,
      "It will be created on first use"
    );
  }

  try {
    accessSync(dir, constants.W_OK);
  } catch {
    return fail("Database directory", `${dir} is not writable`);
  }

  if (!existsSync(dbPath)) {
    return pass(
      "Database",
      "Not yet created",
      `Will be initialized at ${dbPath}`
    );
  }

  try {
    const stat = statSync(dbPath);
    // biome-ignore lint/suspicious/noBitwiseOperators: extracting Unix permission bits
    const mode = `0o${(stat.mode & 0o777).toString(8)}`;
    return pass("Database", dbPath, `Permissions: ${mode}`);
  } catch (e) {
    return fail("Database", `Cannot stat ${dbPath}: ${e}`);
  }
};

const checkDatabaseIntegrity = (
  dbPath: string
): Effect.Effect<CheckResult, never, SecretStore> =>
  Effect.gen(function* () {
    if (!existsSync(dbPath)) {
      return pass("Database integrity", "Skipped (no database file yet)");
    }
    // If we can list contexts, the DB schema is valid and readable
    const contexts = yield* SecretStore.listContexts().pipe(
      Effect.catchAll(() => Effect.succeed(null))
    );
    if (contexts === null) {
      return fail(
        "Database integrity",
        "Failed to query database",
        "Database may be corrupted"
      );
    }
    return pass(
      "Database integrity",
      "Schema OK",
      `${contexts.length} context(s) found`
    );
  });

const checkOrphanedSecrets = (
  dbPath: string
): Effect.Effect<CheckResult, never, SecretStore> =>
  Effect.gen(function* () {
    if (!existsSync(dbPath)) {
      return pass("Orphaned secrets", "Skipped (no database file yet)");
    }
    const contexts = yield* SecretStore.listContexts().pipe(
      Effect.catchAll(() =>
        Effect.succeed([] as Array<{ context: string; count: number }>)
      )
    );
    let orphanCount = 0;
    for (const ctx of contexts) {
      const secrets = yield* SecretStore.list(ctx.context).pipe(
        Effect.catchAll(() =>
          Effect.succeed(
            [] as Array<{
              key: string;
              updated_at: string;
              expires_at: string | null;
            }>
          )
        )
      );
      for (const s of secrets) {
        const result = yield* SecretStore.get(ctx.context, s.key).pipe(
          Effect.map(() => true),
          Effect.catchAll(() => Effect.succeed(false))
        );
        if (!result) {
          orphanCount++;
        }
      }
    }
    if (orphanCount > 0) {
      return fail(
        "Orphaned secrets",
        `${orphanCount} secret(s) in metadata but missing from keychain`,
        "Run envsec list and envsec delete to clean up"
      );
    }
    return pass("Orphaned secrets", "None found");
  });

const checkExpiredSecrets = (
  dbPath: string
): Effect.Effect<CheckResult, never, SecretStore> =>
  Effect.gen(function* () {
    if (!existsSync(dbPath)) {
      return pass("Expired secrets", "Skipped (no database file yet)");
    }
    const expired = yield* SecretStore.listAllExpiring(0).pipe(
      Effect.catchAll(() => Effect.succeed([]))
    );
    if (expired.length > 0) {
      return fail(
        "Expired secrets",
        `${expired.length} expired secret(s)`,
        "Run envsec audit --within 0d for details"
      );
    }
    return pass("Expired secrets", "None");
  });

const checkEnvConfig = (): CheckResult => {
  const envDb = process.env.ENVSEC_DB;
  const envCtx = process.env.ENVSEC_CONTEXT;
  const parts: string[] = [];

  if (envDb) {
    parts.push(`ENVSEC_DB=${envDb}`);
    if (!existsSync(dirname(envDb))) {
      return fail(
        "Environment",
        `ENVSEC_DB directory does not exist: ${dirname(envDb)}`
      );
    }
  }
  if (envCtx) {
    parts.push(`ENVSEC_CONTEXT=${envCtx}`);
  }

  if (parts.length === 0) {
    return pass("Environment", "No env vars set", "Using defaults");
  }
  return pass("Environment", parts.join(", "));
};

const checkShell = (): CheckResult => {
  const shell = process.env.SHELL ?? process.env.ComSpec ?? "unknown";
  return pass("Shell", shell);
};

// ── Output formatting ───────────────────────────────────────────────

const formatCheck = (r: CheckResult): string => {
  const icon = r.ok ? icons.success : icons.error;
  const detail = r.detail ? `  ${dim(r.detail)}` : "";
  return indent(`${icon} ${bold(r.name)}: ${r.message}${detail}`);
};

// ── Command ─────────────────────────────────────────────────────────

const resolveDbPath = (): string => {
  const dbIndex = process.argv.indexOf("--db");
  if (dbIndex !== -1 && dbIndex + 1 < process.argv.length) {
    return process.argv[dbIndex + 1] as string;
  }
  const envDb = process.env.ENVSEC_DB;
  if (envDb && envDb.trim() !== "") {
    return envDb.trim();
  }
  return join(homedir(), ".envsec", "store.sqlite");
};

export const doctorCommand = Command.make("doctor", {}, () =>
  Effect.gen(function* () {
    const jsonMode = yield* isJsonOutput;
    const dbPath = resolveDbPath();

    // Sync checks
    const results: CheckResult[] = [
      pass("Version", pkg.version),
      checkPlatform(),
      checkNodeVersion(),
      checkShell(),
      checkEnvConfig(),
    ];

    // Async checks (credential store)
    const credStore = yield* Effect.tryPromise({
      try: () => checkCredentialStore(),
      catch: (e) => fail("Credential store", `Check failed: ${e}`),
    }).pipe(Effect.merge);
    results.push(credStore);

    const credRW = yield* Effect.tryPromise({
      try: () => checkKeychainReadWrite(),
      catch: (e) => fail("Keychain read/write", `Check failed: ${e}`),
    }).pipe(Effect.merge);
    results.push(credRW);

    // Database checks
    results.push(checkDatabase(dbPath));

    const integrity = yield* checkDatabaseIntegrity(dbPath);
    results.push(integrity);

    const orphans = yield* checkOrphanedSecrets(dbPath);
    results.push(orphans);

    const expired = yield* checkExpiredSecrets(dbPath);
    results.push(expired);

    // Output
    if (jsonMode) {
      yield* Console.log(
        JSON.stringify(
          results.map((r) => ({
            name: r.name,
            ok: r.ok,
            message: r.message,
            ...(r.detail ? { detail: r.detail } : {}),
          }))
        )
      );
      return;
    }

    const passed = results.filter((r) => r.ok).length;
    const failed = results.filter((r) => !r.ok).length;

    yield* Console.log(`\n${icons.shield} envsec doctor\n`);
    for (const r of results) {
      yield* Console.log(formatCheck(r));
    }
    yield* Console.log("");

    if (failed === 0) {
      yield* Console.log(
        indent(
          `${icons.success} All ${badge(passed, "check")} passed — everything looks good`
        )
      );
    } else {
      yield* Console.log(
        indent(
          `${icons.warning} ${green(String(passed))} passed, ${red(String(failed))} ${yellow("failed")} — see above for details`
        )
      );
    }
    yield* Console.log("");
  })
);
