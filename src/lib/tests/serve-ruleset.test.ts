import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  catalogueRulesets,
  parseBodyRuleset,
  serveCertify,
} from "../offer/serve.ts";
import { OFFER, OFFERS } from "../offer/catalog.ts";
import { GATE_SKU, RECEIPT } from "../offer/mission.ts";
import { attackCorpus } from "../bench/attack.ts";

function kfp001Packet(): unknown {
  const kfp = attackCorpus().find((a) => a.id === "KFP-001");
  assert.ok(kfp, "KFP-001 absent");
  return kfp.packet;
}

function kfp002Packet(): unknown {
  const kfp = attackCorpus().find((a) => a.id === "KFP-002");
  assert.ok(kfp, "KFP-002 absent");
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

  it("body with ruleset 1.2 on KFP-001 → CORROMPU, sku still handoff-cert-v1", async () => {
    const res = await serveCertify({ paquet: kfp001Packet(), ruleset: "1.2" });
    assert.equal(res.certificate.verdict, "CORROMPU");
    assert.equal(res.certificate.ruleset, "1.2");
    assert.equal(res.offer.sku, "handoff-cert-v1");
    assert.equal(parseBodyRuleset({ paquet: kfp001Packet(), ruleset: "1.2" }), "1.2");
  });

  it("body with ruleset 1.2 on KFP-002 → CORROMPU ; omit stays 1.0 REPRENABLE", async () => {
    const omit = await serveCertify({ paquet: kfp002Packet() });
    assert.equal(omit.certificate.verdict, "REPRENABLE");
    assert.equal(omit.certificate.ruleset, "1.0");
    assert.equal(omit.offer.sku, "handoff-cert-v1");

    const res = await serveCertify({ paquet: kfp002Packet(), ruleset: "1.2" });
    assert.equal(res.certificate.verdict, "CORROMPU");
    assert.equal(res.certificate.ruleset, "1.2");
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

  it("GET catalogue lists receipt 1.0 0.001 and gate 1.2 0.05 from mission.ts", () => {
    const cat = catalogueRulesets();
    assert.equal(cat.sku, "handoff-cert-v1");
    assert.equal(cat.ruleset, "1.0");
    assert.deepEqual(cat.rulesets, ["1.0", "1.1", "1.2"]);
    assert.equal(OFFER.ruleset, "1.0");
    assert.equal(OFFER.sku, "handoff-cert-v1");
    assert.equal(cat.skus.length, 2);
    assert.equal(OFFERS.length, 2);
    assert.equal(cat.skus[0]?.sku, RECEIPT.sku);
    assert.equal(cat.skus[0]?.ruleset, "1.0");
    assert.equal(cat.skus[0]?.price_eur, 0.001);
    assert.equal(cat.skus[0]?.price_eur, RECEIPT.price_eur);
    assert.equal(cat.skus[1]?.sku, GATE_SKU.sku);
    assert.equal(cat.skus[1]?.ruleset, "1.2");
    assert.equal(cat.skus[1]?.price_eur, 0.05);
    assert.equal(cat.skus[1]?.price_eur, GATE_SKU.price_eur);
  });
});
