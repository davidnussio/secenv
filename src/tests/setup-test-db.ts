import { existsSync, mkdirSync, readdirSync, unlinkSync } from "node:fs";
import path, { join } from "node:path";
import { afterEach, beforeEach } from "vitest";

beforeEach(() => {
  const dbDir = join(process.cwd(), "db");

  if (!existsSync(dbDir)) {
    mkdirSync(dbDir);
  }
});

afterEach(() => {
  const dbDir = join(process.cwd(), "db");
  if (existsSync(dbDir)) {
    for (const file of readdirSync(dbDir)) {
      if (file.endsWith(".db")) {
        unlinkSync(path.join(dbDir, file));
      }
    }
  }
});
