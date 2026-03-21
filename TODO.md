# envsec — Code Review & Improvement Plan

## Bugs

1. **Metadata/keychain desync (secret-store.ts)** — ✅ FIXED. `set()` rolls back the keychain entry if metadata upsert fails. `remove()` restores the keychain entry (with empty value) if metadata delete fails. Compensation logic is in place via `Effect.catchAll` on the metadata operations.

2. **Key validation accepts empty parts (secret-key.ts)** — ✅ FIXED. Added `parts.some((p) => p === "")` check that rejects keys like `"a..b"` with a descriptive error message.

3. **`load` calls `list()` per line (load.ts)** — ✅ FIXED. `SecretStore.list(ctx)` is called once before the loop, results are stored in a `Set<string>` for O(1) existence checks.

4. **Race condition in `env-file` (env-file.ts)** — ✅ FIXED. `SecretNotFoundError` is caught per-secret via `Effect.catchTag`, so a secret deleted between list and get is gracefully skipped instead of crashing.

5. **`searchCommands` wraps pattern with `*...*` (sqlite-metadata-store.ts)** — ✅ FIXED. `searchCommands` now passes the user pattern directly to GLOB, consistent with `search` and `searchContexts`.

6. **`removeCommand` silently succeeds on missing commands (sqlite-metadata-store.ts)** — ✅ FIXED. Checks `db.getRowsModified()` and fails with `CommandNotFoundError` when 0 rows are affected.

7. **`debug` flag parsed manually (main.ts)** — ✅ FIXED. `--debug` / `-d` is defined as `Options.boolean` in `root.ts`. No manual `process.argv.includes` parsing remains in `main.ts`.

## Security

8. **Secrets visible in process lists (resolve-command.ts, run.ts, cmd.ts)** — ✅ FIXED. Secrets are passed via environment variables (`ENVSEC_N_KEY`) instead of being interpolated into the command string. `run.ts` and `cmd.ts` merge `resolved.env` into `execSync`'s env option. Secrets no longer appear in `ps aux` output.

