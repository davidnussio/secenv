# envsec

Secure environment secrets management using native OS credential stores.

## Demo

<!-- https://github.com/user-attachments/assets/ce744e1f-7a6f-4571-8bdc-9dc63cf42ed8 -->

![Image](https://raw.githubusercontent.com/davidnussio/envsec/328e0773aad6a4c10f399f40f1a750904df334c3/assets/terminal-1.gif)

## Features

- Store secrets in your OS native credential store (not plain text files)
- Cross-platform: macOS, Linux, Windows
- Organize secrets by context (e.g. `myapp.dev`, `stripe-api.prod`, `work.staging`)
- Track secret metadata (key names, timestamps) via SQLite
- Search contexts and secrets with glob patterns
- Run commands with secret interpolation
- Save and rerun commands with `cmd` (search, list, run, delete)
- Export secrets to `.env` files (with generation tracking via `audit`)
- Export secrets as shell environment variables (`eval $(envsec env)`)
- Load secrets from `.env` files (with conflict detection)
- Share secrets encrypted with GPG for team members

## Requirements

- Node.js >= 22

### macOS

No extra dependencies. Uses the built-in Keychain via the `security` CLI tool.

### Linux

Requires `libsecret-tools` (provides the `secret-tool` command), which talks to GNOME Keyring, KDE Wallet, or any Secret Service API provider via D-Bus.

```bash
# Debian / Ubuntu
sudo apt install libsecret-tools

# Fedora
sudo dnf install libsecret

# Arch
sudo pacman -S libsecret
```

A running D-Bus session and a keyring daemon (e.g. `gnome-keyring-daemon`) must be active. Most desktop environments handle this automatically.

### Windows

No extra dependencies. Uses the built-in Windows Credential Manager via `cmdkey` and PowerShell.

## Installation

### Homebrew (macOS / Linux)

```bash
brew tap davidnussio/homebrew-tap
brew install envsec
```

### npm

```bash
npm install -g envsec
```

### npx (no install)

```bash
npx envsec
```

### mise

```bash
mise use -g npm:envsec
```

## Usage

Most commands require a context specified with `--context` (or `-c`).
A context is a free-form label for grouping secrets — e.g. `myapp.dev`, `stripe-api.prod`, `work.staging`.

### Custom database path

By default, metadata is stored at `~/.envsec/store.sqlite`. You can override this with `--db` or the `ENVSEC_DB` environment variable:

```bash
# Use a project-local database
envsec --db ./local-store.sqlite -c myapp.dev list

# Or via environment variable
export ENVSEC_DB=/shared/team/envsec.sqlite
envsec -c myapp.dev list
```

The `--db` flag takes precedence over `ENVSEC_DB`. Use cases include per-project databases, team-shared databases on network drives, and CI/CD with ephemeral storage.

### Add a secret

```bash
# Store a value inline
envsec -c myapp.dev add api.key --value "sk-abc123"

# Or use the short alias
envsec -c myapp.dev add api.key -v "sk-abc123"

# Omit --value for an interactive masked prompt
envsec -c myapp.dev add api.key

# Set an expiry duration with --expires (-e)
envsec -c myapp.dev add api.key -v "sk-abc123" --expires 30d

# Supported duration units: m (minutes), h (hours), d (days), w (weeks), mo (months), y (years)
# Combinable: 1y6mo, 2w3d, 1d12h
envsec -c myapp.dev add api.key -v "sk-abc123" -e 6mo
```

### Get a secret

```bash
envsec -c myapp.dev get api.key

# Print only the raw value (no warnings or extra output)
envsec -c myapp.dev get api.key --quiet
envsec -c myapp.dev get api.key -q
```

### Delete a secret

```bash
envsec -c myapp.dev delete api.key

# or use the alias
envsec -c myapp.dev del api.key
```

### Rename a secret

Rename a secret key within the same context. The value and expiry metadata are preserved.

```bash
# Rename a key
envsec -c myapp.dev rename old.key new.key

# Overwrite target if it already exists
envsec -c myapp.dev rename old.key existing.key --force
```

### List all secrets in a context

```bash
envsec -c myapp.dev list
```

### List all contexts

```bash
# Without --context, lists all available contexts with secret counts
envsec list
```

### Search secrets

```bash
# Search secrets within a context
envsec -c myapp.dev search "api.*"

# Search contexts by pattern (without --context)
envsec search "myapp.*"
```

### Move secrets between contexts

Move secrets from one context to another. The source secrets are removed after moving.

```bash
# Move a single secret
envsec -c myapp.dev move api.token --to myapp.prod

# Move secrets matching a glob pattern
envsec -c myapp.dev move "redis.*" --to myapp.prod -y

# Move all secrets from one context to another
envsec -c myapp.dev move --all --to myapp.prod -y

# Overwrite existing secrets in the target context
envsec -c myapp.dev move "redis.*" --to myapp.prod --force -y
```

### Copy secrets between contexts

Copy secrets from one context to another. The source secrets remain intact.

```bash
# Copy a single secret
envsec -c myapp.dev copy api.token --to myapp.staging

# Copy secrets matching a glob pattern
envsec -c myapp.dev copy "redis.*" --to myapp.staging -y

# Copy all secrets from one context to another
envsec -c myapp.dev copy --all --to myapp.staging -y

# Overwrite existing secrets in the target context
envsec -c myapp.dev copy "redis.*" --to myapp.staging --force -y
```

### Run a command with secrets

```bash
# Placeholders {key} are resolved with secret values before execution
envsec -c myapp.dev run 'curl {api.url} -H "Authorization: Bearer {api.token}"'

# Any {dotted.key} in the command string is replaced with its value
envsec -c myapp.prod run 'psql {db.connection_string}'

# Save the command for later use with --save (-s) and --name (-n)
envsec -c myapp.dev run --save --name deploy 'kubectl apply -f - <<< {k8s.manifest}'

# If you use --save without --name, you'll be prompted interactively
envsec -c myapp.dev run --save 'psql {db.connection_string}'
```

If any placeholder references a secret that doesn't exist, the command won't execute and you'll see a clear error:

```
❌ Missing secrets in context "myapp.dev":
  - api.url
  - api.token

Add them with: envsec -c myapp.dev add <key>
```

### Saved commands

Saved commands live under the `cmd` subcommand, keeping them separate from secret operations.

```bash
# List all saved commands
envsec cmd list

# Run a saved command (uses the context it was saved with)
envsec cmd run deploy

# Run quietly (suppress informational output like "Resolved N secret(s)")
envsec cmd run deploy --quiet
envsec cmd run deploy -q

# Override the context at execution time
envsec cmd run deploy --override-context myapp.prod
envsec cmd run deploy -o myapp.prod

# Search saved commands (searches both names and command strings)
envsec cmd search psql

# Search only by name
envsec cmd search deploy -n

# Search only by command string
envsec cmd search kubectl -m

# Delete a saved command
envsec cmd delete deploy
```

### Generate a .env file

```bash
# Creates .env with all secrets from the context
envsec -c myapp.dev env-file

# Specify a custom output path
envsec -c myapp.dev env-file --output .env.local
```

Keys are converted to `UPPER_SNAKE_CASE` (e.g. `api.token` → `API_TOKEN`).

### Export secrets as environment variables

```bash
# Output export statements for eval (bash/zsh)
eval $(envsec -c myapp.dev env)

# Specify target shell syntax
envsec -c myapp.dev env --shell fish
envsec -c myapp.dev env --shell powershell

# Output unset commands to clean up exported variables
eval $(envsec -c myapp.dev env --unset)

# Combine shell and unset
envsec -c myapp.dev env --unset --shell fish
```

Supported shells: `bash` (default), `zsh`, `fish`, `powershell`. Keys are converted to `UPPER_SNAKE_CASE` (e.g. `api.token` → `API_TOKEN`). Output goes to stdout so it can be piped to `eval` or sourced directly — no file is written to disk.

### Load secrets from a .env file

```bash
# Import secrets from .env into the context
envsec -c myapp.dev load

# Specify a custom input file
envsec -c myapp.dev load --input .env.local

# Overwrite existing secrets without warning
envsec -c myapp.dev load --force
```

Keys are converted from `UPPER_SNAKE_CASE` to `dotted.lowercase` (e.g. `API_TOKEN` → `api.token`). If a key already exists, it is skipped with a warning unless `--force` (`-f`) is provided.

### Share secrets (GPG encrypted)

```bash
# Encrypt all secrets from a context for a team member
envsec -c myapp.dev share --encrypt-to alice@example.com

# Save encrypted output to a file
envsec -c myapp.dev share --encrypt-to alice@example.com -o secrets.enc

# Use JSON format inside the encrypted payload
envsec -c myapp.dev --json share --encrypt-to alice@example.com -o secrets.enc
```

The recipient can decrypt with `gpg --decrypt secrets.enc` and pipe the result into `envsec load`. By default the encrypted payload uses `.env` format (`KEY="value"`); with `--json` it uses a structured JSON object. Requires GPG to be installed and the recipient's public key to be in your keyring.

### Audit secrets for expiry

```bash
# Check for expired or expiring secrets in a context (default window: 30 days)
envsec -c myapp.dev audit

# Specify a custom window
envsec -c myapp.dev audit --within 7d

# Show only already-expired secrets
envsec -c myapp.dev audit --within 0d

# Audit across all contexts (omit --context)
envsec audit

# JSON output
envsec -c myapp.dev audit --json
```

Secrets with an `--expires` duration set via `envsec add` are tracked in metadata. The `audit` command scans for secrets that are already expired or will expire within the specified window. The `get` and `list` commands also display expiry warnings inline.

The `audit` command also tracks generated `.env` files. Every time `env-file` is used, the output path, context, and timestamp are recorded. The audit output includes a second section listing these files. If a tracked `.env` file no longer exists on disk, audit automatically removes it from the metadata and reports the cleanup.

### Diagnose your setup

```bash
# Run all health checks
envsec doctor

# JSON output for scripting
envsec --json doctor
```

The `doctor` command verifies your envsec installation is working correctly. It checks:
- Platform support and Node.js version
- Credential store availability (macOS Keychain, Linux secret-tool, Windows cmdkey)
- Keychain read/write access
- Database path, permissions, and schema integrity
- Orphaned secrets (metadata without keychain entry)
- Expired secrets
- Environment variables (`ENVSEC_DB`, `ENVSEC_CONTEXT`)
- Current shell

### Shell completions

envsec supports dynamic tab completion for bash, zsh, and fish. Completions are context-aware: they suggest your actual context names, secret keys, and saved command names in real time by querying the metadata database.

```bash
# Bash (add to ~/.bashrc)
eval "$(envsec --completions bash)"

# Zsh (add to ~/.zshrc)
eval "$(envsec --completions zsh)"

# Fish (add to ~/.config/fish/config.fish)
envsec --completions fish | source
```

What gets completed dynamically:
- `--context` / `-c` — lists all your contexts
- Secret key arguments (`get`, `add`, `delete`) — lists keys for the current context
- `cmd run` / `cmd delete` — lists saved command names
- `--override-context` / `-o` — lists contexts for `cmd run`
- Subcommands, flags, and static choices (shells, etc.) are also completed

## How it works

Secrets are stored in the native OS credential store. The backend is selected automatically based on the platform:

| OS      | Backend                        | Tool / API                          |
|---------|--------------------------------|-------------------------------------|
| macOS   | Keychain                       | `security` CLI                      |
| Linux   | Secret Service API (D-Bus)     | `secret-tool` (libsecret)           |
| Windows | Credential Manager             | `cmdkey` + PowerShell (advapi32)    |

Metadata (key names, timestamps) is kept in a SQLite database at `~/.envsec/store.sqlite` (configurable via `--db` or `ENVSEC_DB`). Keys must contain at least one dot separator (e.g., `service.account`) which maps to the credential store's service/account structure.

## Security

envsec is built around a simple principle: your secrets belong in your OS, not in dotfiles. Every design decision starts from that foundation.

### How envsec protects your secrets

**OS-native encryption, zero custom crypto.** Secret values are stored directly in macOS Keychain, GNOME Keyring / KDE Wallet, or Windows Credential Manager. envsec never invents its own encryption — it delegates to the battle-tested credential stores your operating system already provides, protected by your user session and (on macOS) the login keychain.

**Full Unicode support.** Secret values can contain any Unicode characters, including emoji and accented letters. Values are base64-encoded before being stored in the OS credential store, avoiding platform-specific encoding quirks (e.g. macOS `security` CLI hex-encoding non-ASCII output). Legacy plaintext secrets are read transparently for backward compatibility.

**Secrets never touch disk as plaintext.** Values go straight from your terminal into the OS credential store. They are never written to config files, logs, or intermediate storage.

**No secrets in terminal output.** The `list` and `search` commands display key names only — values are never printed. This keeps secrets out of scrollback buffers, screen recordings, and shoulder-surfing range.

**Safe command execution.** The `run` command injects secrets as environment variables of the child process rather than interpolating them into the command string. This means secret values don't appear in `ps` output or shell history. If any referenced secret is missing, the command is blocked entirely — no partial execution with incomplete credentials.

**Input validation and injection prevention.** Context names are validated against a strict allowlist (alphanumeric, dots, hyphens, underscores) with path traversal and prototype pollution checks. All SQLite queries use prepared statements with bind parameters, preventing SQL injection. PowerShell arguments on Windows are escaped to guard against command injection.

**Restrictive file permissions.** The metadata directory (`~/.envsec/`) is created with `0700` permissions and the SQLite database with `0600`, limiting access to the owning user.

### Known limitations and areas for improvement

We believe in being upfront about what envsec does not yet cover. These are real trade-offs, not bugs — and understanding them helps you make informed decisions.

**Metadata is visible.** The SQLite database at `~/.envsec/store.sqlite` stores key names, context names, and timestamps — never secret values, but enough to reveal *what* secrets exist. Saved command templates (with `{key}` placeholders) are also stored there. If metadata confidentiality matters to you, ensure your home directory is on an encrypted volume.

**`env-file` exports are plaintext.** The `env-file` command writes secret values to a `.env` file on disk. This is inherently sensitive — treat the output file accordingly and never commit it to version control. Consider it a convenience bridge, not a storage mechanism.

**Shell execution carries inherent risk.** The `run` command passes your command template through `/bin/sh` (or `cmd.exe` on Windows). If the template itself comes from untrusted input, shell injection is possible. Only run command templates you wrote or trust.

**No cross-context access control.** Any process running as your OS user can read all secrets across all contexts. envsec relies on OS-level user isolation — it does not add its own authorization layer between contexts.

**Linux headless environments.** On Linux, envsec depends on an active D-Bus session and a keyring daemon (e.g. `gnome-keyring-daemon`). In containers or headless servers without a graphical session, the keyring may be unavailable or may store secrets with weaker protection.

**Encryption depends on your OS.** envsec adds no additional at-rest encryption beyond what the native credential store provides. On systems without full-disk encryption, an attacker with physical access could potentially extract secrets from the keychain. We recommend enabling full-disk encryption (FileVault, LUKS, BitLocker) for the strongest protection.

## Development

### Prerequisites

- Node.js >= 24
- pnpm

### Setup

```bash
git clone https://github.com/davidnussio/envsec.git
cd envsec
pnpm install
pnpm run build
```

### Common commands

```bash
# Build TypeScript to dist/
pnpm run build

# Lint and format check
pnpm exec ultracite check

# Auto-fix lint and formatting
pnpm exec ultracite fix
```

### Running locally without installing

Create a temporary alias to use the local build as if it were installed globally:

```bash
# Bash / Zsh
alias envsec="node $(pwd)/dist/main.js"

# Fish
alias envsec "node (pwd)/dist/main.js"
```

### Testing shell completions locally

After building and setting up the alias, load the completions in your current session:

```bash
# Bash
alias envsec="node $(pwd)/dist/main.js"
eval "$(envsec --completions bash)"

# Zsh
alias envsec="node $(pwd)/dist/main.js"
eval "$(envsec --completions zsh)"

# Fish
alias envsec "node (pwd)/dist/main.js"
envsec --completions fish | source
```

Then press TAB after `envsec -c ` to see your contexts, or after `envsec -c myapp.dev get ` to see secret keys.

### Running tests

End-to-end integration tests cover the full CLI lifecycle (add, get, list, search, env-file, load, delete, run, cmd, audit, share, completions).

```bash
# Build first
pnpm run build

# macOS / Linux
bash test/e2e-test.sh

# Windows (PowerShell)
pwsh test/e2e-test.ps1
```

CI runs automatically on push/PR to `main` via GitHub Actions, executing `e2e-test.sh` on macOS and Ubuntu, and `e2e-test.ps1` on Windows.

## License

MIT
