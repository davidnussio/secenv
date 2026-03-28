"use client";

import { ChevronDown } from "lucide-react";
import { useState } from "react";
import { UseCaseTerminal } from "./use-case-terminal";

const USE_CASES = [
  {
    id: "easy-clean-and-restore-env",
    question: "How do I clean up .env files scattered across old projects?",
    problem:
      "Over time, plaintext .env files pile up in forgotten project directories. A quick find reveals dozens of them sitting on disk with real credentials inside. Import them into envsec, delete the files, and regenerate them only when you need them.",
    lines: [
      { prompt: true, text: "find ~/projects -name '.env' -type f" },
      { prompt: false, text: "  ~/projects/ /.env" },
      { prompt: false, text: "  ~/projects/demo-app/.env" },
      { prompt: false, text: "  ~/projects/freelance-2023/.env" },
      { prompt: false, text: "  ~/projects/new-project/.env" },
      { prompt: true, text: "# Import each one into envsec, then delete" },
      {
        prompt: true,
        text: "envsec -c old-api load --input ~/projects/old-api/.env",
      },
      { prompt: false, text: "✔ Done: 18 added, 0 overwritten, 0 skipped" },
      { prompt: true, text: "rm ~/projects/old-api/.env" },
      {
        prompt: true,
        text: "envsec -c demo-app load --input ~/projects/demo-app/.env",
      },
      { prompt: false, text: "✔ Done: 6 added, 0 overwritten, 0 skipped" },
      { prompt: true, text: "rm ~/projects/demo-app/.env" },
      {
        prompt: true,
        text: "envsec -c freelance-2023 load --input ~/projects/freelance-2023/.env",
      },
      { prompt: false, text: "✔ Done: 5 added, 0 overwritten, 0 skipped" },
      { prompt: true, text: "rm ~/projects/freelance-2023/.env" },
      { prompt: true, text: "# Regenerate .env only for the active project" },
      {
        prompt: true,
        text: "envsec -c new-project load --input ~/projects/new-project/.env",
      },
      { prompt: false, text: "✔ Done: 12 added, 0 overwritten, 0 skipped" },
      { prompt: true, text: "rm ~/projects/new-project/.env" },
      {
        prompt: true,
        text: "envsec -c new-project env-file --output ~/projects/new-project/.env",
      },
      {
        prompt: false,
        text: "✔ Wrote 12 secrets to ~/projects/new-project/.env",
      },
    ],
  },
  {
    id: "manage-secrets-per-environment",
    question:
      "How do I manage different secrets for dev, staging, and production?",
    problem:
      "Maintaining separate .env files for each environment is fragile and error-prone. It's easy to mix up credentials between environments.",
    lines: [
      { prompt: false, text: "# Add development envs" },
      {
        prompt: true,
        text: 'envsec -c myapp.dev add api.url -v "http://localhost:3000"',
      },
      {
        prompt: false,
        text: '✔ Secret "api.url" stored in context "myapp.dev"',
      },
      {
        prompt: true,
        text: "envsec -c myapp.dev add api.token",
      },
      {
        prompt: false,
        text: "◆ Enter secret value:",
      },
      {
        prompt: false,
        text: '✔ Secret "api.token" stored in context "myapp.dev"',
      },
      { prompt: false, text: "# Add production envs" },
      {
        prompt: true,
        text: 'envsec -c myapp.prod add api.url -v "https://api.example.com"',
      },
      {
        prompt: false,
        text: '✔ Secret "api.url" stored in context "myapp.dev"',
      },
      {
        prompt: true,
        text: "envsec -c myapp.prod add api.token",
      },
      {
        prompt: false,
        text: "◆ Enter secret value:",
      },
      {
        prompt: false,
        text: '✔ Secret "api.token" stored in context "myapp.prod"',
      },
      { prompt: true, text: "envsec search 'myapp.*'" },
      { prompt: false, text: "▸ myapp.dev  (2 secrets)" },
      { prompt: false, text: "▸ myapp.prod  (2 secrets)" },
    ],
  },
  {
    id: "run-app-without-leaking-secrets",
    question:
      "How do I run my app with secrets without exposing them in shell history?",
    problem:
      "Passing secrets inline in commands exposes them in shell history and `ps` output. They should be injected as environment variables of the child process. With `-c` you can switch context (e.g. dev, staging, prod) and run the same command against different sets of secrets.",
    lines: [
      {
        prompt: true,
        text: `envsec -c myapp.prod run 'curl -X GET "https://pie.dev/headers" -H "Authorization: Bearer {api.token}"'`,
      },
      { prompt: false, text: "■ Resolved 1 secret" },
      {
        prompt: false,
        text: `{ "headers": { "Authorization": "Bearer token-1234567890" }`,
      },
      {
        prompt: true,
        text: `envsec -c myapp.dev run 'curl -X GET "https://pie.dev/headers" -H "Authorization: Bearer {api.token}"'`,
      },
      { prompt: false, text: "■ Resolved 1 secret" },
      {
        prompt: false,
        text: `{ "headers": { "Authorization": "Bearer dev-token-abc" }`,
      },
    ],
  },
  {
    id: "generate-env-file-on-demand",
    question:
      "How do I generate a .env file for tools that require one (Docker, frameworks)?",
    problem:
      "Some tools like Docker Compose or frameworks require a physical .env file. You need a way to generate it on-demand without keeping it in the repo.",
    lines: [
      {
        prompt: true,
        text: "envsec -c myapp.dev env-file --output .env.local",
      },
      { prompt: false, text: "· Written 4 secrets to .env.local" },
      { prompt: true, text: "cat .env.local" },
      { prompt: false, text: 'API_KEY="sk-abc123"' },
      { prompt: false, text: 'DB_PASSWORD="s3cret"' },
      { prompt: false, text: 'API_URL="http://localhost:3000"' },
      { prompt: false, text: 'REDIS_URL="redis://localhost:6379"' },
    ],
  },
  {
    id: "import-secrets-from-env-file",
    question: "How do I import secrets from an existing .env file?",
    problem:
      "You already have a .env file with dozens of variables and want to migrate them into the native credential store without re-entering each one manually.",
    lines: [
      { prompt: true, text: "envsec -c myapp.dev load --input .env.local" },
      {
        prompt: false,
        text: `▲ Skipped "api.url": already exists (use --force to overwrite)`,
      },
      { prompt: false, text: "✔ Done: 3 added, 0 overwritten, 1 skipped" },
    ],
  },
  {
    id: "audit-expired-secrets",
    question: "How do I check for expired or expiring secrets?",
    problem:
      "API keys and tokens have expiration dates. Without an audit system, you risk discovering expired credentials only when something breaks in production.",
    lines: [
      {
        prompt: true,
        text: 'envsec -c myapp.dev add api.token -v "tk-xyz" --expires 30d',
      },
      {
        prompt: false,
        text: `✔ Secret "api.token" stored in context "myapp.dev"`,
      },
      { prompt: false, text: "  ◔ expires: 2026-04-26 06:47:05 UTC" },
      { prompt: true, text: "envsec audit" },
      {
        prompt: false,
        text: "◎ Secrets expiring within 30d across all contexts:",
      },
      { prompt: false, text: "  ◔ [myapp.dev] api.token  expires in 29d" },
      {
        prompt: false,
        text: "▪ 0 expired, 1 expiring soon across 1 context (1 total)",
      },
      { prompt: false, text: "" },
      { prompt: false, text: "· Generated .env files:" },
      { prompt: false, text: "  · ~/projects/old-api/.env" },
      {
        prompt: false,
        text: "    context: old-api  generated: 2025-08-17 16:21:11",
      },
      { prompt: false, text: "  · ~/projects/demo-app/.env" },
      {
        prompt: false,
        text: "    context: demo-app  generated: 2025-12-09 11:41:59",
      },
      { prompt: false, text: "  · ~/projects/freelance-2023/.env" },
      {
        prompt: false,
        text: "    context: freelance-2023  generated: 2023-03-08 08:30:00",
      },
      { prompt: false, text: "  · ~/projects/new-project/.env" },
      {
        prompt: false,
        text: "    context: new-project  generated: 2026-03-27 06:42:19",
      },
      { prompt: false, text: "▪ 4 env files generated" },
    ],
  },
  {
    id: "share-secrets-with-gpg",
    question: "How do I securely share secrets with a teammate?",
    problem:
      "Sending credentials over Slack, email, or messages is insecure. You need an encrypted channel and a format the recipient can easily import.",
    lines: [
      {
        prompt: true,
        text: "envsec -c myapp.dev share --encrypt-to alice@example.com -o secrets.enc",
      },
      {
        prompt: false,
        text: `◈ Encrypted 4 secrets from "myapp.dev" for alice@example.com → secrets.enc`,
      },
      { prompt: true, text: "# Teammate decrypts and imports:" },
      {
        prompt: true,
        text: "gpg --decrypt secrets.enc > .env.local",
      },
      {
        prompt: true,
        text: "envsec -c myapp.dev load -i .env.local",
      },
      { prompt: false, text: "✔ Done: 4 added, 0 overwritten, 0 skipped" },
    ],
  },
  {
    id: "reuse-dev-keys-for-new-projects",
    question:
      "How do I reuse my dev API keys when starting a new project or POC?",
    problem:
      "When you start a new project or try a new tool, you often need the same API keys you already use in development. Instead of hunting through dashboards or creating new ones, copy them from your dev context into the new project context in one command.",
    lines: [
      { prompt: false, text: "# You already have dev keys stored" },
      { prompt: true, text: "envsec -c dev list" },
      { prompt: false, text: "◆ openai.key  updated: 2026-03-15 10:30:00" },
      { prompt: false, text: "◆ stripe.key  updated: 2026-03-10 08:15:00" },
      {
        prompt: false,
        text: "◆ resend.key  updated: 2026-02-28 14:20:00",
      },
      { prompt: false, text: "" },
      { prompt: false, text: '▪ 3 secrets in "dev"' },
      {
        prompt: false,
        text: "# Copy everything to the new project context",
      },
      {
        prompt: true,
        text: "envsec -c dev copy --all --to my-poc -y",
      },
      {
        prompt: false,
        text: '✔ Copied 3 secrets from "dev" → "my-poc"',
      },
      {
        prompt: false,
        text: "# Or copy only what you need with a glob pattern",
      },
      {
        prompt: true,
        text: 'envsec -c dev copy "openai.*" --to ai-experiment',
      },
      {
        prompt: false,
        text: '✔ Copied 1 secret from "dev" → "ai-experiment"',
      },
      {
        prompt: false,
        text: "# Start working immediately",
      },
      {
        prompt: true,
        text: "eval $(envsec -c my-poc env)",
      },
    ],
  },
  {
    id: "export-secrets-to-shell",
    question:
      "How do I export secrets as environment variables in my current shell?",
    problem:
      "You want secrets available as environment variables in your current session, without writing any files to disk.",
    lines: [
      { prompt: true, text: "eval $(envsec -c myapp.dev env)" },
      { prompt: false, text: "✔ Exported API_KEY, DB_PASSWORD, API_URL" },
      { prompt: true, text: "echo $API_KEY" },
      { prompt: false, text: "sk-abc123" },
      { prompt: true, text: "# Also supports fish and powershell:" },
      { prompt: true, text: "envsec -c myapp.dev env --shell fish" },
      { prompt: false, text: 'set -gx API_KEY "sk-abc123";' },
    ],
  },
] as const;