9. **No shell escaping in command execution (run.ts, cmd.ts)** — ✅ FIXED (via #8). Secret values are no longer interpolated into the command string at all — they're passed as environment variables. The command string itself still runs through `execSync` with a shell, but secret values cannot cause injection.

10. **Incomplete PowerShell escaping (windows-credential-manager-access.ts)** — ✅ FIXED. `escapePS` now handles single quotes (`'` → `''`), backticks (`` ` `` → ` `` `` `), dollar signs (`$` → `` `$ ``), double quotes (`"` → `` `" ``), and strips null bytes. This covers the main PowerShell metacharacters.

11. **SQLite database without file permissions (sqlite-metadata-store.ts)** — ✅ FIXED. Directory `~/.envsec/` is created with `0o700` and `chmod`'d. The database file is written with `{ mode: 0o600 }` via `writeFileSync`.

12. **Context names not validated** — ✅ FIXED. `ContextName` schema in `context-name.ts` validates against a strict regex (`^[a-zA-Z0-9]([a-zA-Z0-9._-]*[a-zA-Z0-9])?$`), rejects path separators, reserved names (`.`, `..`, `__proto__`, etc.), and enforces a 128-char max length.

## Performance

13. **N+1 problem in `env-file` (env-file.ts)** — ✅ FIXED. Uses `Effect.forEach` with `{ concurrency: 10 }` to fetch secrets in parallel instead of sequentially.

14. **`load` calls `list()` inside loop (load.ts)** — ✅ FIXED (same as bug #3). Single call before the loop, `Set` for lookups.

15. **SQLite persisted on every single write (sqlite-metadata-store.ts)** — ✅ FIXED. Batch mode implemented via `beginBatch()` / `endBatch()` on `MetadataStore`. When batching is active, `maybePersist()` sets a dirty flag instead of writing. `endBatch()` persists once if dirty. The `load` command supports `--batch` flag to use this.

16. **sql.js is WASM-based** — OPEN (by design). sql.js (SQLite compiled to WASM) adds startup overhead vs better-sqlite3 (native bindings). Trade-off: sql.js has zero native dependencies, simplifying cross-platform distribution. Migration to better-sqlite3 would improve performance but add native compilation requirements.

## UX

17. **Repeated `--context` boilerplate** — ✅ FIXED. `requireContext` and `optionalContext` helpers in `root.ts` centralize context resolution. They also support `ENVSEC_CONTEXT` env var as fallback, so users don't need `--context` on every invocation.

18. **`env-file` doesn't quote values (env-file.ts)** — ✅ FIXED. Values are wrapped in double quotes with proper escaping of `\`, `"`, and newlines (`\n`).

19. **`load` doesn't handle quoted multiline values** — OPEN. `parseLine` strips surrounding quotes but doesn't handle multiline values (common in .env files for certificates/keys). Lines are split on `\n` before parsing, so multiline values are truncated.

20. **No confirmation on destructive operations** — ✅ FIXED. `delete` and `del` commands now have a `--yes` / `-y` flag. Without it, they prompt for `[y/N]` confirmation before removing a secret.

21. **`readSecret` shows no masking feedback (add.ts)** — ✅ FIXED. `readSecret` now uses raw mode and writes `*` for each character typed, with backspace support.

22. **Missing `--format` option for `get`** — ✅ FIXED. `--json` flag added to the root command. `get` outputs `{"context", "key", "value"}` JSON when `--json` is set. `list` and `search` also support JSON output.

23. **`list` doesn't show secret count with `--context`** — OPEN. When listing secrets for a specific context, only individual secrets are shown without a summary count line.

---

## Implementation Plan

### Phase 1 — Bug & Security Fixes
- [x] Shell escaping for secret interpolation in `resolveCommand` — secrets passed via env vars, not interpolated
- [x] Validate empty key parts in `secret-key.ts`
- [x] Validate context names (alphanumeric, dots, hyphens, underscores)
- [x] Set restrictive file permissions on `~/.envsec/` (0o700) and `store.sqlite` (0o600)
- [x] Compensation logic in `SecretStore.set/remove` for partial failures
- [x] Fix `removeCommand` to check rows modified
- [x] Improve PowerShell escaping for backtick, `$`, `"`, and null bytes

### Phase 2 — Performance
- [x] Fetch secret list once in `load`, not per-line
- [x] Use `Effect.forEach` with concurrency in `env-file` export
- [x] Batch `persist()` calls — persist once at end of bulk operations via `beginBatch/endBatch`
- [ ] Add `--batch` mode awareness to other bulk operations (e.g. future `import` command)

### Phase 3 — UX
- [x] Extract context requirement into shared `requireContext` / `optionalContext` utilities
- [x] Quote values in env-file output with proper escaping
- [x] Add `*` masking in `readSecret`
- [x] Add `--yes` / `-y` flag for destructive operations (delete, del)
- [x] Fix search pattern consistency (searchCommands no longer auto-wraps with `*...*`)
- [x] Add `--json` flag for structured output (get, list, search)
- [x] Add `ENVSEC_CONTEXT` env var as alternative to `--context`
- [x] Integrate `--debug` flag into Effect/CLI framework
- [ ] Add summary count line when listing secrets with `--context`
- [ ] Handle quoted multiline values in `load` parser

### Phase 4 — Architecture
- [x] Eliminate secret value injection risk — secrets passed via env vars, `execSync` still used for command itself
- [ ] Evaluate migration from sql.js to better-sqlite3 for performance (trade-off: adds native dependency)

---

## New Features

### Custom Database Path
- [ ] Add `--db <path>` global option (and `ENVSEC_DB` env var) to specify an alternative SQLite database file instead of the default `~/.envsec/store.sqlite`
- Use cases: per-project databases, team-shared databases on network drives, CI/CD with ephemeral storage
- Implementation: pass the path through to `SqliteMetadataStore` via an Effect layer config, fall back to default when unset

### Directory-Aware Environment (direnv-style)
- [ ] `envsec watch` — monitor the current directory and automatically:
  - Generate a `.env` file (or export env vars) when entering a directory that has an `.envsec.json` config
  - Clean up (remove `.env` or unset vars) when leaving the directory
- [ ] `.envsec.json` project config file — declare which context to use for a given project directory:
  ```json
  {
    "context": "myapp.dev",
    "output": ".env",
    "autoClean": true
  }
  ```
- [ ] `envsec hook install` — install shell hooks (bash, zsh, fish) that trigger context loading/unloading on `cd`, similar to direnv
- [ ] `envsec exec <command>` — run a command with secrets injected as environment variables (no file written to disk), e.g. `envsec exec -c myapp.dev -- node server.js`

### Secret Injection via Environment Variables
- [ ] `envsec env` — export all secrets for a context as environment variables to stdout (for `eval $(envsec env -c myapp.dev)` usage)
- [ ] `envsec env --shell <bash|zsh|fish|powershell>` — output in the correct syntax for the target shell
- [ ] `envsec env --unset` — output unset/remove commands to clean up previously exported variables

### Import/Export
- [ ] `envsec export -c <ctx> -o secrets.enc` — export all secrets for a context to an encrypted file (for backup, migration, or sharing)
- [ ] `envsec import -c <ctx> -i secrets.enc` — import secrets from an encrypted export file
- [ ] Support for importing from other secret managers (e.g. `envsec import --from-doppler`, `--from-vault`)

### Secret Rotation & Expiry
- [ ] `envsec set <key> --expires <duration>` — attach a TTL to a secret, warn or block when expired
- [ ] `envsec audit` — list secrets that are expired, about to expire, or haven't been rotated in a configurable period
- [ ] Store `expires_at` in metadata table for tracking

### Multi-Context Operations
- [ ] `envsec copy -c source.ctx -t target.ctx [pattern]` — copy secrets between contexts (e.g. staging → production)
- [ ] `envsec diff -c ctx1 -t ctx2` — show which keys exist in one context but not the other, or have different values

### Team & Sharing
- [ ] `envsec share -c <ctx> --encrypt-to <gpg-key>` — export a context encrypted for a specific team member
- [ ] `envsec sync` — sync secrets with a remote backend (e.g. S3 + KMS, Git-crypt repo) for team sharing

### Developer Experience
- [ ] `envsec init` — interactive setup wizard that creates `.envsec.json` in the current project, sets up context, and optionally installs shell hooks
- [ ] `envsec doctor` — diagnose common issues (keychain access, permissions, missing tools like `secret-tool` on Linux)
- [ ] `envsec completion <shell>` — generate shell completion scripts for bash, zsh, fish
- [ ] `envsec history -c <ctx> <key>` — show when a secret was created, last updated (from metadata timestamps)
