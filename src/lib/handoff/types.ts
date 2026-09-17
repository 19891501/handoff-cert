export type Verdict = "REPRENABLE" | "PARTIEL" | "CORROMPU";

export type FindingSeverity = "info" | "warning" | "error" | "critical";

export interface Finding {
  code: string;
  severity: FindingSeverity;
  message: string;
  path?: string;
}

export interface TaskSpec {
  objective: string;
  constraints: string[];
  critical: boolean;
}

export interface StateSpec {
  known: Record<string, unknown>;
  unknown: string[];
  version: string;
}

export interface WorkClaim {
  claim: string;
  evidence_refs: string[];
  critical: boolean;
}

export interface EvidenceItem {
  id: string;
  type: string;
  content: unknown;
  content_hash: string;
  timestamp: string;
  source: string;
  status: string;
}

export interface CanonicalHandoff {
  from: string;
  to: string;
  task: TaskSpec;
  state: StateSpec;
  work_done: WorkClaim[];
  work_remaining: string[];
  evidence: EvidenceItem[];
  uncertainties: string[];
}

export interface Presence {
  task: boolean;
  state: boolean;
  work_done: boolean;
  work_remaining: boolean;
  evidence: boolean;
  uncertainties: boolean;
}

export interface NormalizedHandoff {
  canonical: CanonicalHandoff;
  presence: Presence;
}

export interface Certificate {
  certificate_id: string;
  verdict: Verdict;
  confidence: number;
  missing: string[];
  conflicts: string[];
  warnings: string[];
  findings: Finding[];
  ruleset: string;
  ruleset_hash: string;
  input_hash: string;
  evidence_hashes: string[];
  issued_at: string;
  issuer: "handoff-cert";
  from: string;
  to: string;
}

export interface PublicCertificate {
  verdict: Verdict;
  confidence: number;
  missing: string[];
  conflicts: string[];
  warnings: string[];
  certificate_id: string;
  ruleset: string;
  input_hash: string;
  timestamp: string;
}

export interface VerifyResult {
  valid: boolean;
  input_match: boolean;
  verdict_match: boolean;
  ruleset_match: boolean;
  recomputed: Certificate;
}

export type CaseCategory = "positif" | "partiel" | "corrompu" | "adversarial";

export interface BenchCase {
  id: string;
  title: string;
  category: CaseCategory;
  framework: string;
  description: string;
  expected: Verdict;
  payload: unknown;
}

export const RULESET_VERSION = "1.0";
export const ISSUER = "handoff-cert" as const;

export const RULESET_DOC = [
  "HANDOFF CERT ruleset 1.0",
  "fail-closed",
  "CLAIM != EVIDENCE",
  "declared uncertainty is not corruption",
  "hidden certainty without evidence is PARTIEL",
  "claim vs evidence contradiction is CORROMPU",
  "missing required residual information is PARTIEL",
  "false REPRENABLE is the critical error",
].join("\n");
