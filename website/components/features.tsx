import {
  Clock,
  FileText,
  Monitor,
  Play,
  Search,
  Share2,
  Shield,
  Terminal,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

const FEATURES = [
  {
    icon: Shield,
    title: "OS-Native Encryption",
    description:
      "Secrets live in macOS Keychain, GNOME Keyring, or Windows Credential Manager. Zero custom crypto.",
  },
  {
    icon: Monitor,
    title: "Cross-Platform",
    description:
      "Works on macOS, Linux, and Windows. The right backend is selected automatically.",
  },
  {
    icon: Search,
    title: "Glob Search",
    description:
      "Search contexts and secrets with glob patterns. Find what you need instantly.",
  },
  {
    icon: FileText,
    title: ".env Import/Export",
    description:
      "Generate .env files or import from them. Bridge between envsec and your existing workflow.",
  },
  {
    icon: Play,
    title: "Secret Interpolation",
    description:
      "Run commands with {key} placeholders. Secrets are injected as env vars — never in ps output.",
  },
  {
    icon: Clock,
    title: "Expiry & Audit",
    description:
      "Set expiry durations on secrets. Audit across contexts to catch expired or expiring credentials.",
  },
  {
    icon: Share2,
    title: "GPG Sharing",
    description:
      "Encrypt secrets for team members with GPG. Share securely without Slack or email.",
  },
  {
    icon: Terminal,
    title: "Shell Completions",
    description:
      "Tab completions for bash, zsh, fish, and PowerShell. Feels native in every shell.",
  },
] as const;

export function Features() {
  return (
    <section className="relative px-6 py-32" id="features">
      <div className="mx-auto max-w-6xl">
        <div className="mb-16 animate-reveal text-center">
          <p className="mb-3 font-mono text-emerald-400 text-sm">Features</p>
          <h2 className="font-bold text-4xl tracking-tight md:text-5xl">
            Everything you need.
            <br />
            Nothing you don&apos;t.
          </h2>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((feature) => (
            <div className="animate-reveal" key={feature.title}>
              <Card className="h-full border-white/5 bg-zinc-950/50 transition-colors hover:border-emerald-500/20 hover:bg-zinc-950">
                <CardContent className="p-6">
                  <feature.icon className="mb-4 h-8 w-8 text-emerald-400" />
                  <h3 className="mb-2 font-semibold">{feature.title}</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    {feature.description}
                  </p>
                </CardContent>
              </Card>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
