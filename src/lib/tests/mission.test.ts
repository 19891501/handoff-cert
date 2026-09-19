import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { OFFER } from "../offer/catalog.ts";
import { GATE_SKU, MISSION, NEVER, RECEIPT, TARGETS } from "../offer/mission.ts";
import { capCopy, offreCopy } from "../i18n/copy.ts";
import { localeFromPath, pageHref } from "../i18n/locale.ts";

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

describe("i18n Cap + Offre", () => {
  it("chemin /en bascule en anglais", () => {
    assert.equal(localeFromPath("/cap"), "fr");
    assert.equal(localeFromPath("/offre"), "fr");
    assert.equal(localeFromPath("/en/cap"), "en");
    assert.equal(localeFromPath("/en/offre"), "en");
    assert.equal(pageHref("cap", "en"), "/en/cap");
    assert.equal(pageHref("offre", "fr"), "/offre");
  });

  it("EN : 2030, 1.2 grille, V0 pas une reprise sûre", () => {
    const cap = capCopy("en");
    assert.ok(cap.kicker.includes("2030"));
    assert.ok(cap.sentence.includes("1.2"));
    assert.ok(cap.never.some((n) => /V0/.test(n)));
    assert.equal(cap.targets.length, 4);
    const offre = offreCopy("en");
    assert.ok(offre.not.some((n) => /V0/.test(n)));
    assert.ok(offre.twoSkus.includes("1.0"));
    assert.ok(offre.twoSkus.includes("1.2"));
  });

  it("FR reste aligné sur la mission", () => {
    const cap = capCopy("fr");
    assert.equal(cap.name, MISSION.name);
    assert.equal(cap.sentence, MISSION.sentence);
    assert.deepEqual([...cap.never], [...NEVER]);
  });
});
