# envsec

Secure environment secrets management using native OS credential stores.

## Features

- Store secrets in your OS native credential store (not plain text files)
- Cross-platform: macOS, Linux, Windows
- Organize secrets by context (e.g. `myapp.dev`, `stripe-api.prod`, `work.staging`)
- Track secret metadata (key names, timestamps) via SQLite
- Search contexts and secrets with glob patterns
- Run commands with secret interpolation
- Save and rerun commands with `cmd` (search, list, run, delete)
- Export secrets to `.env` files
- Load secrets from `.env` files (with conflict detection)

## Requirements

- Node.js >= 18

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

```bash
npm install -g envsec
```

```bash
npx envsec
```

## Usage

Most commands require a context specified with `--context` (or `-c`).
A context is a free-form label for grouping secrets — e.g. `myapp.dev`, `stripe-api.prod`, `work.staging`.

### Add a secret

```bash
# Store a value inline
envsec -c myapp.dev add api.key --value "sk-abc123"

# Or use the short alias
envsec -c myapp.dev add api.key -v "sk-abc123"

# Omit --value for an interactive masked prompt
envsec -c myapp.dev add api.key
```

### Get a secret

```bash
envsec -c myapp.dev get api.key
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

### Generate a .env file

```bash
# Creates .env with all secrets from the context
envsec -c myapp.dev env-file

# Specify a custom output path
envsec -c myapp.dev env-file --output .env.local
```

Keys are converted to `UPPER_SNAKE_CASE` (e.g. `api.token` → `API_TOKEN`).

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

### Delete a secret

```bash
envsec -c myapp.dev delete api.key

# or use the alias
envsec -c myapp.dev del api.key
```

## How it works

Secrets are stored in the native OS credential store. The backend is selected automatically based on the platform:

| OS      | Backend                        | Tool / API                          |
|---------|--------------------------------|-------------------------------------|
| macOS   | Keychain                       | `security` CLI                      |
| Linux   | Secret Service API (D-Bus)     | `secret-tool` (libsecret)           |
| Windows | Credential Manager             | `cmdkey` + PowerShell (advapi32)    |

Metadata (key names, timestamps) is kept in a SQLite database at `~/.envsec/store.sqlite`. Keys must contain at least one dot separator (e.g., `service.account`) which maps to the credential store's service/account structure.

## License

MIT
