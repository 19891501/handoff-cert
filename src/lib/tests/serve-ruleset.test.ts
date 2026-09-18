import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  catalogueRulesets,
  parseBodyRuleset,
  serveCertify,
} from "../offer/serve.ts";
import { OFFER } from "../offer/catalog.ts";
import { attackCorpus } from "../bench/attack.ts";

function kfp001Packet(): unknown {
  const kfp = attackCorpus().find((a) => a.id === "KFP-001");
  assert.ok(kfp, "KFP-001 absent");
  return kfp.packet;
}

describe("serve / HTTP ruleset", () => {
  it("omit ruleset on KFP-001 → REPRENABLE (1.0), sku handoff-cert-v1", async () => {
    const res = await serveCertify({ paquet: kfp001Packet() });
    assert.equal(res.certificate.verdict, "REPRENABLE");
    assert.equal(res.certificate.ruleset, "1.0");
    assert.equal(res.offer.sku, "handoff-cert-v1");
    assert.equal(parseBodyRuleset({ paquet: kfp001Packet() }), "1.0");
  });

  it("body with ruleset 1.1 on KFP-001 → CORROMPU, sku still handoff-cert-v1", async () => {
    const res = await serveCertify({ paquet: kfp001Packet(), ruleset: "1.1" });
    assert.equal(res.certificate.verdict, "CORROMPU");
    assert.equal(res.certificate.ruleset, "1.1");
    assert.equal(res.offer.sku, "handoff-cert-v1");
  });

  it("explicit ruleset 1.0 on KFP-001 stays REPRENABLE", async () => {
    const res = await serveCertify({ paquet: kfp001Packet(), ruleset: "1.0" });
    assert.equal(res.certificate.verdict, "REPRENABLE");
    assert.equal(res.certificate.ruleset, "1.0");
    assert.equal(res.offer.sku, OFFER.sku);
  });

  it("unknown ruleset throws (HTTP 400)", () => {
    assert.throws(
      () => parseBodyRuleset({ paquet: kfp001Packet(), ruleset: "2.0" }),
      /ruleset inconnu/,
    );
    assert.throws(
      () => parseBodyRuleset({ ruleset: "v1" }),
      /ruleset inconnu/,
    );
  });

  it("GET catalogue mentions 1.0 and 1.1 ; sold SKU remains 1.0", () => {
    const cat = catalogueRulesets();
    assert.equal(cat.sku, "handoff-cert-v1");
    assert.equal(cat.ruleset, "1.0");
    assert.deepEqual(cat.rulesets, ["1.0", "1.1"]);
    assert.equal(OFFER.ruleset, "1.0");
    assert.equal(OFFER.sku, "handoff-cert-v1");
  });
});
