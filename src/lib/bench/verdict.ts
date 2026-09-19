/** Verdict final — gelé comme le juge. Pas un slide. */
export const FINAL_VERDICT = {
  date: "2026-09-18",
  ruleset: "1.0",
  laboratoire: "tenu",
  claim_reprise_sure: "tue",
  produit_facture: "non",
  standard: "non",
  attaques: 9,
  faux_reprenable: 7,
  kills: 4,
  controles: "2/2",
  premier_contre_exemple: "KFP-001",
  source: "vscode#311420",
  phrase:
    "Notaire rejouable. Grille calquée sur un juge aveugle. B part à tort quand le monde est CORROMPU sans token FAIL. On ne retune pas V0.",
} as const;

export type FinalVerdict = typeof FINAL_VERDICT;

/**
 * Scoreboard 1.1 — autre notaire, à côté du gel 1.0.
 * Ne remplace pas kills:4 / faux_reprenable:7 / attaques:9 / KFP-001.
 * Mesuré par runAttack11() sur le même corpus.
 */
export const ATTACK_11_NOTE = {
  ruleset: "1.1",
  independent_of: "FINAL_VERDICT",
  measured_by: "runAttack11",
  attack11_n: 9,
  attack11_kills: 0,
  attack11_faux_reprenable: 3,
  attack11_controles: "2/2",
  attack11_killer: "",
  note: "Booléens polarisés (KFP-001, ATK-BOOL-STATUS, ATK-PASS-PREFIX). terminated≠termine. Gel 1.0 inchangé.",
} as const;

export type Attack11Note = typeof ATTACK_11_NOTE;

/**
 * Scoreboard 1.2 — troisième notaire, à côté du gel 1.0.
 * Ne remplace pas kills:4 / faux_reprenable:7 / attaques:9 / KFP-001.
 * Mesuré par runAttack12() sur le même corpus.
 */
export const ATTACK_12_NOTE = {
  ruleset: "1.2",
  independent_of: "FINAL_VERDICT",
  measured_by: "runAttack12",
  attack12_n: 9,
  attack12_kills: 0,
  attack12_faux_reprenable: 0,
  attack12_controles: "2/2",
  attack12_killer: "",
  note: "Hérite 1.1. Spec/chemin/chat (KFP-002, KFP-003, KFP-004). terminated≠termine. Gel 1.0 inchangé.",
} as const;

export type Attack12Note = typeof ATTACK_12_NOTE;
