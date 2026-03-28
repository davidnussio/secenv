"use client";

import { CodeBlock } from "./code-block";

function Section({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <section className="mb-16 scroll-mt-20" id={id}>
      {children}
    </section>
  );
}

function H2({ children }: { children: React.ReactNode }) {
  return <h2 className="mb-4 font-bold text-2xl tracking-tight">{children}</h2>;
}

function H3({ children }: { children: React.ReactNode }) {
  return <h3 className="mt-8 mb-3 font-semibold text-lg">{children}</h3>;
}

function P({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-4 text-muted-foreground leading-relaxed">{children}</p>
  );
}

function Mono({ children }: { children: React.ReactNode }) {
  return (
    <code className="rounded bg-white/5 px-1.5 py-0.5 font-mono text-emerald-400 text-sm">
      {children}
    </code>
  );
}

export function DocsContent() {
  return (
    <article className="max-w-3xl">
      <h1 className="mb-2 font-bold text-4xl tracking-tight">Documentation</h1>
      <p className="mb-12 text-lg text-muted-foreground">
        Everything you need to manage secrets with envsec.
      </p>

      {/* Getting Started */}
      <Section id="installation">
        <H2>Installation</H2>
        <H3>Homebrew (macOS / Linux)</H3>
        <CodeBlock
          code={"brew tap davidnussio/homebrew-tap\nbrew install envsec"}
        />
        <H3>npm</H3>
        <P>Requires Node.js 20 or later.</P>
        <CodeBlock code="npm install -g envsec" />
        <P>Or run directly without installing:</P>
        <CodeBlock code="npx envsec" />
        <H3>mise</H3>
        <CodeBlock code="mise use -g npm:envsec" />
      </Section>

      <Section id="quick-start">
        <H2>Quick Start</H2>
        <P>
          Store your first secret. The <Mono>-c</Mono> flag sets the context — a
          label for grouping related secrets.
        </P>
        <CodeBlock
          code={`# Store a secret
envsec -c myapp.dev add api.key -v "sk-abc123"

# Retrieve it
envsec -c myapp.dev get api.key

# List all secrets in the context
envsec -c myapp.dev list

# Run a command with secret interpolation
envsec -c myapp.dev run 'curl -H "Auth: {api.key}" https://api.example.com'`}
        />
        <div className="mt-4 flex items-center gap-3 rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-4 py-3">
          <span aria-hidden="true" className="shrink-0 text-emerald-400">
            ℹ
          </span>
          <p className="text-muted-foreground text-sm leading-relaxed">
            Set up{" "}
            <a
              className="text-emerald-400 underline underline-offset-2 hover:text-emerald-300"
              href="#shell-completions"
            >
              shell completions
            </a>{" "}
            and unlock the full power of tab. It&apos;s over 9000 times better —
            trust us, your fingers will thank you.
          </p>
        </div>
      </Section>

      <Section id="requirements">
        <H2>Requirements</H2>
        <H3>macOS</H3>
        <P>
          No extra dependencies. Uses the built-in Keychain via the security CLI
          tool.
        </P>
        <H3>Linux</H3>
        <P>
          Requires <Mono>libsecret-tools</Mono> (provides the{" "}
          <Mono>secret-tool</Mono> command), which talks to GNOME Keyring, KDE
          Wallet, or any Secret Service API provider via D-Bus.
        </P>
        <CodeBlock
          code={`# Debian / Ubuntu
sudo apt install libsecret-tools

# Fedora
sudo dnf install libsecret

# Arch
sudo pacman -S libsecret`}
        />
        <H3>Windows</H3>
        <P>
          No extra dependencies. Uses the built-in Windows Credential Manager
          via cmdkey and PowerShell.
        </P>
      </Section>

      {/* Commands */}
      <Section id="add">
        <H2>envsec add</H2>
        <P>Store a secret in the OS credential store.</P>
        <CodeBlock
          code={`# Inline value
envsec -c myapp.dev add api.key --value "sk-abc123"

# Interactive masked prompt (omit --value)
envsec -c myapp.dev add api.key

# With expiry duration
envsec -c myapp.dev add api.key -v "sk-abc123" --expires 30d

# Supported units: m (minutes), h (hours), d (days),
# w (weeks), mo (months), y (years)
# Combinable: 1y6mo, 2w3d, 1d12h
envsec -c myapp.dev add api.key -v "sk-abc123" -e 6mo`}
        />
      </Section>

      <Section id="get">
        <H2>envsec get</H2>
        <P>Retrieve a single secret value.</P>
        <CodeBlock
          code={`envsec -c myapp.dev get api.key

# Print only the raw value (no warnings or extra output)
envsec -c myapp.dev get api.key --quiet
envsec -c myapp.dev get api.key -q`}
        />
        <P>
          Use <Mono>--quiet</Mono> (<Mono>-q</Mono>) for scripting — it
          suppresses expiry warnings and outputs only the secret value.
        </P>
      </Section>

      <Section id="delete">
        <H2>envsec delete</H2>
        <P>Remove a secret from the credential store.</P>
        <CodeBlock
          code={`envsec -c myapp.dev delete api.key

# Skip confirmation prompt
envsec -c myapp.dev delete api.key --yes

# Alias
envsec -c myapp.dev del api.key`}
        />
      </Section>

      <Section id="rename">
        <H2>envsec rename</H2>
        <P>
          Rename a secret key within the same context. The value and expiry
          metadata are preserved.
        </P>
        <CodeBlock
          code={`# Rename a key
envsec -c myapp.dev rename old.key new.key

# Overwrite target if it already exists
envsec -c myapp.dev rename old.key existing.key --force`}
        />
      </Section>

      <Section id="list">
        <H2>envsec list</H2>
        <P>List all secrets in a context, or list all contexts.</P>
        <CodeBlock
          code={`# List secrets in a context
envsec -c myapp.dev list

# List all contexts (without -c)
envsec list`}
        />
      </Section>

      <Section id="search">
        <H2>envsec search</H2>
        <P>Search secrets or contexts with glob patterns.</P>
        <CodeBlock
          code={`# Search secrets within a context
envsec -c myapp.dev search "api.*"

# Search contexts by pattern
envsec search "myapp.*"`}
        />
      </Section>

      <Section id="move">
        <H2>envsec move</H2>
        <P>
          Move secrets from one context to another. The source secrets are
          removed after moving.
        </P>
        <CodeBlock
          code={`# Move a single secret
envsec -c myapp.dev move api.token --to myapp.prod

# Move secrets matching a glob pattern
envsec -c myapp.dev move "redis.*" --to myapp.prod -y

# Move all secrets from one context to another
envsec -c myapp.dev move --all --to myapp.prod -y

# Overwrite existing secrets in the target context
envsec -c myapp.dev move "redis.*" --to myapp.prod --force -y`}
        />
      </Section>

      <Section id="copy">
        <H2>envsec copy</H2>
        <P>
          Copy secrets from one context to another. The source secrets remain
          intact.
        </P>
        <CodeBlock
          code={`# Copy a single secret
envsec -c myapp.dev copy api.token --to myapp.staging

# Copy secrets matching a glob pattern
envsec -c myapp.dev copy "redis.*" --to myapp.staging -y

# Copy all secrets from one context to another
envsec -c myapp.dev copy --all --to myapp.staging -y

# Overwrite existing secrets in the target context
envsec -c myapp.dev copy "redis.*" --to myapp.staging --force -y`}
        />
      </Section>

      <Section id="run">
        <H2>envsec run</H2>
        <P>
          Execute a command with secret interpolation. Placeholders like{" "}
          <Mono>{"{key}"}</Mono> are resolved and injected as environment
          variables — values never appear in <Mono>ps</Mono> output.
        </P>
        <CodeBlock
          code={`# Run with secret interpolation
envsec -c myapp.dev run 'curl {api.url} -H "Authorization: Bearer {api.token}"'

# Save the command for later
envsec -c myapp.dev run --save --name deploy 'kubectl apply -f - <<< {k8s.manifest}'`}
        />
      </Section>

      <Section id="cmd">
        <H2>envsec cmd</H2>
        <P>Manage saved commands.</P>
        <CodeBlock
          code={`# List saved commands
envsec cmd list

# Run a saved command
envsec cmd run deploy

# Run quietly (suppress informational output)
envsec cmd run deploy --quiet
envsec cmd run deploy -q

# Override context at execution time
envsec cmd run deploy --override-context myapp.prod

# Search saved commands
envsec cmd search psql

# Delete a saved command
envsec cmd delete deploy`}
        />
      </Section>

      <Section id="env-file">
        <H2>envsec env-file</H2>
        <P>Export secrets to a .env file.</P>
        <CodeBlock
          code={`# Default output: .env
envsec -c myapp.dev env-file

# Custom output path
envsec -c myapp.dev env-file --output .env.local`}
        />
      </Section>

      <Section id="env">
        <H2>envsec env</H2>
        <P>Export secrets as shell environment variable statements.</P>
        <CodeBlock
          code={`# bash/zsh
eval $(envsec -c myapp.dev env)

# fish
envsec -c myapp.dev env --shell fish

# powershell
envsec -c myapp.dev env --shell powershell

# Unset exported variables
eval $(envsec -c myapp.dev env --unset)`}
        />
        <P>
          Keys are converted to UPPER_SNAKE_CASE (e.g. <Mono>api.token</Mono> →{" "}
          <Mono>API_TOKEN</Mono>).
        </P>
      </Section>

      <Section id="load">
        <H2>envsec load</H2>
        <P>Import secrets from a .env file into a context.</P>
        <CodeBlock
          code={`# Import from .env
envsec -c myapp.dev load

# Custom input file
envsec -c myapp.dev load --input .env.local

# Overwrite existing secrets
envsec -c myapp.dev load --force`}
        />
      </Section>

      <Section id="share">
        <H2>envsec share</H2>
        <P>Encrypt secrets with GPG for team sharing.</P>
        <CodeBlock
          code={`# Encrypt for a team member
envsec -c myapp.dev share --encrypt-to [email]

# Save to file
envsec -c myapp.dev share --encrypt-to [email] -o secrets.enc

# JSON format inside encrypted payload
envsec -c myapp.dev --json share --encrypt-to [email] -o secrets.enc`}
        />
        <P>
          The recipient decrypts with <Mono>gpg --decrypt secrets.enc</Mono> and
          pipes the result into <Mono>envsec load</Mono>.
        </P>
      </Section>

      <Section id="audit">
        <H2>envsec audit</H2>
        <P>Check for expired or expiring secrets.</P>
        <CodeBlock
          code={`# Default window: 30 days
envsec -c myapp.dev audit

# Custom window
envsec -c myapp.dev audit --within 7d

# Only already-expired
envsec -c myapp.dev audit --within 0d

# Audit all contexts
envsec audit

# JSON output
envsec -c myapp.dev audit --json`}
        />
      </Section>

      {/* Configuration */}
      <Section id="contexts">
        <H2>Contexts</H2>
        <P>
          A context is a free-form label for grouping secrets — e.g.{" "}
          <Mono>myapp.dev</Mono>, <Mono>stripe-api.prod</Mono>,{" "}
          <Mono>work.staging</Mono>. Most commands require a context specified
          with <Mono>--context</Mono> (or <Mono>-c</Mono>).
        </P>
        <P>
          Keys must contain at least one dot separator (e.g.{" "}
          <Mono>service.account</Mono>) which maps to the credential
          store&apos;s service/account structure.
        </P>
      </Section>

      <Section id="database">
        <H2>Custom Database Path</H2>
        <P>
          By default, metadata is stored at <Mono>~/.envsec/store.sqlite</Mono>.
          Override with <Mono>--db</Mono> or the <Mono>ENVSEC_DB</Mono>{" "}
          environment variable.
        </P>
        <CodeBlock
          code={`# Project-local database
envsec --db ./local-store.sqlite -c myapp.dev list

# Via environment variable
export ENVSEC_DB=/shared/team/envsec.sqlite
envsec -c myapp.dev list`}
        />
      </Section>

      <Section id="shell-completions">
        <H2>Shell Completions</H2>
        <P>Tab completion for bash, zsh, fish, and sh.</P>
        <div className="mb-4 flex items-center gap-3 rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-4 py-3">
          <span aria-hidden="true" className="shrink-0 text-emerald-400">
            ℹ
          </span>
          <p className="text-muted-foreground text-sm leading-relaxed">
            Installed via Homebrew? Shell completions are configured
            automatically — you&apos;re already good to go.
          </p>
        </div>
        <CodeBlock
          code={`# Bash (add to ~/.bashrc)
eval "$(envsec --completions bash)"

# Zsh (add to ~/.zshrc)
eval "$(envsec --completions zsh)"

# Fish (add to ~/.config/fish/config.fish)
envsec --completions fish | source`}
        />
      </Section>

      {/* Security */}
      <Section id="security-model">
        <H2>Security Model</H2>
        <P>
          envsec delegates encryption to your OS native credential store. It
          never invents its own crypto. Secret values go straight from your
          terminal into the OS credential store — they are never written to
          config files, logs, or intermediate storage.
        </P>
        <P>
          The <Mono>list</Mono> and <Mono>search</Mono> commands display key
          names only — values are never printed. The <Mono>run</Mono> command
          injects secrets as environment variables of the child process rather
          than interpolating them into the command string, keeping values out of{" "}
          <Mono>ps</Mono> output and shell history.
        </P>
        <P>
          The metadata directory (<Mono>~/.envsec/</Mono>) is created with 0700
          permissions and the SQLite database with 0600, limiting access to the
          owning user.
        </P>
      </Section>

      <Section id="limitations">
        <H2>Known Limitations</H2>
        <ul className="list-inside list-disc space-y-3 text-muted-foreground">
          <li>
            The SQLite database stores key names, context names, and timestamps
            — never secret values, but enough to reveal what secrets exist.
          </li>
          <li>
            The <Mono>env-file</Mono> command writes secret values to a .env
            file on disk. Treat the output file accordingly.
          </li>
          <li>
            The <Mono>run</Mono> command passes templates through /bin/sh. Only
            run templates you wrote or trust.
          </li>
          <li>
            Any process running as your OS user can read all secrets across all
            contexts.
          </li>
          <li>
            On Linux, envsec depends on an active D-Bus session and a keyring
            daemon.
          </li>
        </ul>
      </Section>
    </article>
  );
}
