export { HandoffCert, createClient, certify, gateResume, catalogue, parseRuleset, resolveBaseUrl } from "./client.ts";
export { fromCertificate } from "./gate.ts";
export { HandoffCertError, PaymentRequiredError, UsageError } from "./errors.ts";
export { parseArgs, main, USAGE } from "./cli.ts";
export type { ParsedCli, CliIo } from "./cli.ts";
export type {
  RulesetId,
  Verdict,
  GateDecision,
  PublicCertificate,
  OfferBlock,
  PaymentBlock,
  CertifyResponse,
  GateResult,
  Catalogue,
  ClientOptions,
} from "./types.ts";
export {
  VERSION,
  DEFAULT_BASE_URL,
  CERTIFY_PATH,
  RECEIPT_SKU,
  GATE_SKU,
  RECEIPT_PRICE_EUR,
  GATE_PRICE_EUR,
} from "./types.ts";
