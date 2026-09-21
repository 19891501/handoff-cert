import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { OFFER, OFFERS, TIERS, previewCheckout } from "../offer/catalog.ts";
import {
  GATE_SKU,
  KPI,
  LICENCE,
  LIVE,
  MISSION,
  NEVER,
  RECEIPT,
  TARGETS,
  liveIsHonestPreview,
  liveSnapshot,
  readLivePayload,
} from "../offer/mission.ts";
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
    assert.deepEqual(
      TARGETS.map((t) => t.id),
      ["certs", "graphs", "arr", "standard"],
    );
    assert.ok(NEVER.some((n) => /V0/.test(n)));
    assert.ok(MISSION.sentence.includes("1.2"));
  });

  it("KPI live : zéros honnêtes tant que preview", () => {
    assert.equal(LIVE.certs, 0);
    assert.equal(LIVE.graphs, 0);
    assert.equal(LIVE.arr_eur, 0);
    assert.equal(LIVE.billing, "preview");
    assert.equal(LIVE.paying_customers, 0);
    assert.equal(KPI.length, 3);
    const snap = liveSnapshot();
    assert.equal(liveIsHonestPreview(snap), true);
    assert.equal(OFFER.billing, LIVE.billing);
    const accepted = readLivePayload({ live: snap, targets: TARGETS });
    assert.deepEqual(accepted, snap);
    assert.equal(readLivePayload({ live: { ...snap, arr_eur: 50_000_000 } }), null);
    assert.equal(readLivePayload({ live: { ...snap, paying_customers: 1 } }), null);
    assert.equal(readLivePayload({ live: { ...snap, billing: "x402" } }), null);
  });

  it("OFFERS catalogue : reçu 1.0 0.001 et grille 1.2 0.05", () => {
    assert.equal(RECEIPT.sku, "handoff-cert-v1");
    assert.equal(RECEIPT.ruleset, "1.0");
    assert.equal(RECEIPT.price_eur, 0.001);
    assert.equal(GATE_SKU.sku, "handoff-gate-v12");
    assert.equal(GATE_SKU.ruleset, "1.2");
    assert.equal(GATE_SKU.price_eur, 0.05);
    assert.equal(OFFERS.length, 2);
    assert.equal(OFFERS[0], RECEIPT);
    assert.equal(OFFERS[1], GATE_SKU);
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
