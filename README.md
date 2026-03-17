# secenv

Secure environment secrets management for macOS using the native Keychain.

## Features

- Store secrets in macOS Keychain (not plain text files)
- Organize secrets by environment (dev, staging, prod, etc.)
- Track secret types (string, number, boolean) and metadata via SQLite
- Search secrets with glob patterns
- Run commands with secret interpolation
- Export secrets to `.env` files

## Requirements

- macOS
- Node.js >= 18

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

Secrets are stored in the macOS Keychain using the `security` command-line tool. Metadata (key names, types, timestamps) is kept in a SQLite database at `~/.secenv/store.sqlite`. Keys must contain at least one dot separator (e.g., `service.account`) which maps to the Keychain service/account structure.

## License

MIT
