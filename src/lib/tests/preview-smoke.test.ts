import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { TestContext } from "node:test";

const BASE = "http://127.0.0.1:8080";
const TIMEOUT_MS = 10_000;

/** Fetch the parent preview. Skip (not fail) when it is unreachable. */
async function fetchLive(
  t: TestContext,
  path: string,
  init?: RequestInit,
): Promise<Response | null> {
  try {
    return await fetch(`${BASE}${path}`, {
      ...init,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch {
    t.skip(`parent ${BASE} unreachable`);
    return null;
  }
}

describe("preview smoke (parent :8080)", () => {
  it("GET / → 200, contains Verdict or HANDOFF", async (t) => {
    const res = await fetchLive(t, "/");
    if (!res) return;
    assert.equal(res.status, 200);
    const body = await res.text();
    assert.ok(
      body.includes("Verdict") || body.includes("HANDOFF"),
      'body must contain "Verdict" or "HANDOFF"',
    );
  });

  it("GET /verdict → 200", async (t) => {
    const res = await fetchLive(t, "/verdict");
    if (!res) return;
    assert.equal(res.status, 200);
  });

  it("GET /attaque → 200, body mentions 1.0 or V0", async (t) => {
    const res = await fetchLive(t, "/attaque");
    if (!res) return;
    assert.equal(res.status, 200);
    const body = await res.text();
    assert.ok(
      body.includes("1.0") || body.includes("V0"),
      'body must mention "1.0" or "V0"',
    );
  });

  it("GET /cap → 200, body mentions 2030", async (t) => {
    const res = await fetchLive(t, "/cap");
    if (!res) return;
    assert.equal(res.status, 200);
    const body = await res.text();
    assert.ok(body.includes("2030"), 'body must mention "2030"');
  });

  it("GET /api/v1/cap → 200 JSON zéros honnêtes", async (t) => {
    const res = await fetchLive(t, "/api/v1/cap");
    if (!res) return;
    assert.equal(res.status, 200);
    const json = (await res.json()) as {
      live?: { certs?: unknown; graphs?: unknown; arr_eur?: unknown; billing?: unknown };
      horizon?: unknown;
      targets?: unknown;
    };
    assert.equal(json.live?.certs, 0);
    assert.equal(json.live?.graphs, 0);
    assert.equal(json.live?.arr_eur, 0);
    assert.equal(json.live?.billing, "preview");
    assert.equal(json.horizon, "2030");
    assert.ok(Array.isArray(json.targets) && json.targets.length === 4, "4 cibles");
  });

  it("GET /api/v1/certify → 200 JSON sku", async (t) => {
    const res = await fetchLive(t, "/api/v1/certify");
    if (!res) return;
    assert.equal(res.status, 200);
    const json = (await res.json()) as { sku?: unknown };
    assert.equal(typeof json.sku, "string");
    assert.ok(String(json.sku).length > 0, "sku must be present");
  });

  it("POST /api/v1/certify with valid-ish JSON is not 500", async (t) => {
    const res = await fetchLive(t, "/api/v1/certify", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        paquet: {
          from: "a",
          to: "b",
          task: "smoke",
          work_done: [],
          work_remaining: ["suite"],
        },
      }),
    });
    if (!res) return;
    assert.notEqual(res.status, 500);
  });

  it("GET /cap → 200", async (t) => {
    const res = await fetchLive(t, "/cap");
    if (!res) return;
    assert.equal(res.status, 200);
  });

  it("GET /en/cap → 200, English copy", async (t) => {
    const res = await fetchLive(t, "/en/cap");
    if (!res) return;
    assert.equal(res.status, 200);
    const body = await res.text();
    assert.ok(
      body.includes("The TLS of agent handoffs") || body.includes("total freedom"),
      "English Cap copy missing",
    );
  });

  it("GET /en/offre → 200", async (t) => {
    const res = await fetchLive(t, "/en/offre");
    if (!res) return;
    assert.equal(res.status, 200);
  });
});
