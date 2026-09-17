import { certify, toPublicCertificate, verify } from "@/lib/handoff/engine";
import type { Certificate, PublicCertificate } from "@/lib/handoff/types";
import { OFFER } from "./catalog";

export interface CertifyResponse {
  certificate: PublicCertificate;
  integrite: "non_fourni";
  offer: {
    sku: string;
    price_eur: number;
    currency: string;
    billing: typeof OFFER.billing;
    unit: string;
  };
}

function extractPaquet(body: unknown): unknown {
  if (body && typeof body === "object" && "paquet" in body) {
    return (body as { paquet: unknown }).paquet;
  }
  return body;
}

export async function serveCertify(body: unknown): Promise<CertifyResponse> {
  const cert = await certify(extractPaquet(body));
  return {
    certificate: toPublicCertificate(cert),
    integrite: "non_fourni",
    offer: {
      sku: OFFER.sku,
      price_eur: OFFER.price_eur,
      currency: OFFER.currency,
      billing: OFFER.billing,
      unit: OFFER.unit,
    },
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
