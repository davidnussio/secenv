/**
 * Centralized UI module for polished console output.
 * Uses ANSI escape codes for colors and standard Unicode icons.
 * Zero dependencies — works in any terminal with color support.
 */

const isColorSupported = (): boolean => {
  if (process.env.NO_COLOR) {
    return false;
  }
  if (process.env.FORCE_COLOR) {
    return true;
  }
  return process.stdout.isTTY ?? false;
};

const useColor = isColorSupported();

const ansi = (code: string) => (text: string) =>
  useColor ? `\x1b[${code}m${text}\x1b[0m` : text;

// ── Colors ──────────────────────────────────────────────────────────
export const green = ansi("32");
export const red = ansi("31");
export const yellow = ansi("33");
export const blue = ansi("34");
export const cyan = ansi("36");
export const magenta = ansi("35");
export const dim = ansi("2");
export const bold = ansi("1");
export const white = ansi("37");

// ── Icons (clean Unicode — no emoji, no Nerd Fonts) ─────────────────
export const icons = {
  success: green("✔"), // U+2714
  error: red("✖"), // U+2716
  warning: yellow("▲"), // U+25B2
  info: blue("●"), // U+25CF
  key: yellow("◆"), // U+25C6
  lock: green("■"), // U+25A0
  unlock: red("□"), // U+25A1
  search: blue("◎"), // U+25CE
  folder: blue("▸"), // U+25B8
  file: cyan("·"), // U+00B7
  clock: yellow("◔"), // U+25D4
  expired: red("✖"), // U+2716
  trash: red("×"), // U+00D7
  save: green("↓"), // U+2193
  download: cyan("↓"), // U+2193
  upload: magenta("↑"), // U+2191
  shield: green("◈"), // U+25C8
  chart: blue("▪"), // U+25AA
  bolt: yellow("›"), // U+203A
  empty: dim("∅"), // U+2205
  arrow: dim("→"), // U+2192
  check: green("✔"), // U+2714
  cancel: dim("⊘"), // U+2298
  broom: yellow("~"), // tilde
  env: cyan("$"), // env var
} as const;

// ── Formatting Helpers ──────────────────────────────────────────────

/** Format a label: value pair with dimmed separator */
export const label = (name: string, value: string): string =>
  `${dim(name)}${dim(":")} ${value}`;

/** Format a count badge like "3 secrets" */
export const badge = (
  count: number,
  singular: string,
  plural?: string
): string => {
  const word = count === 1 ? singular : (plural ?? `${singular}s`);
  return `${bold(String(count))} ${word}`;
};

/** Indent a line */
export const indent = (text: string, level = 1): string =>
  `${"  ".repeat(level)}${text}`;

/** Horizontal separator */
export const separator = (width = 40): string => dim("─".repeat(width));
