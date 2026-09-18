import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { certify } from "../handoff/engine.ts";
import { analyze12, certify12, RULESET_12 } from "../handoff/ruleset12.ts";
import { CORPUS_CASES } from "../handoff/corpus.ts";
import { getCase } from "../handoff/cases.ts";
import { normalize } from "../handoff/normalize.ts";
import { attackCorpus } from "../bench/attack.ts";

describe("ruleset 1.2", () => {
  it("KFP-002 / X09 : V0 reste REPRENABLE, 1.2 → CORROMPU (SPEC_NOT_EVIDENCE)", async () => {
    const x09 = CORPUS_CASES.find((c) => c.id === "X09");
    assert.ok(x09, "CORPUS X09 absent");

    const v0 = await certify(x09.payload);
    assert.equal(v0.verdict, "REPRENABLE", "V0 gelé sur KFP-002");
    assert.equal(v0.ruleset, "1.0");
    assert.equal(
      v0.findings.some((f) => f.code === "SPEC_NOT_EVIDENCE"),
      false,
      "V0 ne refuse pas expected_output comme preuve",
    );

    const v12 = await certify12(x09.payload);
    assert.equal(v12.verdict, "CORROMPU", "1.2 : spec n'est pas une exécution");
    assert.equal(v12.ruleset, RULESET_12);
    assert.equal(v12.ruleset, "1.2");
    assert.ok(
      v12.findings.some(
        (f) => f.code === "SPEC_NOT_EVIDENCE" && f.severity === "critical",
      ),
      "SPEC_NOT_EVIDENCE critical",
    );

    const findings = analyze12(normalize(x09.payload));
    assert.ok(
      findings.some((f) => f.code === "SPEC_NOT_EVIDENCE" && f.severity === "critical"),
    );
  });

  it("KFP-003 / X10 : V0 reste REPRENABLE, 1.2 → CORROMPU (PATH_NOT_DIGEST)", async () => {
    const x10 = CORPUS_CASES.find((c) => c.id === "X10");
    assert.ok(x10, "CORPUS X10 absent");

    const v0 = await certify(x10.payload);
    assert.equal(v0.verdict, "REPRENABLE", "V0 gelé sur KFP-003");
    assert.equal(v0.ruleset, "1.0");
    assert.equal(
      v0.findings.some((f) => f.code === "PATH_NOT_DIGEST"),
      false,
      "V0 ne refuse pas un chemin sans empreinte",
    );

    const v12 = await certify12(x10.payload);
    assert.equal(v12.verdict, "CORROMPU", "1.2 : chemin n'est pas une empreinte");
    assert.equal(v12.ruleset, RULESET_12);
    assert.ok(
      v12.findings.some(
        (f) => f.code === "PATH_NOT_DIGEST" && f.severity === "critical",
      ),
      "PATH_NOT_DIGEST critical",
    );

    const findings = analyze12(normalize(x10.payload));
    assert.ok(
      findings.some((f) => f.code === "PATH_NOT_DIGEST" && f.severity === "critical"),
    );
  });

  it("KFP-004 / X16 : V0 reste REPRENABLE, 1.2 → CORROMPU (CHAT_NOT_TOOL)", async () => {
    const x16 = CORPUS_CASES.find((c) => c.id === "X16");
    assert.ok(x16, "CORPUS X16 absent");

    const v0 = await certify(x16.payload);
    assert.equal(v0.verdict, "REPRENABLE", "V0 gelé sur KFP-004");
    assert.equal(v0.ruleset, "1.0");
    assert.equal(
      v0.findings.some((f) => f.code === "CHAT_NOT_TOOL"),
      false,
      "V0 ne refuse pas un ledger de chat",
    );

    const v12 = await certify12(x16.payload);
    assert.equal(v12.verdict, "CORROMPU", "1.2 : chat n'est pas un tool_result");
    assert.equal(v12.ruleset, RULESET_12);
    assert.ok(
      v12.findings.some(
        (f) => f.code === "CHAT_NOT_TOOL" && f.severity === "critical",
      ),
      "CHAT_NOT_TOOL critical",
    );

    const findings = analyze12(normalize(x16.payload));
    assert.ok(
      findings.some((f) => f.code === "CHAT_NOT_TOOL" && f.severity === "critical"),
    );
  });

  it("clean_validation : 1.2 reste REPRENABLE", async () => {
    const clean = getCase("clean_validation");
    assert.ok(clean, "clean_validation absent");

    const v0 = await certify(clean.payload);
    const v12 = await certify12(clean.payload);
    assert.equal(v0.verdict, "REPRENABLE");
    assert.equal(v12.verdict, "REPRENABLE");
    assert.equal(v12.ruleset, "1.2");
    assert.equal(
      v12.findings.some((f) =>
        ["SPEC_NOT_EVIDENCE", "PATH_NOT_DIGEST", "CHAT_NOT_TOOL"].includes(f.code),
      ),
      false,
    );
  });

  it("KFP-001 / X07 : 1.2 hérite CONTRADICTION_BOOLEAN de 1.1", async () => {
    const x07 = CORPUS_CASES.find((c) => c.id === "X07");
    assert.ok(x07, "CORPUS X07 absent");

    const v0 = await certify(x07.payload);
    assert.equal(v0.verdict, "REPRENABLE", "V0 gelé sur KFP-001");

    const v12 = await certify12(x07.payload);
    assert.equal(v12.verdict, "CORROMPU");
    assert.ok(
      v12.findings.some(
        (f) => f.code === "CONTRADICTION_BOOLEAN" && f.severity === "critical",
      ),
    );
  });

  it("CTL-style : claim succès + status FAIL string → V0 et 1.2 CORROMPU", async () => {
    const ctl = attackCorpus().find((a) => a.id === "CTL-FAIL-TOKEN");
    assert.ok(ctl, "CTL-FAIL-TOKEN absent");

    const v0 = await certify(ctl.packet);
    const v12 = await certify12(ctl.packet);
    assert.equal(v0.verdict, "CORROMPU", "V0 voit le token FAIL");
    assert.equal(v12.verdict, "CORROMPU", "1.2 conserve le lexique V0");
    assert.ok(
      v12.findings.some((f) => f.code === "CONTRADICTION_CLAIM_EVIDENCE"),
      "1.2 part de analyze11 → analyze() V0",
    );
  });
});
