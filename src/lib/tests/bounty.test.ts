import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  BOUNTY,
  BOUNTY_REFUSED,
  bountyCashOpen,
  bountyDueEur,
  corpusFalse12,
  lockedTagOf,
  probeBounty,
} from "../offer/bounty.ts";
import { CORPUS_CASES } from "../handoff/corpus.ts";
import { getCase } from "../handoff/cases.ts";
import { ATTACK_12_NOTE } from "../bench/verdict.ts";
import { GATE_SKU } from "../offer/mission.ts";

describe("bounty faux REPRENABLE", () => {
  it("cible 1.2 PASS, cash fermé tant que ce n'est pas réel", () => {
    assert.equal(BOUNTY.target.ruleset, "1.2");
    assert.equal(BOUNTY.target.ruleset, GATE_SKU.ruleset);
    assert.equal(BOUNTY.target.gate, "PASS");
    assert.equal(BOUNTY.cash, false);
    assert.equal(BOUNTY.billing, "preview");
    assert.equal(BOUNTY.paid_out_eur, 0);
    assert.equal(BOUNTY.paying_customers, 0);
    assert.equal(BOUNTY.until, "real");
    assert.equal(bountyCashOpen(), false);
    assert.equal(bountyDueEur(true), 0);
    assert.equal(bountyDueEur(false), 0);
    assert.ok(BOUNTY_REFUSED.some((r) => /virement|cash|payant/i.test(r)));
  });

  it("KFP-001–004 lockés, 1.2 ne les paie pas", async () => {
    const x07 = CORPUS_CASES.find((c) => c.id === "X07");
    assert.ok(x07);
    assert.equal(lockedTagOf(x07.payload), "KFP-001");
    const p = await probeBounty(x07.payload, "CORROMPU");
    assert.equal(p.qualifies, false);
    assert.equal(p.cash, false);
    assert.equal(p.due_eur, 0);
    assert.equal(p.v12.decision, "STOP");
    assert.equal(p.locked, "KFP-001");
    assert.equal(BOUNTY.target.excludes.length, 4);
  });

  it("corpus 1.2 : 0 faux REPRENABLE, rien à payer", () => {
    assert.equal(corpusFalse12(), 0);
    assert.equal(ATTACK_12_NOTE.attack12_faux_reprenable, 0);
    assert.equal(ATTACK_12_NOTE.attack12_kills, 0);
  });

  it("propre + monde CORROMPU : candidat machine, due 0", async () => {
    const clean = getCase("clean_validation");
    assert.ok(clean);
    const p = await probeBounty(clean.payload, "CORROMPU");
    assert.equal(p.v12.decision, "PASS");
    assert.equal(p.locked, null);
    assert.equal(p.qualifies, true);
    assert.equal(p.due_eur, 0);
    assert.equal(p.cash, false);
  });
});
