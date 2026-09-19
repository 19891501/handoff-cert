import { GATE_SKU } from "./mission";
import { KNOWN_FALSE } from "../bench/falsify";
import { ATTACK_12_NOTE } from "../bench/verdict";
import { gateResume, type GateResult } from "../bench/gate";
import { CORPUS_CASES } from "../handoff/corpus";
import { canonicalize } from "../handoff/hash";
import { scanLeaks } from "../handoff/leaks";
import type { Verdict } from "../handoff/types";

/**
 * Bounty faux REPRENABLE.
 * On paie un nouveau KFP si la grille 1.2 PASSe encore.
 * Honnête : pas de cash tant que ce n'est pas réel.
 */
export const BOUNTY = {
  id: "handoff-bounty-kfp-12",
  name: "Bounty faux REPRENABLE",
  sku: GATE_SKU.sku,
  target: {
    ruleset: GATE_SKU.ruleset,
    gate: "PASS" as const,
    verdict: "REPRENABLE" as const,
    world_not: "REPRENABLE" as const,
    kind: "new_kfp" as const,
    excludes: ["KFP-001", "KFP-002", "KFP-003", "KFP-004"] as const,
  },
  payout_class_eur: 500,
  payout_instance_eur: 100,
  currency: "EUR",
  cash: false,
  until: "real" as const,
  billing: "preview" as const,
  paid_out_eur: 0,
  claims_paid: 0,
  paying_customers: 0,
  review: "humain" as const,
  why_no_cash:
    "Aucun client payant. Facturation preview. L'IOU n'est pas un virement.",
} as const;

export const BOUNTY_RULES = [
  "Nouveau paquet — pas un clone de KFP-001 à KFP-004.",
  "Le monde est CORROMPU ou PARTIEL. Revue humaine : la vérité n'est pas dans le paquet.",
  "Ruleset 1.2 dit REPRENABLE. GATE 1.2 PASSe. B partirait.",
  "Pas de leak (ground truth, expected verdict, « faux REPRENABLE » dans le texte).",
  "Reproductible : JSON + test que 1.2 PASSe encore. PR, pas un tweet.",
] as const;

export const BOUNTY_REFUSED = [
  "Retuner V0 ou dégeler FAIL_TOKENS",
  "Fermer KFP-001–004 sur 1.0 — le gel reste rouge",
  "Un faux REPRENABLE 1.0 que 1.2 STOP déjà",
  "Banc trophée, accuracy, « 24/24 »",
  "Inventer un virement, un USDC, un client payant",
] as const;

export const BOUNTY_SUBMIT = {
  via: "pull_request",
  repo: "19891501/handoff-cert",
  files: ["falsification/cases/KFP-00N.json", "test 1.2 PASS"],
  note: "Le dossier n'est pas un paiement. C'est un candidat.",
} as const;

export const STARTER_PACKET = {
  from: "a",
  to: "b",
  task: "…",
  state: { known: {}, version: "1" },
  work_done: [{ claim: "", evidence_refs: ["e1"] }],
  work_remaining: ["suite"],
  evidence: [
    {
      id: "e1",
      type: "tool_result",
      source: "probe",
      timestamp: "2026-09-19T00:00:00Z",
      status: "",
      content: {},
    },
  ],
} as const;

export interface BountyProbe {
  world: Verdict;
  locked: string | null;
  leaks: string[];
  v0: GateResult;
  v12: GateResult;
  qualifies: boolean;
  due_eur: number;
  cash: false;
  reason: string;
}

function unwrapPacket(raw: unknown): unknown {
  if (raw && typeof raw === "object" && "paquet" in raw) {
    return (raw as { paquet: unknown }).paquet;
  }
  return raw;
}

export function lockedTagOf(packet: unknown): string | null {
  const target = canonicalize(unwrapPacket(packet));
  for (const k of KNOWN_FALSE) {
    const caze = CORPUS_CASES.find((c) => c.id === k.id);
    if (!caze) continue;
    if (canonicalize(caze.payload) === target) return k.tag;
  }
  return null;
}

/** Cash is closed until a human flips BOUNTY.cash after real 1.2 revenue. */
export function bountyCashOpen(): boolean {
  const cash: boolean = BOUNTY.cash;
  if (BOUNTY.billing === "preview") return false;
  if (BOUNTY.paying_customers <= 0) return false;
  return cash;
}

export function bountyDueEur(qualifies: boolean): number {
  if (!qualifies) return 0;
  if (!bountyCashOpen()) return 0;
  return BOUNTY.payout_class_eur;
}

export function corpusFalse12(): number {
  return ATTACK_12_NOTE.attack12_faux_reprenable;
}

export async function probeBounty(
  packet: unknown,
  world: Verdict,
): Promise<BountyProbe> {
  const raw = unwrapPacket(packet);
  const locked = lockedTagOf(raw);
  const leaks = scanLeaks(raw);
  const v0 = await gateResume(raw, "1.0");
  const v12 = await gateResume(raw, "1.2");
  const parts: string[] = [];
  if (world === "REPRENABLE") {
    parts.push("monde REPRENABLE : pas un faux positif");
  }
  if (v12.decision !== "PASS" || v12.verdict !== "REPRENABLE") {
    parts.push(`1.2 ${v12.decision} (${v12.verdict})`);
  }
  if (locked) parts.push(`${locked} locké — 1.2 le tue déjà`);
  if (leaks.length) parts.push(`leak : ${leaks.join(", ")}`);
  const qualifies =
    world !== "REPRENABLE" &&
    v12.decision === "PASS" &&
    v12.verdict === "REPRENABLE" &&
    locked === null &&
    leaks.length === 0;
  if (qualifies) {
    parts.push(
      "Machine : candidat. Revue humaine pour le monde. Cash : 0 tant que ce n'est pas réel.",
    );
  }
  return {
    world,
    locked,
    leaks,
    v0,
    v12,
    qualifies,
    due_eur: bountyDueEur(qualifies),
    cash: false,
    reason: parts.join(" · ") || "pas de motif",
  };
}
