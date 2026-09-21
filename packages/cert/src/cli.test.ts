import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { main, parseArgs, USAGE } from "./cli.ts";
import { RECEIPT_SKU, VERSION } from "./types.ts";

const bin = join(dirname(fileURLToPath(import.meta.url)), "..", "bin", "handoff-cert.mjs");

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("parseArgs", () => {
  it("help on empty / --help", () => {
    assert.equal(parseArgs([]).ok && parseArgs([]).command, "help");
    const h = parseArgs(["--help"]);
    assert.ok(h.ok && h.command === "help");
  });

  it("certify defaults ruleset 1.0", () => {
    const p = parseArgs(["certify", "pkt.json"]);
    assert.ok(p.ok && p.command === "certify");
    if (p.ok && p.command === "certify") {
      assert.equal(p.ruleset, "1.0");
      assert.equal(p.file, "pkt.json");
    }
  });

  it("gate --ruleset 1.2 --url", () => {
    const p = parseArgs(["gate", "--ruleset", "1.2", "--url", "http://x", "-"]);
    assert.ok(p.ok && p.command === "gate");
    if (p.ok && p.command === "gate") {
      assert.equal(p.ruleset, "1.2");
      assert.equal(p.url, "http://x");
      assert.equal(p.file, "-");
    }
  });

  it("rejects unknown command and unknown ruleset", () => {
    const u = parseArgs(["publish"]);
    assert.equal(u.ok, false);
    const r = parseArgs(["certify", "--ruleset", "9.9"]);
    assert.equal(r.ok, false);
  });

  it("catalogue takes no file", () => {
    const bad = parseArgs(["catalogue", "x.json"]);
    assert.equal(bad.ok, false);
    const ok = parseArgs(["catalogue", "--url=http://localhost:8080"]);
    assert.ok(ok.ok && ok.command === "catalogue");
  });
});

describe("main", () => {
  it("prints usage and version", async () => {
    const lines: string[] = [];
    const code = await main(["help"], { stdout: (l) => lines.push(l) });
    assert.equal(code, 0);
    assert.match(lines.join("\n"), /handoff-cert certify/);
    assert.match(USAGE, /No paying customers|no paying customers/);
    const ver: string[] = [];
    assert.equal(await main(["version"], { stdout: (l) => ver.push(l) }), 0);
    assert.equal(ver[0], VERSION);
  });

  it("certify writes JSON, gate STOP exits 2", async () => {
    const offer = {
      sku: RECEIPT_SKU,
      price_eur: 0.001,
      billing: "preview",
    };
    const fetchImpl: typeof fetch = async (_url, init) => {
      const body = JSON.parse(String(init?.body ?? "{}")) as { ruleset?: string };
      const verdict = body.ruleset === "1.2" ? "CORROMPU" : "REPRENABLE";
      return jsonResponse(200, {
        certificate: {
          verdict,
          confidence: 0.4,
          missing: [],
          conflicts: [],
          warnings: [],
          certificate_id: "c",
          ruleset: body.ruleset ?? "1.0",
          input_hash: "sha256:x",
          timestamp: "t",
        },
        integrite: "non_fourni",
        offer,
        payment: { billing: "preview" },
      });
    };
    const out: string[] = [];
    const certifyCode = await main(["certify", "--ruleset", "1.0"], {
      fetch: fetchImpl,
      readInput: async () =>
        JSON.stringify({ from: "a", to: "b", task: "t", work_done: [], work_remaining: ["x"] }),
      stdout: (l) => out.push(l),
    });
    assert.equal(certifyCode, 0);
    const certBody = JSON.parse(out[0] ?? "{}") as {
      certificate: { verdict: string };
      offer: { billing: string };
    };
    assert.equal(certBody.certificate.verdict, "REPRENABLE");
    assert.equal(certBody.offer.billing, "preview");

    const gateOut: string[] = [];
    const gateCode = await main(["gate", "--ruleset=1.2"], {
      fetch: fetchImpl,
      readInput: async () => JSON.stringify({ paquet: { from: "a" } }),
      stdout: (l) => gateOut.push(l),
    });
    assert.equal(gateCode, 2);
    const gateBody = JSON.parse(gateOut[0] ?? "{}") as { decision: string; couple: string };
    assert.equal(gateBody.decision, "STOP");
    assert.equal(gateBody.couple, "CERT+GATE");
  });

  it("JSON invalide exits 1", async () => {
    const err: string[] = [];
    const code = await main(["certify"], {
      readInput: async () => "not-json",
      stderr: (l) => err.push(l),
      fetch: async () => jsonResponse(200, {}),
    });
    assert.equal(code, 1);
    assert.match(err.join("\n"), /JSON invalide/);
  });
});

describe("npx handoff-cert bin", () => {
  it("version via bin wrapper", () => {
    const r = spawnSync(process.execPath, [bin, "version"], { encoding: "utf8" });
    assert.equal(r.status, 0, r.stderr);
    assert.equal(r.stdout.trim(), VERSION);
  });

  it("unknown command exits 1", () => {
    const r = spawnSync(process.execPath, [bin, "npm-publish"], { encoding: "utf8" });
    assert.equal(r.status, 1);
    assert.match(r.stderr, /unknown command/);
  });
});
