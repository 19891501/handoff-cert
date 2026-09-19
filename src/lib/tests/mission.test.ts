import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { OFFER } from "../offer/catalog.ts";
import { GATE_SKU, MISSION, NEVER, RECEIPT, TARGETS } from "../offer/mission.ts";

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
});
