import { GATE_SKU, LICENCE, RECEIPT } from "./mission";

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

/** SKU actuellement servis par /api/v1/certify. La licence n'y est pas. */
export const OFFERS = [RECEIPT, GATE_SKU] as const;

/** Trois paliers publics. Source : mission.ts. Billing preview. */
export const TIERS = [RECEIPT, GATE_SKU, LICENCE] as const;

export type Offer = typeof OFFER;
export type Tier = (typeof TIERS)[number];

export type CheckoutPreview = {
  sku: string;
  billing: "preview";
  charged: false;
  success: false;
  transaction: "";
  reason: string;
};

export function formatTierPrice(tier: Tier): string {
  if ("period" in tier) {
    return `${tier.price_eur.toLocaleString("fr-FR")} € / ${tier.period}`;
  }
  if (tier.price_eur < 0.01) {
    return `${tier.price_eur.toLocaleString("fr-FR", {
      minimumFractionDigits: 3,
      maximumFractionDigits: 3,
    })} €`;
  }
  return `${tier.price_eur.toLocaleString("fr-FR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} €`;
}

/**
 * Checkout public. Jamais un succès. Jamais un hash.
 * Preview : rien n'est débité. Licence : pas encore encaissée.
 */
export function previewCheckout(sku: string): CheckoutPreview {
  const tier = TIERS.find((t) => t.sku === sku);
  if (!tier) {
    return {
      sku,
      billing: "preview",
      charged: false,
      success: false,
      transaction: "",
      reason: "sku inconnu — pas de paiement, pas de hash",
    };
  }
  if (!tier.sold) {
    return {
      sku: tier.sku,
      billing: "preview",
      charged: false,
      success: false,
      transaction: "",
      reason: "pas encore encaissé — licence d'émetteur, pas un checkout",
    };
  }
  return {
    sku: tier.sku,
    billing: "preview",
    charged: false,
    success: false,
    transaction: "",
    reason: "billing preview — rien n'est débité, pas de hash inventé",
  };
}
