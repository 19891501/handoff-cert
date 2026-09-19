import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  HandoffCert,
  certify,
  catalogue,
  gateResume,
  parseRuleset,
  resolveBaseUrl,
} from "./client.ts";
import { fromCertificate } from "./gate.ts";
import { HandoffCertError, PaymentRequiredError } from "./errors.ts";
import type { CertifyResponse, PublicCertificate } from "./types.ts";
import { DEFAULT_BASE_URL, RECEIPT_SKU } from "./types.ts";

const here = dirname(fileURLToPath(import.meta.url));

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function cert(verdict: PublicCertificate["verdict"], ruleset = "1.0"): CertifyResponse {
  return {
    certificate: {
      verdict,
      confidence: 0.5,
      missing: [],
      conflicts: [],
      warnings: [],
      certificate_id: "c1",
      ruleset,
      input_hash: "sha256:abc",
      timestamp: "2026-09-19T00:00:00Z",
    },
    integrite: "non_fourni",
    offer: {
      sku: RECEIPT_SKU,
      price_eur: 0.001,
      currency: "EUR",
      billing: "preview",
      unit: "certificat",
    },
    payment: { billing: "preview" },
  };
}

describe("package.json export path", () => {
  it("exports . to dist/index.js and bins handoff-cert", () => {
    const pkg = JSON.parse(
      readFileSync(join(here, "..", "package.json"), "utf8"),
    ) as {
      name: string;
      private: boolean;
      exports: { ".": { types: string; import: string } };
      bin: { "handoff-cert": string };
      types: string;
      main: string;
    };
    assert.equal(pkg.name, "@handoff/cert");
    assert.equal(pkg.private, false);
    assert.equal(pkg.exports["."].import, "./dist/index.js");
    assert.equal(pkg.exports["."].types, "./dist/index.d.ts");
    assert.equal(pkg.types, "./dist/index.d.ts");
    assert.equal(pkg.main, "./dist/index.js");
    assert.equal(pkg.bin["handoff-cert"], "./bin/handoff-cert.mjs");
  });

  it("does not claim paying customers", () => {
    const pkg = JSON.parse(readFileSync(join(here, "..", "package.json"), "utf8")) as {
      description: string;
    };
    assert.match(pkg.description, /No paying customers/);
    assert.doesNotMatch(pkg.description, /customers?: \d/i);
  });
});

describe("resolveBaseUrl / parseRuleset", () => {
  it("defaults to localhost:8080", () => {
    assert.equal(resolveBaseUrl(undefined, {}), DEFAULT_BASE_URL);
    assert.equal(resolveBaseUrl("http://example.test/"), "http://example.test");
    assert.equal(
      resolveBaseUrl(undefined, { HANDOFF_CERT_URL: "http://paid.example" }),
      "http://paid.example",
    );
  });

  it("parses sold rulesets and rejects unknown", () => {
    assert.equal(parseRuleset(undefined), "1.0");
    assert.equal(parseRuleset("1.2"), "1.2");
    assert.throws(() => parseRuleset("2.0"), /ruleset inconnu/);
  });
});

