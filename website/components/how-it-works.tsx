const PLATFORMS = [
  { os: "macOS", backend: "Keychain", tool: "security CLI", emoji: "🍎" },
  {
    os: "Linux",
    backend: "Secret Service (D-Bus)",
    tool: "secret-tool",
    emoji: "🐧",
  },
  {
    os: "Windows",
    backend: "Credential Manager",
    tool: "cmdkey + PowerShell",
    emoji: "🪟",
  },
] as const;

export function HowItWorks() {
  return (
    <section className="relative px-6 py-32" id="how-it-works">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_bottom,rgba(16,185,129,0.05)_0%,transparent_60%)]" />
      <div className="relative mx-auto max-w-4xl">
        <div className="mb-16 animate-reveal text-center">
          <p className="mb-3 font-mono text-emerald-400 text-sm">
            Architecture
          </p>
          <h2 className="mb-4 font-bold text-4xl tracking-tight md:text-5xl">
            Your OS is the vault
          </h2>
          <p className="mx-auto max-w-2xl text-lg text-muted-foreground">
            envsec delegates encryption to battle-tested credential stores.
            Metadata (key names, timestamps) lives in a local SQLite database —
            values never do.
          </p>
        </div>

        {/* Flow diagram */}
        <div className="mb-12 flex animate-reveal flex-col items-center gap-4">
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 px-8 py-4 font-mono text-sm">
            envsec CLI
          </div>
          <div className="h-8 w-px bg-gradient-to-b from-emerald-500/50 to-white/10" />
          <div className="flex flex-col gap-4 sm:flex-row">
            <div className="rounded-lg border border-white/10 bg-zinc-950 px-6 py-3 text-center text-sm">
              <span className="text-muted-foreground">Metadata</span>
              <br />
              <span className="font-mono text-xs text-zinc-500">
                SQLite (key names only)
              </span>
            </div>
            <div className="rounded-lg border border-white/10 bg-zinc-950 px-6 py-3 text-center text-sm">
              <span className="text-muted-foreground">Secret Values</span>
              <br />
              <span className="font-mono text-xs text-zinc-500">
                OS Credential Store
              </span>
            </div>
          </div>
        </div>

        {/* Platform table */}
        <div className="animate-reveal overflow-hidden rounded-xl border border-white/10 bg-zinc-950/50">
          <div className="grid grid-cols-4 gap-4 border-white/5 border-b px-6 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">
            <span />
            <span>OS</span>
            <span>Backend</span>
            <span>Tool</span>
          </div>
          {PLATFORMS.map((p) => (
            <div
              className="grid grid-cols-4 gap-4 border-white/5 border-b px-6 py-4 text-sm last:border-0"
              key={p.os}
            >
              <span className="text-xl">{p.emoji}</span>
              <span className="font-medium">{p.os}</span>
              <span className="text-muted-foreground">{p.backend}</span>
              <span className="font-mono text-xs text-zinc-500">{p.tool}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
