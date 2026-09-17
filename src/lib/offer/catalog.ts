export const OFFER = {
  sku: "handoff-cert-v1",
  name: "Certification de reprise",
  unit: "certificat",
  price_eur: 0.001,
  currency: "EUR",
  billing: "preview",
  endpoint: "/api/v1/certify",
  ruleset: "1.0",
  what: "Un verdict machine-readable sur un paquet de handoff. Pas le travail. Pas l'agent.",
  not: [
    "orchestration",
    "choix d'agent",
    "paiement d'équipe",
    "remplacement de workflow",
  ],
} as const;

export type Offer = typeof OFFER;
