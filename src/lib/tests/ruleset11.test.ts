import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { certify } from "../handoff/engine.ts";
import { analyze11, certify11, RULESET_11 } from "../handoff/ruleset11.ts";
import { CORPUS_CASES } from "../handoff/corpus.ts";
import { getCase } from "../handoff/cases.ts";
import { normalize } from "../handoff/normalize.ts";
import { attackCorpus } from "../bench/attack.ts";

describe("ruleset 1.1", () => {
  it("KFP-001 / X07 : V0 reste REPRENABLE, 1.1 → CORROMPU", async () => {
    const x07 = CORPUS_CASES.find((c) => c.id === "X07");
    assert.ok(x07, "CORPUS X07 absent");

    const v0 = await certify(x07.payload);
    assert.equal(v0.verdict, "REPRENABLE", "V0 gelé sur KFP-001");
    assert.equal(v0.ruleset, "1.0");
    assert.equal(
      v0.findings.some((f) => f.code === "CONTRADICTION_BOOLEAN"),
      false,
      "V0 ne polarise pas les booléens",
    );

    const v11 = await certify11(x07.payload);
    assert.equal(v11.verdict, "CORROMPU", "1.1 polarise les booléens false");
    assert.equal(v11.ruleset, RULESET_11);
    assert.equal(v11.ruleset, "1.1");
    assert.ok(
      v11.findings.some(
        (f) => f.code === "CONTRADICTION_BOOLEAN" && f.severity === "critical",
      ),
      "CONTRADICTION_BOOLEAN critical",
    );

    const findings = analyze11(normalize(x07.payload));
    assert.ok(
      findings.some((f) => f.code === "CONTRADICTION_BOOLEAN" && f.severity === "critical"),
    );
  });

  it("CTL-style : claim succès + status FAIL string → V0 et 1.1 CORROMPU", async () => {
    const ctl = attackCorpus().find((a) => a.id === "CTL-FAIL-TOKEN");
    assert.ok(ctl, "CTL-FAIL-TOKEN absent");

    const v0 = await certify(ctl.packet);
    const v11 = await certify11(ctl.packet);
    assert.equal(v0.verdict, "CORROMPU", "V0 voit le token FAIL");
    assert.equal(v11.verdict, "CORROMPU", "1.1 conserve le lexique V0");
    assert.ok(
      v11.findings.some((f) => f.code === "CONTRADICTION_CLAIM_EVIDENCE"),
      "1.1 part de analyze() V0",
    );
  });

  it("clean_validation : 1.1 reste REPRENABLE", async () => {
    const clean = getCase("clean_validation");
    assert.ok(clean, "clean_validation absent");

    const v0 = await certify(clean.payload);
    const v11 = await certify11(clean.payload);
    assert.equal(v0.verdict, "REPRENABLE");
    assert.equal(v11.verdict, "REPRENABLE");
    assert.equal(v11.ruleset, "1.1");
    assert.equal(
      v11.findings.some((f) => f.code === "CONTRADICTION_BOOLEAN"),
      false,
    );
  });
});
