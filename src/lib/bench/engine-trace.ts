import { analyze, confidenceOf, judge } from "@/lib/handoff/engine";
import { normalize } from "@/lib/handoff/normalize";
import { getCase } from "@/lib/handoff/cases";
import { CORPUS_CASES } from "@/lib/handoff/corpus";
import type { Finding, Verdict } from "@/lib/handoff/types";

export const PIPELINE = [
  { id: "normalize", title: "Normaliser", body: "Objet canonique. Pas de jugement." },
  { id: "analyze", title: "Analyser", body: "Findings : critical / error / warning / info." },
  { id: "judge", title: "Juger", body: "critical → CORROMPU. error → PARTIEL. sinon REPRENABLE." },
] as const;

export const ENGINE_FIXTURES: Array<{ id: string; title: string; payload: unknown; expected: Verdict }> = [
  {
    id: "clean_validation",
    title: "Trophée · validation",
    payload: getCase("clean_validation")!.payload,
    expected: "REPRENABLE",
  },
  {
    id: "payment_cancelled",
    title: "Contradiction · CANCELLED",
    payload: getCase("payment_cancelled")!.payload,
    expected: "CORROMPU",
  },
  {
    id: "claim_no_evidence",
    title: "Sans preuve",
    payload: getCase("claim_no_evidence")!.payload,
    expected: "PARTIEL",
  },
  {
    id: "X07",
    title: "KFP-001 · booléens",
    payload: CORPUS_CASES.find((c) => c.id === "X07")!.payload,
    expected: "CORROMPU",
  },
];

export interface EngineTrace {
  verdict: Verdict;
  expected: Verdict;
  confidence: number;
  findings: Finding[];
  falseSafe: boolean;
}

export function traceEngine(payload: unknown, expected: Verdict): EngineTrace {
  const findings = analyze(normalize(payload));
  const verdict = judge(findings);
  return {
    verdict,
    expected,
    confidence: confidenceOf(findings),
    findings,
    falseSafe: verdict === "REPRENABLE" && expected !== "REPRENABLE",
  };
}

export function reductionOf(findings: Finding[]): string {
  if (findings.some((f) => f.severity === "critical")) return "critical → CORROMPU";
  if (findings.some((f) => f.severity === "error")) return "error → PARTIEL";
  return "aucun critical/error → REPRENABLE";
}
