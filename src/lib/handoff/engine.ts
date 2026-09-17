import { canonicalize, sha256Hex, shortHash } from "./hash";
import { normalize } from "./normalize";
import type {
  CanonicalHandoff,
  Certificate,
  EvidenceItem,
  Finding,
  NormalizedHandoff,
  PublicCertificate,
  Verdict,
  VerifyResult,
} from "./types";
import { ISSUER, RULESET_DOC, RULESET_VERSION } from "./types";

export const FAIL_TOKENS = [
  "fail",
  "failed",
  "failure",
  "error",
  "cancelled",
  "canceled",
  "rejected",
  "denied",
  "invalid",
  "corrupt",
  "corrupted",
  "refused",
  "annule",
  "echoue",
  "echec",
  "rejete",
  "refuse",
  "faux",
  "invalide",
  "corrompu",
];

export const SUCCESS_TOKENS = [
  "done",
  "complete",
  "completed",
  "passed",
  "validated",
  "paid",
  "approved",
  "confirmed",
  "success",
  "successful",
  "finished",
  "pass",
  "termine",
  "effectue",
  "valide",
  "paye",
  "approuve",
  "confirme",
  "reussi",
];

export const OK_STATUS = new Set([
  "pass",
  "passed",
  "ok",
  "success",
  "successful",
  "completed",
  "complete",
  "approved",
  "valid",
  "true",
  "confirmed",
  "paid",
]);

const FAIL_STATUS = new Set(FAIL_TOKENS);

export function fold(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
}

export function hasToken(text: string, tokens: string[]): boolean {
  const f = fold(text);
  const words = f.split(/[^a-z0-9]+/).filter(Boolean);
  return tokens.some((token) => {
    const t = fold(token);
    return words.some((w) => w === t || (t.length >= 4 && w.startsWith(t)));
  });
}

export function impliesSuccess(text: string): boolean {
  return hasToken(text, SUCCESS_TOKENS);
}

export function impliesFailure(text: string): boolean {
  return hasToken(text, FAIL_TOKENS);
}

export function stringValues(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(stringValues);
  if (value && typeof value === "object") {
    return Object.values(value as Record<string, unknown>).flatMap(stringValues);
  }
  return [];
}

function evidenceText(ev: EvidenceItem): string {
  return [ev.status, ev.type, ev.source, ...stringValues(ev.content)]
    .filter(Boolean)
    .join(" ");
}

function isFailEvidence(ev: EvidenceItem): boolean {
  const status = fold(ev.status);
  if (status && FAIL_STATUS.has(status)) return true;
  if (status && OK_STATUS.has(status)) return false;
  return impliesFailure(evidenceText(ev));
}

function isOkEvidence(ev: EvidenceItem): boolean {
  const status = fold(ev.status);
  if (status && OK_STATUS.has(status)) return true;
  if (status && FAIL_STATUS.has(status)) return false;
  return impliesSuccess(evidenceText(ev));
}

function parseTime(value: string): number | null {
  if (!value) return null;
  const t = Date.parse(value);
  return Number.isFinite(t) ? t : null;
}

function checkTask(h: NormalizedHandoff, findings: Finding[]) {
  if (!h.canonical.task.objective) {
    findings.push({
      code: "TASK_MISSING",
      severity: "error",
      message: "L'objectif de la tâche est absent.",
      path: "task.objective",
    });
  }
}

function checkState(h: NormalizedHandoff, findings: Finding[]) {
  const { state } = h.canonical;
  const knownEmpty = Object.keys(state.known).length === 0;
  if (!h.presence.state && h.canonical.work_done.length > 0) {
    findings.push({
      code: "STATE_UNDECLARED",
      severity: "warning",
      message: "Aucun état n'est déclaré alors que du travail est revendiqué.",
      path: "state",
    });
  }
  if (h.presence.state && knownEmpty && state.unknown.length === 0 && !state.version) {
    findings.push({
      code: "STATE_EMPTY",
      severity: "warning",
      message: "L'état est présent mais ne contient ni faits connus ni inconnus.",
      path: "state",
    });
  }
}

function checkRemaining(h: NormalizedHandoff, findings: Finding[]) {
  if (!h.presence.work_remaining) {
    findings.push({
      code: "REMAINING_UNKNOWN",
      severity: "error",
      message: "Le travail restant n'est pas déclaré.",
      path: "work_remaining",
    });
  }
}

function checkUncertainties(h: NormalizedHandoff, findings: Finding[]) {
  for (const [i, u] of h.canonical.uncertainties.entries()) {
    findings.push({
      code: "UNCERTAINTY_DECLARED",
      severity: "info",
      message: `Incertitude déclarée : « ${u} ». Ce n'est pas une corruption.`,
      path: `uncertainties[${i}]`,
    });
  }
}

