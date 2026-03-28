import { bashCompletions } from "./bash.js";
import { fishCompletions } from "./fish.js";
import { zshCompletions } from "./zsh.js";

export type ShellType = "bash" | "fish" | "zsh";

export const generateCompletions = (shell: ShellType, bin: string): string => {
  switch (shell) {
    case "bash":
      return bashCompletions(bin);
    case "zsh":
      return zshCompletions(bin);
    case "fish":
      return fishCompletions(bin);
    default:
      return "";
  }
};
