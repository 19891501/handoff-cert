import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { runSuite, tally } from "./suite.ts";

describe("suite HANDOFF", () => {
  it("passe sans faux REPRENABLE", async () => {
    const results = await runSuite();
    const t = tally(results);
    const failed = results.filter((r) => !r.ok);
    assert.equal(
      t.fail,
      0,
      failed.map((f) => `${f.id}: ${f.error}`).join(" | "),
    );
    assert.equal(t.falseSafe, 0);
    assert.ok(t.n >= 40, `trop peu de tests: ${t.n}`);
  });
});