function UseCaseItem({ item }: { item: (typeof USE_CASES)[number] }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-xl border border-white/10 bg-zinc-950/50 transition-colors hover:border-emerald-500/20">
      <button
        className="flex w-full items-center justify-between gap-4 px-3 py-4 text-left sm:px-6 sm:py-5"
        onClick={() => setOpen(!open)}
        type="button"
      >
        <span className="font-medium text-base leading-snug">
          {item.question}
        </span>
        <ChevronDown
          className={`h-5 w-5 shrink-0 text-muted-foreground transition-transform duration-200 ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>
      {open && (
        <div className="px-3 pb-4 sm:px-6 sm:pb-6">
          <p className="mb-4 text-muted-foreground text-sm leading-relaxed">
            {item.problem}
          </p>
          <div className="-mx-0.5 sm:mx-0">
            <UseCaseTerminal lines={item.lines} />
          </div>
        </div>
      )}
    </div>
  );
}

export function UseCases() {
  return (
    <section className="relative px-4 py-32 sm:px-6" id="use-cases">
      <div className="mx-auto max-w-3xl">
        <div className="mb-16 animate-reveal text-center">
          <p className="mb-3 font-mono text-emerald-400 text-sm">Use Cases</p>
          <h2 className="mb-4 font-bold text-4xl tracking-tight md:text-5xl">
            Real problems, real solutions
          </h2>
          <p className="text-lg text-muted-foreground">
            Common scenarios in everyday development and how envsec solves them.
            Click any question to see a live terminal walkthrough.
          </p>
        </div>

        <div className="flex flex-col gap-3">
          {USE_CASES.map((item) => (
            <div className="animate-reveal" key={item.id}>
              <UseCaseItem item={item} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
