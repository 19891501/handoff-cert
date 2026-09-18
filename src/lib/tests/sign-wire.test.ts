import { after, describe, it } from "node:test";
import assert from "node:assert/strict";
import { serveCertify } from "../offer/serve.ts";
import { issuerSecretFromEnv, verifyPublicCertificate } from "../handoff/sign.ts";
import { getCase } from "../handoff/cases.ts";

const savedSecret = process.env.ISSUER_SECRET;
const savedEd = process.env.ISSUER_ED25519_KEY;

function clearIssuerEnv() {
  delete process.env.ISSUER_SECRET;
  delete process.env.ISSUER_ED25519_KEY;
}

function hex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

function paquet() {
  return { paquet: getCase("clean_validation")!.payload };
}

after(() => {
  clearIssuerEnv();
  if (savedSecret !== undefined) process.env.ISSUER_SECRET = savedSecret;
  if (savedEd !== undefined) process.env.ISSUER_ED25519_KEY = savedEd;
});

describe("issuer_sig on the wire", () => {
  it("without env: no issuer_sig, integrite remains non_fourni", async () => {
    clearIssuerEnv();
    const res = await serveCertify(paquet());
    assert.equal(res.integrite, "non_fourni");
    assert.equal("issuer_sig" in res.certificate, false);
    assert.equal(res.certificate.issuer_sig, undefined);
    assert.equal(JSON.stringify(res.certificate).includes("issuer_sig"), false);
  });

  it("with ISSUER_SECRET: sig verifies; tamper fails; integrite still non_fourni", async () => {
    clearIssuerEnv();
    const secretBytes = crypto.getRandomValues(new Uint8Array(32));
    process.env.ISSUER_SECRET = hex(secretBytes);

    const res = await serveCertify(paquet());
    assert.equal(res.integrite, "non_fourni");
    const sig = res.certificate.issuer_sig;
    assert.ok(sig, "issuer_sig attached when secret is set");
    assert.equal(typeof sig.signature, "string");
    assert.ok(sig.signature.length > 0);
    assert.equal(typeof sig.key_id, "string");
    assert.ok(sig.key_id.length > 0);

    const material = issuerSecretFromEnv();
    assert.ok(material);
    assert.equal(await verifyPublicCertificate(res.certificate, sig.signature, material), true);

    const tampered = { ...res.certificate, verdict: "CORROMPU" as const };
    assert.equal(await verifyPublicCertificate(tampered, sig.signature, material), false);
  });

  it("with ISSUER_ED25519_KEY: sig verifies; tamper fails", async () => {
    clearIssuerEnv();
    const seed = crypto.getRandomValues(new Uint8Array(32));
    process.env.ISSUER_ED25519_KEY = hex(seed);

    const res = await serveCertify(paquet());
    assert.equal(res.integrite, "non_fourni");
    const sig = res.certificate.issuer_sig;
    assert.ok(sig, "issuer_sig attached when Ed25519 key is set");

    const material = issuerSecretFromEnv();
    assert.ok(material);
    assert.equal(await verifyPublicCertificate(res.certificate, sig.signature, material), true);

    const tampered = { ...res.certificate, input_hash: `sha256:${"00".repeat(32)}` };
    assert.equal(await verifyPublicCertificate(tampered, sig.signature, material), false);
  });
});
