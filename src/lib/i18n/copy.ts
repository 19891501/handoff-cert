import type { Locale } from "./locale";

const CAP = {
  fr: {
    kicker: "Cap · 2030 · liberté totale",
    name: "Le TLS des reprises d'agents",
    sentence:
      "Chaque goto A→B exige un certificat payé. V0 est le reçu. 1.2 est la grille. On ne vend pas la sécurité de 1.0.",
    whyMoney:
      "Un handoff d'agent sans sceau est un HTTP sans TLS. Le volume n'est pas des sièges : c'est chaque reprise.",
    collect: "Encaisser",
    freezeRed: "Le gel reste rouge",
    targetsKicker: "Très grands objectifs",
    targetsTitle: "On vise la rente, pas un laboratoire.",
    neverKicker: "Rien négliger",
    neverTitle: "Ce qu'on ne fera jamais",
    licencePeriod: "an",
    receiptName: "Reçu de reprise",
    receiptRole: "notaire gelé — rejouable, pas une grille",
    gateName: "Grille de reprise",
    gateRole: "B ne part que si 1.2 dit REPRENABLE",
    licenceName: "Licence d'émetteur",
    licenceRole: "clé d'émetteur, SLA, ruleset piné — pas encore encaissé",
    targets: [
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
    ],
    never: [
      "Vendre V0 comme une reprise sûre",
      "Dégeler FAIL_TOKENS pour un slide",
      "Inventer des clients payants",
      "Confondre intégrité, vérité et paiement",
    ],
  },
  en: {
    kicker: "Cap · 2030 · total freedom",
    name: "The TLS of agent handoffs",
    sentence:
      "Every A→B goto requires a paid certificate. V0 is the receipt. 1.2 is the grille. We do not sell 1.0 as safety.",
    whyMoney:
      "An agent handoff without a seal is HTTP without TLS. Volume is not seats: it is every resume.",
    collect: "Collect",
    freezeRed: "The freeze stays red",
    targetsKicker: "Very large targets",
    targetsTitle: "We aim for rent, not a lab.",
    neverKicker: "Overlook nothing",
    neverTitle: "What we will never do",
    licencePeriod: "year",
    receiptName: "Resume receipt",
    receiptRole: "frozen notary — replayable, not a grille",
    gateName: "Resume grille",
    gateRole: "B leaves only if 1.2 says REPRENABLE",
    licenceName: "Issuer licence",
    licenceRole: "issuer key, SLA, pinned ruleset — not yet collected",
    targets: [
      {
        id: "certs",
        label: "1 billion certificates / year",
        money: "volume",
        why: "Every graph, every relay, every A→B reset.",
      },
      {
        id: "graphs",
        label: "gateNode in 10,000 production graphs",
        money: "distribution",
        why: "wrapNode observes. gateNode collects.",
      },
      {
        id: "arr",
        label: "€50M / year",
        money: "till",
        why: "1.2 micropayment + signed-issuer licences. Not a seat SaaS.",
      },
      {
        id: "standard",
        label: "Default seal of handoffs",
        money: "rent",
        why: "Like TLS: you stop thinking about it. You pay so B can leave.",
      },
    ],
    never: [
      "Sell V0 as a safe resume",
      "Unfreeze FAIL_TOKENS for a slide",
      "Invent paying customers",
      "Confuse integrity, truth and payment",
    ],
  },
} as const;

