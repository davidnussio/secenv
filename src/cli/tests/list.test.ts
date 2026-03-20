import { expect } from "bun:test";
import { describe, it } from "node:test";
import { runCli } from "../../tests/run-cli-test.js";
import { SecretStoreTest } from "../../tests/secret-store-test-layer.js";
import { listCommand } from "../list.js";

describe("list", () => {
  describe("when no --context flag is given", () => {
    it("shows the empty-state message if no contexts are found", async () => {
      const runCliList = runCli(listCommand, SecretStoreTest);
      const logs = await runCliList(["list"]);

      expect(logs).toEqual(["📭 No contexts found."]);
    });
  });
});
