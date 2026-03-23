"use client";

import { Menu, Shield, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <nav className="fixed top-0 z-50 w-full border-white/5 border-b bg-black/80 backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
        <Link
          className="flex items-center gap-2 font-bold font-mono text-lg tracking-tight"
          href="/"
        >
          <Shield className="h-5 w-5 text-emerald-400" />
          <span>envsec</span>
        </Link>

        <div className="hidden items-center gap-8 md:flex">
          <Link
            className="text-muted-foreground text-sm transition-colors hover:text-foreground"
            href="/#features"
          >
            Features
          </Link>
          <Link
            className="text-muted-foreground text-sm transition-colors hover:text-foreground"
            href="/#how-it-works"
          >
            How it works
          </Link>
          <Link
            className="text-muted-foreground text-sm transition-colors hover:text-foreground"
            href="/#install"
          >
            Install
          </Link>
          <Link
            className="text-muted-foreground text-sm transition-colors hover:text-foreground"
            href="/docs"
          >
            Docs
          </Link>
          <a
            className={cn(
              buttonVariants({ size: "sm" }),
              "bg-emerald-500 text-black hover:bg-emerald-400"
            )}
            href="https://github.com/davidnussio/envsec"
            rel="noopener noreferrer"
            target="_blank"
          >
            GitHub
          </a>
        </div>

        <button
          aria-label={mobileOpen ? "Close menu" : "Open menu"}
          className="md:hidden"
          onClick={() => setMobileOpen(!mobileOpen)}
          type="button"
        >
          {mobileOpen ? (
            <X className="h-5 w-5" />
          ) : (
            <Menu className="h-5 w-5" />
          )}
        </button>
      </div>

      {mobileOpen && (
        <div className="border-white/5 border-t bg-black/95 px-6 py-4 md:hidden">
          <div className="flex flex-col gap-4">
            <Link
              className="text-muted-foreground text-sm"
              href="/#features"
              onClick={() => setMobileOpen(false)}
            >
              Features
            </Link>
            <Link
              className="text-muted-foreground text-sm"
              href="/#how-it-works"
              onClick={() => setMobileOpen(false)}
            >
              How it works
            </Link>
            <Link
              className="text-muted-foreground text-sm"
              href="/#install"
              onClick={() => setMobileOpen(false)}
            >
              Install
            </Link>
            <Link
              className="text-muted-foreground text-sm"
              href="/docs"
              onClick={() => setMobileOpen(false)}
            >
              Docs
            </Link>
          </div>
        </div>
      )}
    </nav>
  );
}
