import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  gateNode,
  LANGGRAPH_END,
  readGoto,
  wrapNode,
  type LangGraphCommand,
} from "../adopt/langgraph.ts";
import { attackCorpus } from "../bench/attack.ts";

function requireAttack(id: string) {
  const attack = attackCorpus().find((a) => a.id === id);
  assert.ok(attack, `${id} absent du corpus`);
  return attack;
}

const kfp = requireAttack("KFP-001");
const fail = requireAttack("CTL-FAIL-TOKEN");
const node = () => ({ goto: "executor", update: { step: 1 } });

describe("gate-graph", () => {
  it("wrapNode always continues goto executor on KFP-001 packet", async () => {
    const wrapped = wrapNode("planner", node);
    const out = (await wrapped({ packet: kfp.packet })) as LangGraphCommand;
    assert.equal(readGoto(out), "executor");
  });

  it("gateNode on CTL-FAIL-TOKEN packet: goto LANGGRAPH_END", async () => {
    const gated = gateNode("planner", node);
    const out = (await gated({ packet: fail.packet })) as LangGraphCommand;
    assert.equal(readGoto(out), LANGGRAPH_END);
  });

  it("gateNode on KFP-001: still goto executor under default V0 gate", async () => {
    const gated = gateNode("planner", node);
    const out = (await gated({ packet: kfp.packet })) as LangGraphCommand;
    assert.equal(readGoto(out), "executor");
  });
});
