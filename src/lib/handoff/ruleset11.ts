import { canonicalize, sha256Hex, shortHash } from "./hash";
import { normalize } from "./normalize";
import {
  analyze,
  confidenceOf,
  fold,
  judge,
  SUCCESS_TOKENS,
} from "./engine";
import type {
  Certificate,
  EvidenceItem,
  Finding,
  NormalizedHandoff,
} from "./types";
import { ISSUER } from "./types";

export const RULESET_11 = "1.1";

export const RULESET_11_DOC = [
  "HANDOFF CERT ruleset 1.1",
  "inherits 1.0",
  "JSON boolean false in linked evidence.content contradicts a success claim",
  "boolean false evidence.status contradicts a success claim",
  "observed/confirmed/rotated all-false contradicts a success claim",
  "code CONTRADICTION_BOOLEAN is critical → CORROMPU",
  "EN failure form (terminated, killed, crashed, aborted) is not success even if a FR prefix matches",
  "token termine is FR success ; process terminated is EN failure",
  "code CONTRADICTION_BILINGUAL is critical → CORROMPU",
].join("\n");

const OBSERVATIONAL = ["observ", "confirm", "rotat"] as const;

/** Known EN failure words. Never count as success, even if a FR prefix would match. */
export const EN_FAILURE_FORMS = [
  "terminated",
  "killed",
  "crashed",
  "aborted",
] as const;

interface BoolLeaf {
  key: string;
  path: string;
  value: boolean;
}

function collectBooleans(value: unknown, path = ""): BoolLeaf[] {
  if (typeof value === "boolean") {
    const key = path.split(".").pop()?.replace(/\[\d+\]$/g, "") || path;
    return [{ key, path, value }];
  }
  if (Array.isArray(value)) {
    return value.flatMap((item, i) =>
      collectBooleans(item, path ? `${path}[${i}]` : `[${i}]`),
    );
  }
  if (value && typeof value === "object") {
    return Object.entries(value as Record<string, unknown>).flatMap(([k, v]) =>
      collectBooleans(v, path ? `${path}.${k}` : k),
    );
  }
  return [];
}

function looksObservational(key: string): boolean {
  const f = fold(key);
  return OBSERVATIONAL.some((token) => f.includes(token));
}

function statusAsBoolean(status: unknown): boolean | undefined {
  return typeof status === "boolean" ? status : undefined;
}

function foldedWords(text: string): string[] {
  return fold(text).split(/[^a-z0-9]+/).filter(Boolean);
}

function isEnFailureForm(word: string): boolean {
  return (EN_FAILURE_FORMS as readonly string[]).includes(word);
}

/**
 * V0 success scanner, minus known EN failure forms.
 * « terminated » must not count as « termine », even if a FR prefix matches.
 */
export function impliesSuccess11(text: string): boolean {
  const words = foldedWords(text).filter((w) => !isEnFailureForm(w));
  return SUCCESS_TOKENS.some((token) => {
    const t = fold(token);
    return words.some((w) => w === t || (t.length >= 4 && w.startsWith(t)));
  });
}

/**
 * Polarize JSON booleans in evidence.content (and evidence.status if boolean).
 * Any false boolean in linked evidence is enough when the claim implies success.
 * All observational (observed/confirmed/rotated) booleans false is also enough.
 */
function contradictedByBoolean(ev: EvidenceItem): boolean {
  const flags = collectBooleans(ev.content);
  const statusBool = statusAsBoolean(ev.status);
  if (statusBool === false) return true;
  if (flags.some((b) => b.value === false)) return true;
  const observational = flags.filter((b) => looksObservational(b.key));
  return observational.length > 0 && observational.every((b) => b.value === false);
}

function booleanFindings(h: NormalizedHandoff): Finding[] {
  const findings: Finding[] = [];
  const byId = new Map(h.canonical.evidence.map((e) => [e.id, e]));

  for (const claim of h.canonical.work_done) {
    if (!claim.claim) continue;
    if (!impliesSuccess11(claim.claim)) continue;

    for (const ref of claim.evidence_refs) {
      const ev = byId.get(ref);
      if (!ev) continue;
      if (!contradictedByBoolean(ev)) continue;
      findings.push({
        code: "CONTRADICTION_BOOLEAN",
        severity: "critical",
        message: `L'affirmation « ${claim.claim} » est contredite par un booléen false dans la preuve ${ev.id}.`,
        path: `evidence.${ev.id}`,
      });
    }
  }

  return findings;
}

/**
 * A work_done claim that uses a known EN failure form (terminated, killed,
 * crashed, aborted) is an EN failure, not FR success. V0's prefix scanner
 * does not treat « terminated » as « termine » (a≠e) and misses the fail
 * polarity; 1.1 must not count that word as success, and must CORROMPU.
 */
function bilingualFindings(h: NormalizedHandoff): Finding[] {
  const findings: Finding[] = [];

  for (const [i, claim] of h.canonical.work_done.entries()) {
    if (!claim.claim) continue;
    const hits = foldedWords(claim.claim).filter(isEnFailureForm);
    if (hits.length === 0) continue;
    findings.push({
      code: "CONTRADICTION_BILINGUAL",
      severity: "critical",
      message: `L'affirmation « ${claim.claim} » décrit un échec EN (« ${hits[0]} »), pas un succès FR (token « termine »).`,
      path: `work_done[${i}].claim`,
    });
  }

  return findings;
}

export function analyze11(h: NormalizedHandoff): Finding[] {
  return [...analyze(h), ...booleanFindings(h), ...bilingualFindings(h)];
}

function unique(items: string[]): string[] {
  return [...new Set(items.filter(Boolean))];
}

export async function certify11(input: unknown): Promise<Certificate> {
  const normalized = normalize(input);
  const findings = analyze11(normalized);
  const verdict = judge(findings);
  const confidence = confidenceOf(findings);
  const inputHash = await sha256Hex(canonicalize(normalized.canonical));
  const rulesetHash = await sha256Hex(RULESET_11_DOC);

  const evidenceHashes: string[] = [];
  for (const ev of normalized.canonical.evidence) {
    if (ev.content_hash) {
      evidenceHashes.push(
        ev.content_hash.startsWith("sha256:") ? ev.content_hash : `sha256:${ev.content_hash}`,
      );
      continue;
    }
    const hex = await sha256Hex(
      canonicalize({ id: ev.id, type: ev.type, content: ev.content, status: ev.status }),
    );
    evidenceHashes.push(`sha256:${hex}`);
  }

  const missing = unique(
    findings.filter((f) => f.severity === "error").map((f) => f.path ?? f.code),
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
    ruleset: RULESET_11,
    ruleset_hash: `sha256:${rulesetHash}`,
    input_hash: `sha256:${inputHash}`,
    evidence_hashes: evidenceHashes,
    issued_at: new Date().toISOString(),
    issuer: ISSUER,
    from: normalized.canonical.from,
    to: normalized.canonical.to,
  };
}
