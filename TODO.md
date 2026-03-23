# envsec — Code Review & Improvement Plan

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
- [x] Add summary count line when listing secrets with `--context`
- [ ] Handle quoted multiline values in `load` parser

### Phase 4 — Architecture
- [x] Eliminate secret value injection risk — secrets passed via env vars, `execSync` still used for command itself
- [ ] Evaluate migration from sql.js to libSQL for performance (trade-off: adds native dependency)

---

## New Features

### Custom Database Path
- [x] Add `--db <path>` global option (and `ENVSEC_DB` env var) to specify an alternative SQLite database file instead of the default `~/.envsec/store.sqlite`
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
23. **`list` doesn't show secret count with `--context`** — ✅ FIXED. A summary line like `📊 3 secrets in myapp.dev` is printed after listing secrets for a context.
  ```
- [ ] `envsec hook install` — install shell hooks (bash, zsh, fish) that trigger context loading/unloading on `cd`, similar to direnv
- [ ] `envsec exec <command>` — run a command with secrets injected as environment variables (no file written to disk), e.g. `envsec exec -c myapp.dev -- node server.js`

### Secret Injection via Environment Variables
- [x] `envsec env` — export all secrets for a context as environment variables to stdout (for `eval $(envsec env -c myapp.dev)` usage)
- [x] `envsec env --shell <bash|zsh|fish|powershell>` — output in the correct syntax for the target shell
- [x] `envsec env --unset` — output unset/remove commands to clean up previously exported variables

### Import/Export
- [ ] `envsec export -c <ctx> -o secrets.enc` — export all secrets for a context to an encrypted file (for backup, migration, or sharing)
- [ ] `envsec import -c <ctx> -i secrets.enc` — import secrets from an encrypted export file
- [ ] Support for importing from other secret managers (e.g. `envsec import --from-doppler`, `--from-vault`)

### Secret Rotation & Expiry
- [x] `envsec set <key> --expires <duration>` — attach a TTL to a secret, warn or block when expired
- [x] `envsec audit` — list secrets that are expired, about to expire, or haven't been rotated in a configurable period
- [x] Store `expires_at` in metadata table for tracking

### Multi-Context Operations
- [ ] `envsec copy -c source.ctx -t target.ctx [pattern]` — copy secrets between contexts (e.g. staging → production)
- [ ] `envsec diff -c ctx1 -t ctx2` — show which keys exist in one context but not the other, or have different values

### Team & Sharing
- [x] `envsec share -c <ctx> --encrypt-to <gpg-key>` — export a context encrypted for a specific team member
- [ ] `envsec sync` — sync secrets with a remote backend (e.g. S3 + KMS, Git-crypt repo) for team sharing

### Developer Experience
- [ ] `envsec init` — interactive setup wizard that creates `.envsec.json` in the current project, sets up context, and optionally installs shell hooks
- [x] Add summary count line when listing secrets with `--context`ermissions, missing tools like `secret-tool` on Linux)
- [x] `envsec completion <shell>` — generate shell completion scripts for bash, zsh, fish
- [ ] `envsec history -c <ctx> <key>` — show when a secret was created, last updated (from metadata timestamps)
