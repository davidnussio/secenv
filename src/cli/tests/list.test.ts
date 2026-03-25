import { describe, expect, it } from "vitest";
import { buildTestCli } from "../../tests/run-cli-test.js";

describe("list", () => {
  it("shows the empty-state message if no contexts are found", async () => {
    const testCli = buildTestCli();
    const logs = await testCli("list");

    expect(logs).toEqual(["📭 No contexts found."]);
  });

  it("lists all contexts", async () => {
    const testCli = buildTestCli();
    await testCli("-c myapp.dev add api.key --value sk-abc123");

    const logs = await testCli("list");

    expect(logs).toEqual(["📦 myapp.dev  (1 secrets)"]);
  });
});
