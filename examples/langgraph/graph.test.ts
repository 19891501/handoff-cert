import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { LANGGRAPH_END } from "../../src/lib/adopt/langgraph.ts";
import { probeHandoff, runStarter, starterPackets } from "../../src/lib/adopt/starter.ts";

const packets = starterPackets();

function requirePacket(id: string) {
  const row = packets.find((p) => p.id === id);
  assert.ok(row, `${id} absent du starter`);
  return row;
}

describe("examples/langgraph starter · gateNode 1.2", () => {
  it("STARTER_PACKETS : wrap never stops ; 1.2 matches expect12", async () => {
    for (const row of packets) {
      const wrap = await probeHandoff(row.packet, "wrap");
      const v10 = await probeHandoff(row.packet, "1.0");
      const v12 = await probeHandoff(row.packet, "1.2");

      assert.equal(wrap.stopped, false, `${row.id} wrap STOP`);
      assert.equal(wrap.goto, "executor", `${row.id} wrap goto`);
      assert.equal(wrap.gate, null, `${row.id} wrap judges`);

      assert.equal(v10.stopped, row.expect10 === "end", `${row.id} 1.0 stop`);
      assert.equal(v12.stopped, row.expect12 === "end", `${row.id} 1.2 stop`);
      if (row.expect12 === "end") {
        assert.equal(v12.goto, LANGGRAPH_END, `${row.id} 1.2 goto`);
        assert.equal(v12.gate, "STOP", `${row.id} 1.2 gate`);
        assert.equal(v12.executed, false, `${row.id} executor ran`);
      } else {
        assert.equal(v12.goto, "executor", `${row.id} 1.2 goto`);
        assert.equal(v12.gate, "PASS", `${row.id} 1.2 gate`);
        assert.equal(v12.verdict, "REPRENABLE", `${row.id} 1.2 verdict`);
        assert.equal(v12.executed, true, `${row.id} executor skipped`);
      }
    }
  });

  it("KFP-002 : 1.0 still goto executor ; 1.2 STOP CORROMPU", async () => {
    const kfp002 = requirePacket("KFP-002");
    const v10 = await probeHandoff(kfp002.packet, "1.0");
    const v12 = await probeHandoff(kfp002.packet, "1.2");
    assert.equal(v10.goto, "executor");
    assert.equal(v10.gate, "PASS");
    assert.equal(v12.goto, LANGGRAPH_END);
    assert.equal(v12.gate, "STOP");
    assert.equal(v12.verdict, "CORROMPU");
  });

  it("KFP-001 : V0 receipt PASSes ; grille 1.2 stops goto", async () => {
    const kfp001 = requirePacket("KFP-001");
    const v10 = await probeHandoff(kfp001.packet, "1.0");
    const v12 = await probeHandoff(kfp001.packet, "1.2");
    assert.equal(v10.stopped, false, "V0 gelé : B part à tort");
    assert.equal(v12.stopped, true);
    assert.equal(v12.verdict, "CORROMPU");
  });

  it("runStarter 1.2 on CORROMPU never reaches executor", async () => {
    const kfp002 = requirePacket("KFP-002");
    const run = await runStarter(kfp002.packet, "1.2");
    assert.equal(run.steps.length, 1);
    assert.equal(run.steps[0]?.node, "planner");
    assert.equal(run.steps[0]?.goto, LANGGRAPH_END);
    assert.equal(run.state.executed, undefined);
    assert.equal(run.state.continuation_gate, "STOP");
  });
});
