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
