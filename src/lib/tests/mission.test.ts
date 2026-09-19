import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { OFFER, TIERS, previewCheckout } from "../offer/catalog.ts";
import { GATE_SKU, LICENCE, MISSION, NEVER, RECEIPT, TARGETS } from "../offer/mission.ts";

describe("mission commerciale", () => {
  it("V0 reste le SKU reçu, pas la grille", () => {
    assert.equal(OFFER.sku, RECEIPT.sku);
    assert.equal(OFFER.ruleset, "1.0");
    assert.equal(RECEIPT.ruleset, "1.0");
    assert.equal(GATE_SKU.ruleset, "1.2");
    assert.ok(GATE_SKU.price_eur > RECEIPT.price_eur);
  });

  it("objectifs énormes, sans vendre V0 comme sûr", () => {
    assert.equal(MISSION.horizon, "2030");
    assert.equal(TARGETS.length, 4);
    assert.ok(NEVER.some((n) => /V0/.test(n)));
    assert.ok(MISSION.sentence.includes("1.2"));
  });

  it("trois paliers : reçu, grille, licence 48k", () => {
    assert.equal(TIERS.length, 3);
    assert.equal(TIERS[0], RECEIPT);
    assert.equal(TIERS[1], GATE_SKU);
    assert.equal(TIERS[2], LICENCE);
    assert.equal(RECEIPT.price_eur, 0.001);
    assert.equal(GATE_SKU.price_eur, 0.05);
    assert.equal(LICENCE.price_eur, 48_000);
    assert.equal(LICENCE.period, "an");
    assert.equal(LICENCE.sold, false);
    assert.equal(OFFER.billing, "preview");
  });

  it("checkout preview : jamais un succès, jamais un hash", () => {
    for (const tier of TIERS) {
      const out = previewCheckout(tier.sku);
      assert.equal(out.success, false, tier.sku);
      assert.equal(out.charged, false, tier.sku);
      assert.equal(out.transaction, "", tier.sku);
      assert.equal(out.billing, "preview", tier.sku);
    }
    const ghost = previewCheckout("sku-inventé");
    assert.equal(ghost.success, false);
    assert.equal(ghost.charged, false);
    assert.equal(ghost.transaction, "");
    const licence = previewCheckout(LICENCE.sku);
    assert.match(licence.reason, /pas encore encaissé/);
  });
});
