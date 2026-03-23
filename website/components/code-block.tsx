"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";

interface CodeBlockProps {
  code: string;
  language?: string;
}

export function CodeBlock({ code, language = "bash" }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="group relative my-4 overflow-hidden rounded-lg border border-white/10 bg-zinc-950">
      <div className="flex items-center justify-between border-white/5 border-b px-4 py-2">
        <span className="font-mono text-xs text-zinc-600">{language}</span>
        <button
          aria-label="Copy code"
          className="text-zinc-600 opacity-0 transition-opacity hover:text-zinc-400 group-hover:opacity-100"
          onClick={handleCopy}
          type="button"
        >
          {copied ? (
            <Check className="h-3.5 w-3.5 text-emerald-400" />
          ) : (
            <Copy className="h-3.5 w-3.5" />
          )}
        </button>
      </div>
      <pre className="overflow-x-auto p-4 font-mono text-sm text-zinc-300 leading-relaxed">
        <code>{code}</code>
      </pre>
    </div>
  );
}
