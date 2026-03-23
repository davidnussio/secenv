import { homedir } from "node:os";
import { join } from "node:path";
import { Context, Layer } from "effect";

export interface DatabaseConfigShape {
  readonly path: string;
}

export class DatabaseConfig extends Context.Tag("DatabaseConfig")<
  DatabaseConfig,
  DatabaseConfigShape
>() {}

const defaultDbPath = join(homedir(), ".envsec", "store.sqlite");

export const DatabaseConfigDefault = Layer.succeed(DatabaseConfig, {
  path: defaultDbPath,
});

export const DatabaseConfigFrom = (path: string) =>
  Layer.succeed(DatabaseConfig, { path });
