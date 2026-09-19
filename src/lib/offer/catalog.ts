import { GATE_SKU, RECEIPT } from "./mission";

export const OFFER = {
  sku: RECEIPT.sku,
  name: "Certification de reprise",
  unit: "certificat",
  price_eur: RECEIPT.price_eur,
  currency: "EUR",
  billing: "preview",
  endpoint: "/api/v1/certify",
  ruleset: RECEIPT.ruleset,
  what: "Un verdict machine-readable sur un paquet de handoff. Pas le travail. Pas l'agent.",
  not: [
    "orchestration",
    "choix d'agent",
    "paiement d'équipe",
    "remplacement de workflow",
    "vendre V0 comme reprise sûre",
  ],
} as const;

export const OFFERS = [RECEIPT, GATE_SKU] as const;

export type Offer = typeof OFFER;
