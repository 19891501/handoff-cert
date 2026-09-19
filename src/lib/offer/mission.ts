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

/**
 * Compteurs live. Preview : zéros honnêtes.
 * Jamais un CA, un graphe ou un certificat inventé.
 */
export const LIVE = {
  certs: 0,
  graphs: 0,
  arr_eur: 0,
  billing: "preview" as const,
  paying_customers: 0,
} as const;

export const KPI = [
  {
    id: "certs" as const,
    label: "Certificats",
    unit: "émis",
    vs: "1 milliard / an",
    note: "Aucun certificat payé.",
  },
  {
    id: "graphs" as const,
    label: "Graphes",
    unit: "en production",
    vs: "10 000 graphes",
    note: "gateNode n'encaisse nulle part.",
  },
  {
    id: "arr" as const,
    label: "ARR",
    unit: "preview",
    vs: "50 M€ / an",
    note: "Pas de clients payants.",
  },
] as const;

export type LiveKpis = {
  certs: number;
  graphs: number;
  arr_eur: number;
  billing: typeof LIVE.billing;
  paying_customers: number;
  horizon: typeof MISSION.horizon;
};

export function liveSnapshot(): LiveKpis {
  return {
    certs: LIVE.certs,
    graphs: LIVE.graphs,
    arr_eur: LIVE.arr_eur,
    billing: LIVE.billing,
    paying_customers: LIVE.paying_customers,
    horizon: MISSION.horizon,
  };
}

export function liveIsHonestPreview(s: LiveKpis): boolean {
  return (
    s.billing === "preview" &&
    s.certs === 0 &&
    s.graphs === 0 &&
    s.arr_eur === 0 &&
    s.paying_customers === 0
  );
}

function nonNegInt(n: unknown): number | null {
  if (typeof n !== "number" || !Number.isFinite(n) || n < 0) return null;
  return n;
}

/** Lecture d'un payload /api/v1/cap. Preview n'accepte pas d'ARR inventé. */
export function readLivePayload(json: unknown): LiveKpis | null {
  if (!json || typeof json !== "object") return null;
  const root = json as Record<string, unknown>;
  const src =
    root.live && typeof root.live === "object"
      ? (root.live as Record<string, unknown>)
      : root;
  const certs = nonNegInt(src.certs);
  const graphs = nonNegInt(src.graphs);
  const arr = nonNegInt(src.arr_eur);
  const paying = src.paying_customers === undefined ? 0 : nonNegInt(src.paying_customers);
  if (certs === null || graphs === null || arr === null || paying === null) return null;
  if (src.billing !== "preview") return null;
  if (arr !== 0 || paying !== 0) return null;
  return {
    certs,
    graphs,
    arr_eur: arr,
    billing: "preview",
    paying_customers: paying,
    horizon: MISSION.horizon,
  };
}

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
