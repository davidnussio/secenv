"use client";

import { ChevronRight } from "lucide-react";
import { useState } from "react";

const SECTIONS = [
  {
    title: "Getting Started",
    items: [
      { id: "installation", label: "Installation" },
      { id: "quick-start", label: "Quick Start" },
      { id: "requirements", label: "Requirements" },
    ],
  },
  {
    title: "Commands",
    items: [
      { id: "add", label: "add" },
      { id: "get", label: "get" },
      { id: "delete", label: "delete" },
      { id: "rename", label: "rename" },
      { id: "list", label: "list" },
      { id: "search", label: "search" },
      { id: "move", label: "move" },
      { id: "copy", label: "copy" },
      { id: "run", label: "run" },
      { id: "cmd", label: "cmd" },
      { id: "env-file", label: "env-file" },
      { id: "env", label: "env" },
      { id: "load", label: "load" },
      { id: "share", label: "share" },
      { id: "audit", label: "audit" },
    ],
  },
  {
    title: "Configuration",
    items: [
      { id: "contexts", label: "Contexts" },
      { id: "database", label: "Custom Database Path" },
      { id: "shell-completions", label: "Shell Completions" },
    ],
  },
  {
    title: "Security",
    items: [
      { id: "security-model", label: "Security Model" },
      { id: "limitations", label: "Known Limitations" },
    ],
  },
] as const;

export function DocsSidebar() {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    "Getting Started": true,
    Commands: true,
    Configuration: true,
    Security: true,
  });

  const toggle = (title: string) => {
    setExpanded((prev) => ({ ...prev, [title]: !prev[title] }));
  };

  return (
    <aside className="sticky top-14 hidden h-[calc(100vh-3.5rem)] w-64 shrink-0 overflow-y-auto border-white/5 border-r py-8 pr-4 pl-6 md:block">
      <nav aria-label="Documentation navigation">
        {SECTIONS.map((section) => (
          <div className="mb-6" key={section.title}>
            <button
              className="mb-2 flex w-full items-center gap-1 font-semibold text-muted-foreground text-xs uppercase tracking-wider"
              onClick={() => toggle(section.title)}
              type="button"
            >
              <ChevronRight
                className={`h-3 w-3 transition-transform ${expanded[section.title] ? "rotate-90" : ""}`}
              />
              {section.title}
            </button>
            {expanded[section.title] && (
              <ul className="space-y-1 pl-4">
                {section.items.map((item) => (
                  <li key={item.id}>
                    <a
                      className="block rounded-md px-2 py-1 font-mono text-muted-foreground text-sm transition-colors hover:bg-white/5 hover:text-foreground"
                      href={`#${item.id}`}
                    >
                      {item.label}
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </nav>
    </aside>
  );
}
