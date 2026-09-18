import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  SIGN_ALG_ED25519,
  signPublicCertificate,
  signingAlgorithm,
  verifyPublicCertificate,
} from "../handoff/sign.ts";
import type { PublicCertificate } from "../handoff/types.ts";

function samplePub(over: Partial<PublicCertificate> = {}): PublicCertificate {
  return {
    verdict: "REPRENABLE",
    confidence: 0.91,
    missing: [],
    conflicts: [],
    warnings: [],
    certificate_id: "hc_deadbeefcafe",
    ruleset: "1.0",
    input_hash: `sha256:${"ab".repeat(32)}`,
    timestamp: "2026-01-01T00:00:00.000Z",
    ...over,
  };
}

describe("signPublicCertificate", () => {
  it("roundtrip: valid signature verifies", async () => {
    const secret = crypto.getRandomValues(new Uint8Array(32));
    const pub = samplePub();
    const { signature, key_id } = await signPublicCertificate(pub, secret);
    assert.equal(await signingAlgorithm(), SIGN_ALG_ED25519);
    assert.equal(typeof signature, "string");
    assert.equal(signature.length, 128);
    assert.match(key_id, /^ed25519:[0-9a-f]{16}$/);
    assert.equal(await verifyPublicCertificate(pub, signature, secret), true);
  });

  it("tampered verdict fails verify", async () => {
    const secret = crypto.getRandomValues(new Uint8Array(32));
    const pub = samplePub({ verdict: "REPRENABLE" });
    const { signature } = await signPublicCertificate(pub, secret);
    const tampered = { ...pub, verdict: "CORROMPU" as const };
    assert.equal(await verifyPublicCertificate(tampered, signature, secret), false);
    assert.equal(await verifyPublicCertificate(pub, signature, secret), true);
  });
});
