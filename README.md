# secenv

Secure environment secrets management using native OS credential stores.

## Features

- Store secrets in your OS native credential store (not plain text files)
- Cross-platform: macOS, Linux, Windows
- Organize secrets by environment (dev, staging, prod, etc.)
- Track secret types (string, number, boolean) and metadata via SQLite
- Search secrets with glob patterns
- Run commands with secret interpolation
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
npm install -g secenv
```

```bash
npx secenv
```

## Usage

All commands require an environment specified with `--env` (or `-e`):

### Add a secret

```bash
# Store a string
secenv -e dev add api.key --word "sk-abc123"

# Store a number
secenv -e dev add server.port --digit 3000

# Store a boolean
secenv -e dev add feature.enabled --bool
```

### Get a secret

```bash
secenv -e dev get api.key
```

### List all secrets

```bash
secenv -e dev list
```

### Search secrets

```bash
secenv -e dev search "api.*"
```

### Generate a .env file

```bash
# Creates .env with all secrets from the environment
secenv -e dev env-file

# Specify a custom output path
secenv -e dev env-file --output .env.local
```

Keys are converted to `UPPER_SNAKE_CASE` (e.g. `api.token` → `API_TOKEN`).

### Load secrets from a .env file

```bash
# Import secrets from .env into the environment
secenv -e dev load

# Specify a custom input file
secenv -e dev load --input .env.local

# Overwrite existing secrets without warning
secenv -e dev load --force
```

Keys are converted from `UPPER_SNAKE_CASE` to `dotted.lowercase` (e.g. `API_TOKEN` → `api.token`). If a key already exists, it is skipped with a warning unless `--force` (`-f`) is provided.

### Run a command with secrets

```bash
# Placeholders {key} are resolved with secret values before execution
secenv -e dev run 'curl {api.url} -H "Authorization: Bearer {api.token}"'

# Any {dotted.key} in the command string is replaced with its value
secenv -e prod run 'psql {db.connection_string}'
```

### Delete a secret

```bash
secenv -e dev delete api.key

# or use the alias
secenv -e dev del api.key
```

## How it works

Secrets are stored in the native OS credential store. The backend is selected automatically based on the platform:

| OS      | Backend                        | Tool / API                          |
|---------|--------------------------------|-------------------------------------|
| macOS   | Keychain                       | `security` CLI                      |
| Linux   | Secret Service API (D-Bus)     | `secret-tool` (libsecret)           |
| Windows | Credential Manager             | `cmdkey` + PowerShell (advapi32)    |

Metadata (key names, types, timestamps) is kept in a SQLite database at `~/.secenv/store.sqlite`. Keys must contain at least one dot separator (e.g., `service.account`) which maps to the credential store's service/account structure.

## License

MIT