function checkClaimsAndEvidence(h: NormalizedHandoff, findings: Finding[]) {
  const byId = new Map(h.canonical.evidence.map((e) => [e.id, e]));
  const used = new Set<string>();
  const now = Date.now();

  for (const [i, claim] of h.canonical.work_done.entries()) {
    if (!claim.claim) {
      findings.push({
        code: "CLAIM_EMPTY",
        severity: "error",
        message: `Affirmation #${i + 1} vide.`,
        path: `work_done[${i}].claim`,
      });
      continue;
    }

    const linked: EvidenceItem[] = [];
    if (claim.evidence_refs.length === 0) {
      findings.push({
        code: "EVIDENCE_MISSING",
        severity: "error",
        message: `Aucune preuve pour l'affirmation « ${claim.claim} ».`,
        path: `work_done[${i}]`,
      });
    } else {
      for (const ref of claim.evidence_refs) {
        const ev = byId.get(ref);
        if (!ev) {
          findings.push({
            code: "EVIDENCE_DANGLING",
            severity: "error",
            message: `La référence de preuve « ${ref} » n'existe pas.`,
            path: `work_done[${i}].evidence_refs`,
          });
        } else {
          linked.push(ev);
          used.add(ev.id);
        }
      }
    }

    const successClaim = impliesSuccess(claim.claim);
    const failClaim = impliesFailure(claim.claim);
    let sawFail = false;
    let sawOk = false;

    for (const ev of linked) {
      const evFail = isFailEvidence(ev);
      const evOk = isOkEvidence(ev);
      if (evFail) sawFail = true;
      if (evOk) sawOk = true;
      if (successClaim && evFail) {
        findings.push({
          code: "CONTRADICTION_CLAIM_EVIDENCE",
          severity: "critical",
          message: `L'affirmation « ${claim.claim} » est contredite par la preuve ${ev.id}${ev.status ? ` (${ev.status})` : ""}.`,
          path: `evidence.${ev.id}`,
        });
      }
      if (failClaim && evOk) {
        findings.push({
          code: "CONTRADICTION_CLAIM_EVIDENCE",
          severity: "critical",
          message: `L'affirmation « ${claim.claim} » est contredite par la preuve ${ev.id}${ev.status ? ` (${ev.status})` : ""}.`,
          path: `evidence.${ev.id}`,
        });
      }
    }

    if (sawFail && sawOk) {
      findings.push({
        code: "CONTRADICTION_EVIDENCE_PAIR",
        severity: "critical",
        message: `Preuves contradictoires pour « ${claim.claim} ».`,
        path: `work_done[${i}]`,
      });
    }
  }

  for (const ev of h.canonical.evidence) {
    if (!used.has(ev.id) && h.canonical.work_done.length > 0) {
      findings.push({
        code: "UNUSED_EVIDENCE",
        severity: "info",
        message: `Preuve ${ev.id} non reliée à une affirmation.`,
        path: `evidence.${ev.id}`,
      });
    }
    if (!ev.source) {
      findings.push({
        code: "EVIDENCE_NO_SOURCE",
        severity: "warning",
        message: `La preuve ${ev.id} n'a pas de source.`,
        path: `evidence.${ev.id}.source`,
      });
    }
    if (!ev.timestamp) {
      findings.push({
        code: "EVIDENCE_NO_TIMESTAMP",
        severity: "warning",
        message: `La preuve ${ev.id} n'a pas d'horodatage.`,
        path: `evidence.${ev.id}.timestamp`,
      });
    } else {
      const t = parseTime(ev.timestamp);
      if (t != null) {
        if (t > now + 24 * 60 * 60 * 1000) {
          findings.push({
            code: "EVIDENCE_FUTURE",
            severity: "warning",
            message: `La preuve ${ev.id} porte un horodatage dans le futur.`,
            path: `evidence.${ev.id}.timestamp`,
          });
        } else if (now - t > 30 * 24 * 60 * 60 * 1000) {
          findings.push({
            code: "EVIDENCE_STALE",
            severity: "warning",
            message: `La preuve ${ev.id} a plus de 30 jours.`,
            path: `evidence.${ev.id}.timestamp`,
          });
        }
      }
    }
  }

  checkStateVsEvidence(h.canonical, findings);
}

