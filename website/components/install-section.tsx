"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";

const INSTALL_OPTIONS = [
  { label: "brew", command: "brew install davidnussio/homebrew-tap/envsec" },
  { label: "npm", command: "npm install -g envsec" },
  { label: "npx", command: "npx envsec" },
  { label: "mise", command: "mise use -g npm:envsec" },
] as const;

export function InstallSection() {
  const [active, setActive] = useState(0);
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(INSTALL_OPTIONS[active].command);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <section className="relative px-4 py-32 sm:px-6" id="install">
      <div className="mx-auto max-w-2xl text-center">
        <div className="animate-reveal">
          <p className="mb-3 font-mono text-emerald-400 text-sm">Install</p>
          <h2 className="mb-4 font-bold text-4xl tracking-tight md:text-5xl">
            Ready in seconds
          </h2>
          <p className="mb-10 text-lg text-muted-foreground">
            One command. No config. Node.js 22+ required.
          </p>
        </div>

        <div className="animate-reveal">
          {/* Tabs */}
          <div className="mb-4 flex justify-center gap-2">
            {INSTALL_OPTIONS.map((opt, i) => (
              <button
                className={`rounded-lg px-4 py-2 font-mono text-sm transition-colors ${
                  active === i
                    ? "bg-emerald-500/10 text-emerald-400"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                key={opt.label}
                onClick={() => setActive(i)}
                type="button"
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Command box */}
          <div className="flex items-center justify-between rounded-xl border border-white/10 bg-zinc-950 px-6 py-4">
            <code className="font-mono text-sm text-zinc-200 md:text-base">
              <span className="mr-2 text-emerald-400">$</span>
              {INSTALL_OPTIONS[active].command}
            </code>
            <Button
              aria-label="Copy install command"
              className="ml-4 text-muted-foreground hover:text-foreground"
              onClick={handleCopy}
              size="sm"
              variant="ghost"
            >
              {copied ? (
                <Check className="h-4 w-4 text-emerald-400" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
