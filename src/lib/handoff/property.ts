import type { Verdict } from "./types";

const TS = "2026-09-15T14:22:08Z";

export interface PropertyStep {
  id: string;
  title: string;
  note: string;
  expected: Verdict;
  payload: unknown;
}

export const PROPERTY_STEPS: PropertyStep[] = [
  {
    id: "A",
    title: "Faits, sans preuve",
    note: "Le paquet dit ce qui a été fait. Il ne contient rien qui le montre.",
    expected: "PARTIEL",
    payload: {
      from: "implementer",
      to: "deployer",
      task: "Préparer le déploiement",
      work_done: ["tests exécutés"],
      evidence: [],
      work_remaining: ["déployer"],
    },
  },
  {
    id: "B",
    title: "Preuve reliée",
    note: "Même travail, avec une preuve PASS sourcée, horodatée, référencée. Le fragment du mémo sans liaison resterait PARTIEL.",
    expected: "REPRENABLE",
    payload: {
      from: "implementer",
      to: "deployer",
      task: "Préparer le déploiement",
      state: { known: { sha: "c0ffee" }, version: "2" },
      work_done: [{ claim: "Les tests ont été exécutés.", evidence_refs: ["t1"] }],
      work_remaining: ["déployer"],
      evidence: [
        {
          id: "t1",
          type: "test_report",
          source: "github-actions",
          timestamp: TS,
          status: "PASS",
          content: { suite: "unit", passed: 41, failed: 0 },
        },
      ],
      uncertainties: [],
    },
  },
  {
    id: "C",
    title: "Preuve contradictoire",
    note: "L'affirmation et la preuve ne racontent pas la même chose. Continuer propagerait l'erreur.",
    expected: "CORROMPU",
    payload: {
      from: "billing",
      to: "fulfillment",
      task: "Encaisser la commande 8821",
      state: { known: { order_id: "8821" }, version: "1" },
      work_done: [{ claim: "Paiement effectué.", evidence_refs: ["tx1"] }],
      work_remaining: ["Expédier"],
      evidence: [
        {
          id: "tx1",
          type: "transaction",
          source: "psp",
          timestamp: TS,
          status: "CANCELLED",
          content: { transaction_id: "ch_9f2a" },
        },
      ],
      uncertainties: [],
    },
  },
];
