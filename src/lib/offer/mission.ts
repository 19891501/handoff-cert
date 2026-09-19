/** Cap commercial — liberté totale, sans mentir sur V0. */
export const MISSION = {
  name: "Le TLS des reprises d'agents",
  horizon: "2030",
  sentence:
    "Chaque goto A→B exige un certificat payé. V0 est le reçu. 1.2 est la grille. On ne vend pas la sécurité de 1.0.",
  why_money:
    "Un handoff d'agent sans sceau est un HTTP sans TLS. Le volume n'est pas des sièges : c'est chaque reprise.",
} as const;

export const TARGETS = [
  {
    id: "certs",
    label: "1 milliard de certificats / an",
    money: "volume",
    why: "Chaque graphe, chaque relais, chaque reset A→B.",
  },
  {
    id: "graphs",
    label: "gateNode dans 10 000 graphes en production",
    money: "distribution",
    why: "wrapNode observe. gateNode encaisse.",
  },
  {
    id: "arr",
    label: "50 M€ / an",
    money: "caisse",
    why: "Micro-paiement 1.2 + licences d'émetteur signé. Pas un SaaS de sièges.",
  },
  {
    id: "standard",
    label: "Sceau par défaut des handoffs",
    money: "rente",
    why: "Comme TLS : on n'y pense plus. On paie pour que B parte.",
  },
] as const;

export const NEVER = [
  "Vendre V0 comme une reprise sûre",
  "Dégeler FAIL_TOKENS pour un slide",
  "Inventer des clients payants",
  "Confondre intégrité, vérité et paiement",
] as const;

export const RECEIPT = {
  sku: "handoff-cert-v1",
  name: "Reçu de reprise",
  ruleset: "1.0" as const,
  price_eur: 0.001,
  role: "notaire gelé — rejouable, pas une grille",
  sold: true,
};

export const GATE_SKU = {
  sku: "handoff-gate-v12",
  name: "Grille de reprise",
  ruleset: "1.2" as const,
  price_eur: 0.05,
  role: "B ne part que si 1.2 dit REPRENABLE",
  sold: true,
};

export const LICENCE = {
  sku: "handoff-issuer-licence",
  name: "Licence d'émetteur",
  price_eur: 48_000,
  period: "an",
  role: "clé d'émetteur, SLA, ruleset piné — pas encore encaissé",
  sold: false,
};
