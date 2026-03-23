"use client";

import { ArrowRight, Terminal } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { TerminalDemo } from "./terminal-demo";

export function Hero() {
  return (
    <section className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-6 pt-14">
      {/* Gradient background */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(16,185,129,0.08)_0%,transparent_70%)]" />
      <div className="pointer-events-none absolute top-0 left-1/2 h-[600px] w-[600px] -translate-x-1/2 rounded-full bg-emerald-500/5 blur-3xl" />

      <div className="relative z-10 flex max-w-4xl animate-fade-in-up flex-col items-center text-center">
        <Badge
          className="mb-6 border-emerald-500/30 text-emerald-400"
          variant="outline"
        >
          <Terminal className="mr-1.5 h-3 w-3" />
          v1.0 beta — Now available
        </Badge>

        <h1 className="mb-6 font-bold text-5xl leading-tight tracking-tight md:text-7xl">
          Secrets that{" "}
          <span className="bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
            never touch disk
          </span>
        </h1>

        <p className="mb-10 max-w-2xl text-lg text-muted-foreground leading-relaxed md:text-xl">
          Store environment secrets in your OS native credential store. Not in
          dotfiles. Not in plaintext. Not in the cloud. Just your Keychain, your
          rules.
        </p>

        <div className="mb-16 flex flex-col gap-4 sm:flex-row">
          <Link
            className={cn(
              buttonVariants({ size: "lg" }),
              "bg-emerald-500 text-black hover:bg-emerald-400"
            )}
            href="#install"
          >
            Get started
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
          <Link
            className={cn(
              buttonVariants({ variant: "outline", size: "lg" }),
              "border-white/10"
            )}
            href="/docs"
          >
            Read the docs
          </Link>
        </div>

        <TerminalDemo />
      </div>
    </section>
  );
}