const OFFRE = {
  fr: {
    twoSkus:
      "Deux SKU. Le reçu 1.0 est gelé et honnête : pas une grille. La grille 1.2 est le produit qui encaisse. Licence d'émetteur : objectif, pas encore encaissée. Preview : on n'invente pas de chiffre d'affaires.",
    price: "Prix",
    per: "par",
    unit: "certificat",
    contract: "Contrat",
    contractBody: "POST JSON → certificat. Intégrité et verdict restent séparés.",
    billing: "Facturation",
    billingBody:
      "Prix public. Facilitateur x402 : /api/x402 (Base Sepolia). POST sans X-PAYMENT → 402 seulement si X402_PAY_TO est configuré. Pas de hash inventé.",
    ledgerKicker: "Ledger de nonce",
    ledgerTitle: "Un paiement ne se dépense qu'une fois",
    ledgerBody:
      "Clé (network, payer, nonce). Verify ne consomme pas. Un settle rejoué renvoie la même transaction — pas un nouveau hash, pas un second débit.",
    table: "Table",
    backend: "Backend",
    backendSql: "sql — persistant",
    backendMemory: "mémoire — preview",
    settleReplay: "Settle rejoué",
    settleReplayValue: "même tx",
    verifyConsumed: "Verify consommé",
    verifyConsumes: "Verify consomme",
    no: "non",
    callApi: "Appeler l'API",
    calling: "Appel…",
    wireWrap: "Brancher wrapNode",
    readKfp: "Lire les 4 KFP",
    callFailed: "appel impossible",
    notBuying: "Ce que vous n'achetez pas",
    frozenNote:
      "V0 est gelé. Quatre faux REPRENABLE sont publics. Les vendre comme un juge infaillible serait un autre produit — faux.",
    offerName: "Certification de reprise",
    offerWhat:
      "Un verdict machine-readable sur un paquet de handoff. Pas le travail. Pas l'agent.",
    not: [
      "orchestration",
      "choix d'agent",
      "paiement d'équipe",
      "remplacement de workflow",
      "vendre V0 comme reprise sûre",
    ],
    receiptName: "Reçu de reprise",
    receiptRole: "notaire gelé — rejouable, pas une grille",
    gateName: "Grille de reprise",
    gateRole: "B ne part que si 1.2 dit REPRENABLE",
  },
  en: {
    twoSkus:
      "Two SKUs. The 1.0 receipt is frozen and honest: not a grille. The 1.2 grille is the product that collects. Issuer licence: a target, not yet collected. Preview: we do not invent revenue.",
    price: "Price",
    per: "per",
    unit: "certificate",
    contract: "Contract",
    contractBody: "POST JSON → certificate. Integrity and verdict stay separate.",
    billing: "Billing",
    billingBody:
      "Public price. x402 facilitator: /api/x402 (Base Sepolia). POST without X-PAYMENT → 402 only if X402_PAY_TO is set. No invented hash.",
    ledgerKicker: "Nonce ledger",
    ledgerTitle: "A payment is spent only once",
    ledgerBody:
      "Key (network, payer, nonce). Verify does not consume. A replayed settle returns the same transaction — not a new hash, not a second debit.",
    table: "Table",
    backend: "Backend",
    backendSql: "sql — persistent",
    backendMemory: "memory — preview",
    settleReplay: "Replayed settle",
    settleReplayValue: "same tx",
    verifyConsumed: "Verify consumed",
    verifyConsumes: "Verify consumes",
    no: "no",
    callApi: "Call the API",
    calling: "Calling…",
    wireWrap: "Wire wrapNode",
    readKfp: "Read the 4 KFPs",
    callFailed: "call failed",
    notBuying: "What you are not buying",
    frozenNote:
      "V0 is frozen. Four false REPRENABLE cases are public. Selling them as an infallible judge would be another product — a false one.",
    offerName: "Resume certification",
    offerWhat: "A machine-readable verdict on a handoff packet. Not the work. Not the agent.",
    not: [
      "orchestration",
      "agent choice",
      "team payment",
      "workflow replacement",
      "selling V0 as a safe resume",
    ],
    receiptName: "Resume receipt",
    receiptRole: "frozen notary — replayable, not a grille",
    gateName: "Resume grille",
    gateRole: "B leaves only if 1.2 says REPRENABLE",
  },
} as const;

export function capCopy(locale: Locale) {
  return CAP[locale];
}

export function offreCopy(locale: Locale) {
  return OFFRE[locale];
}