describe("HandoffCert mock HTTP", () => {
  it("POST certify sends paquet + ruleset", async () => {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    const client = new HandoffCert({
      baseUrl: "http://cert.test",
      fetch: async (url, init) => {
        calls.push({ url: String(url), init: init ?? {} });
        return jsonResponse(200, cert("REPRENABLE"));
      },
    });
    const res = await client.certify({ from: "a", to: "b" }, { ruleset: "1.0" });
    assert.equal(res.certificate.verdict, "REPRENABLE");
    assert.equal(res.offer.billing, "preview");
    assert.equal(res.offer.sku, RECEIPT_SKU);
    assert.equal(calls[0]?.url, "http://cert.test/api/v1/certify");
    assert.equal(calls[0]?.init.method, "POST");
    const sent = JSON.parse(String(calls[0]?.init.body)) as { ruleset: string };
    assert.equal(sent.ruleset, "1.0");
  });

  it("forwards X-PAYMENT when provided — never invents one", async () => {
    let header = "";
    const client = new HandoffCert({
      payment: "exact:test",
      fetch: async (_url, init) => {
        const h = new Headers(init?.headers);
        header = h.get("X-PAYMENT") ?? "";
        return jsonResponse(200, cert("PARTIEL"));
      },
    });
    await client.certify({});
    assert.equal(header, "exact:test");
    const naked = new HandoffCert({
      fetch: async (_url, init) => {
        const h = new Headers(init?.headers);
        assert.equal(h.get("X-PAYMENT"), null);
        return jsonResponse(200, cert("PARTIEL"));
      },
    });
    await naked.certify({});
  });

  it("402 → PaymentRequiredError with server body, no fake tx", async () => {
    const client = new HandoffCert({
      fetch: async () => jsonResponse(402, { error: "x402", accepts: [] }),
    });
    await assert.rejects(
      () => client.certify({}),
      (e: unknown) => {
        assert.ok(e instanceof PaymentRequiredError);
        assert.equal(e.status, 402);
        assert.deepEqual(e.body, { error: "x402", accepts: [] });
        return true;
      },
    );
  });

  it("400 → HandoffCertError", async () => {
    const client = new HandoffCert({
      fetch: async () => jsonResponse(400, { erreur: "JSON invalide" }),
    });
    await assert.rejects(() => client.certify({}), /JSON invalide/);
    await assert.rejects(() => client.certify({}), (e: unknown) => e instanceof HandoffCertError);
  });

  it("GET catalogue", async () => {
    const client = new HandoffCert({
      fetch: async (url, init) => {
        assert.equal(String(url), "http://localhost:8080/api/v1/certify");
        assert.equal(init?.method, "GET");
        return jsonResponse(200, {
          sku: RECEIPT_SKU,
          endpoint: "/api/v1/certify",
          price_eur: 0.001,
          billing: "preview",
          method: "POST",
          ruleset: "1.0",
          rulesets: ["1.0", "1.1", "1.2"],
        });
      },
    });
    const cat = await client.catalogue();
    assert.equal(cat.sku, RECEIPT_SKU);
    assert.deepEqual(cat.rulesets, ["1.0", "1.1", "1.2"]);
    assert.equal(cat.billing, "preview");
  });

  it("module certify/gateResume/catalogue helpers", async () => {
    const fetchImpl: typeof fetch = async (_url, init) => {
      if ((init?.method ?? "GET") === "GET") {
        return jsonResponse(200, {
          sku: RECEIPT_SKU,
          endpoint: "/api/v1/certify",
          price_eur: 0.001,
          billing: "preview",
          method: "POST",
          ruleset: "1.0",
          rulesets: ["1.0", "1.1", "1.2"],
        });
      }
      return jsonResponse(200, cert("REPRENABLE"));
    };
    const c = await certify({ from: "a" }, { fetch: fetchImpl });
    assert.equal(c.certificate.verdict, "REPRENABLE");
    const g = await gateResume({ from: "a" }, { fetch: fetchImpl, ruleset: "1.0" });
    assert.equal(g.decision, "PASS");
    const cat = await catalogue({ fetch: fetchImpl });
    assert.equal(cat.billing, "preview");
  });
});

describe("fromCertificate / gateResume couple", () => {
  it("REPRENABLE → PASS (V0)", () => {
    const g = fromCertificate(cert("REPRENABLE", "1.0"), "1.0");
    assert.equal(g.couple, "CERT+GATE");
    assert.equal(g.decision, "PASS");
    assert.match(g.reason, /V0 : REPRENABLE/);
  });

  it("CORROMPU → STOP", () => {
    const g = fromCertificate(cert("CORROMPU", "1.2"), "1.2");
    assert.equal(g.decision, "STOP");
    assert.match(g.reason, /V1\.2 : CORROMPU/);
  });

  it("PARTIEL → STOP", () => {
    const g = fromCertificate(cert("PARTIEL", "1.0"), "1.0");
    assert.equal(g.decision, "STOP");
    assert.match(g.reason, /PARTIEL/);
  });

  it("gateResume 1.2 STOP on CORROMPU", async () => {
    const client = new HandoffCert({
      fetch: async () => jsonResponse(200, cert("CORROMPU", "1.2")),
    });
    const g = await client.gateResume({ kfp: 1 }, { ruleset: "1.2" });
    assert.equal(g.decision, "STOP");
    assert.equal(g.verdict, "CORROMPU");
    assert.equal(g.ruleset, "1.2");
  });
});