function checkStateVsEvidence(canonical: CanonicalHandoff, findings: Finding[]) {
  const knownText = Object.values(canonical.state.known)
    .map((v) => (typeof v === "string" ? v : JSON.stringify(v)))
    .join(" ");
  if (!knownText) return;
  const stateSuccess = impliesSuccess(knownText);
  const stateFail = impliesFailure(knownText);
  for (const ev of canonical.evidence) {
    if (stateSuccess && isFailEvidence(ev)) {
      findings.push({
        code: "CONTRADICTION_STATE_EVIDENCE",
        severity: "critical",
        message: `L'état connu affirme un succès alors que la preuve ${ev.id} indique un échec.`,
        path: `state.known`,
      });
    }
    if (stateFail && isOkEvidence(ev)) {
      findings.push({
        code: "CONTRADICTION_STATE_EVIDENCE",
        severity: "critical",
        message: `L'état connu affirme un échec alors que la preuve ${ev.id} indique un succès.`,
        path: `state.known`,
      });
    }
  }
}

export function analyze(h: NormalizedHandoff): Finding[] {
  const findings: Finding[] = [];
  checkTask(h, findings);
  checkState(h, findings);
  checkClaimsAndEvidence(h, findings);
  checkRemaining(h, findings);
  checkUncertainties(h, findings);
  return findings;
}

export function judge(findings: Finding[]): Verdict {
  if (findings.some((f) => f.severity === "critical")) return "CORROMPU";
  if (findings.some((f) => f.severity === "error")) return "PARTIEL";
  return "REPRENABLE";
}

export function confidenceOf(findings: Finding[]): number {
  const critical = findings.filter((f) => f.severity === "critical").length;
  const errors = findings.filter((f) => f.severity === "error").length;
  const warnings = findings.filter((f) => f.severity === "warning").length;
  const raw = 1 - 0.18 * critical - 0.12 * errors - 0.04 * warnings;
  return Math.round(Math.min(0.99, Math.max(0.05, raw)) * 100) / 100;
}

export function toPublicCertificate(cert: Certificate): PublicCertificate {
  return {
    verdict: cert.verdict,
    confidence: cert.confidence,
    missing: cert.missing,
    conflicts: cert.conflicts,
    warnings: cert.warnings,
    certificate_id: cert.certificate_id,
    ruleset: cert.ruleset,
    input_hash: cert.input_hash,
    timestamp: cert.issued_at,
  };
}

export async function certify(input: unknown): Promise<Certificate> {
  const normalized = normalize(input);
  const findings = analyze(normalized);
  const verdict = judge(findings);
  const confidence = confidenceOf(findings);
  const inputHash = await sha256Hex(canonicalize(normalized.canonical));
  const rulesetHash = await sha256Hex(RULESET_DOC);

  const evidenceHashes: string[] = [];
  for (const ev of normalized.canonical.evidence) {
    if (ev.content_hash) {
      evidenceHashes.push(ev.content_hash.startsWith("sha256:") ? ev.content_hash : `sha256:${ev.content_hash}`);
      continue;
    }
    const hex = await sha256Hex(canonicalize({ id: ev.id, type: ev.type, content: ev.content, status: ev.status }));
    evidenceHashes.push(`sha256:${hex}`);
  }

  const missing = unique(
    findings
      .filter((f) => f.severity === "error")
      .map((f) => f.path ?? f.code),
  );
  const conflicts = unique(
    findings.filter((f) => f.severity === "critical").map((f) => f.message),
  );
  const warnings = unique(
    findings.filter((f) => f.severity === "warning").map((f) => f.message),
  );

  return {
    certificate_id: `hc_${shortHash(inputHash)}`,
    verdict,
    confidence,
    missing,
    conflicts,
    warnings,
    findings,
    ruleset: RULESET_VERSION,
    ruleset_hash: `sha256:${rulesetHash}`,
    input_hash: `sha256:${inputHash}`,
    evidence_hashes: evidenceHashes,
    issued_at: new Date().toISOString(),
    issuer: ISSUER,
    from: normalized.canonical.from,
    to: normalized.canonical.to,
  };
}

export async function verify(input: unknown, certificate: Certificate | PublicCertificate): Promise<VerifyResult> {
  const recomputed = await certify(input);
  const input_match = recomputed.input_hash === ("input_hash" in certificate ? certificate.input_hash : "");
  const verdict_match = recomputed.verdict === certificate.verdict;
  const ruleset_match =
    "ruleset" in certificate ? recomputed.ruleset === certificate.ruleset : true;
  return {
    valid: input_match && verdict_match && ruleset_match,
    input_match,
    verdict_match,
    ruleset_match,
    recomputed,
  };
}

function unique(items: string[]): string[] {
  return [...new Set(items.filter(Boolean))];
}
