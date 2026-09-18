import { certify, toPublicCertificate, verify } from "@/lib/handoff/engine";
import { certify11 } from "@/lib/handoff/ruleset11";
import { issuerSigOnWire, type IssuerSig } from "@/lib/handoff/sign";
import type { Certificate, PublicCertificate } from "@/lib/handoff/types";
import { OFFER } from "./catalog";

export type SoldRuleset = "1.0" | "1.1";

export type WiredCertificate = PublicCertificate & {
  issuer_sig?: IssuerSig;
};

export interface CertifyResponse {
  certificate: WiredCertificate;
  integrite: "non_fourni";
  offer: {
    sku: string;
    price_eur: number;
    currency: string;
    billing: typeof OFFER.billing;
    unit: string;
  };
}

export function catalogueRulesets(): {
  sku: string;
  ruleset: "1.0";
  rulesets: SoldRuleset[];
} {
  return {
    sku: OFFER.sku,
    ruleset: "1.0",
    rulesets: ["1.0", "1.1"],
  };
}

export function parseBodyRuleset(body: unknown): SoldRuleset {
  if (!body || typeof body !== "object" || !("ruleset" in body)) return "1.0";
  const raw = (body as { ruleset?: unknown }).ruleset;
  if (raw == null || raw === "") return "1.0";
  const value = String(raw);
  if (value === "1.0" || value === "1.1") return value;
  throw new Error(`ruleset inconnu: ${value}`);
}

function extractPaquet(body: unknown): unknown {
  if (body && typeof body === "object" && "paquet" in body) {
    return (body as { paquet: unknown }).paquet;
  }
  if (body && typeof body === "object" && "ruleset" in body) {
    const { ruleset: _drop, ...rest } = body as Record<string, unknown>;
    return rest;
  }
  return body;
}

async function withIssuerSig(pub: PublicCertificate): Promise<WiredCertificate> {
  const issuer_sig = await issuerSigOnWire(pub);
  if (!issuer_sig) return pub;
  return { ...pub, issuer_sig };
}

function offerBlock() {
  return {
    sku: OFFER.sku,
    price_eur: OFFER.price_eur,
    currency: OFFER.currency,
    billing: OFFER.billing,
    unit: OFFER.unit,
  };
}

export async function serveCertify(body: unknown): Promise<CertifyResponse> {
  const ruleset = parseBodyRuleset(body);
  const packet = extractPaquet(body);
  const cert = ruleset === "1.1" ? await certify11(packet) : await certify(packet);
  return {
    certificate: await withIssuerSig(toPublicCertificate(cert)),
    integrite: "non_fourni",
    offer: offerBlock(),
  };
}

export async function serveVerify(
  body: unknown,
): Promise<{ valid: boolean; input_match: boolean; verdict_match: boolean; ruleset_match: boolean }> {
  const obj = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const paquet = "paquet" in obj ? obj.paquet : obj.input;
  const certificate = obj.certificate as Certificate | PublicCertificate | undefined;
  if (!certificate) {
    throw new Error("certificate manquant");
  }
  const result = await verify(paquet, certificate);
  return {
    valid: result.valid,
    input_match: result.input_match,
    verdict_match: result.verdict_match,
    ruleset_match: result.ruleset_match,
  };
}
