import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { HandoffCert } from "./client.ts";
import { DEFAULT_BASE_URL, RECEIPT_SKU } from "./types.ts";

const kfpPath = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "..",
  "falsification",
  "cases",
  "KFP-001.json",
);

async function previewUp(): Promise<boolean> {
  try {
    const res = await fetch(`${DEFAULT_BASE_URL}/api/v1/certify`, {
      signal: AbortSignal.timeout(1500),
    });
    return res.ok;
  } catch {
    return false;
  }
}

describe("live preview :8080 (must stay up)", () => {
  it("GET catalogue is preview, sku receipt, no paying customers field", async (t) => {
    if (!(await previewUp())) {
      t.skip("preview :8080 not reachable — not taking it down, not inventing it");
      return;
    }
    const client = new HandoffCert();
    const cat = await client.catalogue();
    assert.equal(cat.sku, RECEIPT_SKU);
    assert.equal(cat.billing, "preview");
    assert.equal(cat.ruleset, "1.0");
    assert.ok(Array.isArray(cat.rulesets) && cat.rulesets.includes("1.0"));
    assert.ok(cat.rulesets.includes("1.2"));
    assert.ok(!("customers" in cat));
  });

  it("KFP-001 : 1.0 REPRENABLE PASS, 1.2 CORROMPU STOP — preview still 200", async (t) => {
    if (!(await previewUp())) {
      t.skip("preview :8080 not reachable");
      return;
    }
    const kfp = JSON.parse(readFileSync(kfpPath, "utf8")) as { input_packet: unknown };
    const client = new HandoffCert();
    const receipt = await client.certify(kfp.input_packet, { ruleset: "1.0" });
    assert.equal(receipt.certificate.verdict, "REPRENABLE");
    assert.equal(receipt.certificate.ruleset, "1.0");
    assert.equal(receipt.offer.billing, "preview");
    const g10 = await client.gateResume(kfp.input_packet, { ruleset: "1.0" });
    assert.equal(g10.decision, "PASS");

    const grille = await client.gateResume(kfp.input_packet, { ruleset: "1.2" });
    assert.equal(grille.decision, "STOP");
    assert.equal(grille.verdict, "CORROMPU");
    assert.equal(grille.ruleset, "1.2");

    const still = await fetch(`${DEFAULT_BASE_URL}/api/v1/certify`);
    assert.equal(still.ok, true, "preview :8080 must stay up");
  });
});
