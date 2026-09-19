/** Sold rulesets on POST /api/v1/certify. 1.0 = frozen receipt. 1.2 = paid grille. */
export type RulesetId = "1.0" | "1.1" | "1.2";

export type Verdict = "REPRENABLE" | "PARTIEL" | "CORROMPU";

export type GateDecision = "PASS" | "STOP";

export interface PublicCertificate {
  verdict: Verdict;
  confidence: number;
  missing: string[];
  conflicts: string[];
  warnings: string[];
  certificate_id: string;
  ruleset: string;
  input_hash: string;
  timestamp: string;
  issuer_sig?: unknown;
}

export interface OfferBlock {
  sku: string;
  price_eur: number;
  currency?: string;
  billing: string;
  unit?: string;
}

export interface PaymentBlock {
  billing?: string;
  payer?: string;
  transaction?: string;
  network?: string;
}

export interface CertifyResponse {
  certificate: PublicCertificate;
  integrite: string;
  offer: OfferBlock;
  payment?: PaymentBlock;
}

export interface GateResult {
  couple: "CERT+GATE";
  ruleset: RulesetId;
  decision: GateDecision;
  verdict: Verdict;
  reason: string;
  certificate: PublicCertificate;
  offer: OfferBlock;
  payment?: PaymentBlock;
}

export interface Catalogue {
  sku: string;
  endpoint: string;
  price_eur: number;
  billing: string;
  method: string;
  ruleset: string;
  rulesets: RulesetId[];
  x402?: Record<string, unknown>;
}

export interface ClientOptions {
  /** Origin of the certifier. Default: $HANDOFF_CERT_URL or http://localhost:8080 */
  baseUrl?: string;
  fetch?: typeof fetch;
  headers?: Record<string, string>;
  /** Raw X-PAYMENT value. Never invented. Absent → preview (200) if payTo is empty. */
  payment?: string;
  /** Override process.env (tests). HANDOFF_CERT_URL is read here. */
  env?: NodeJS.ProcessEnv;
}

export const VERSION = "0.1.0";
export const DEFAULT_BASE_URL = "http://localhost:8080";
export const CERTIFY_PATH = "/api/v1/certify";
export const RECEIPT_SKU = "handoff-cert-v1";
export const GATE_SKU = "handoff-gate-v12";
export const RECEIPT_PRICE_EUR = 0.001;
export const GATE_PRICE_EUR = 0.05;
