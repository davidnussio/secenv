import { Shield } from "lucide-react";
import Link from "next/link";

export function Footer() {
  return (
    <footer className="border-white/5 border-t px-6 py-12">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-6 sm:flex-row">
        <div className="flex items-center gap-2 font-mono text-muted-foreground text-sm">
          <Shield className="h-4 w-4 text-emerald-400" />
          <span>envsec</span>
          <span className="text-zinc-700">·</span>
          <span>MIT License</span>
        </div>
        <div className="flex gap-6 text-muted-foreground text-sm">
          <Link
            className="transition-colors hover:text-foreground"
            href="/docs"
          >
            Docs
          </Link>
          <a
            className="transition-colors hover:text-foreground"
            href="https://github.com/davidnussio/envsec"
            rel="noopener noreferrer"
            target="_blank"
          >
            GitHub
          </a>
          <a
            className="transition-colors hover:text-foreground"
            href="https://www.npmjs.com/package/envsec"
            rel="noopener noreferrer"
            target="_blank"
          >
            npm
          </a>
        </div>
      </div>
    </footer>
  );
}
