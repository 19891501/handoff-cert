import { canonicalize, sha256Hex, shortHash } from "./hash";
import { normalize } from "./normalize";
import {
  analyze,
  confidenceOf,
  fold,
  impliesSuccess,
  judge,
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
].join("\n");

const OBSERVATIONAL = ["observ", "confirm", "rotat"] as const;

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
    if (!impliesSuccess(claim.claim)) continue;

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

export function analyze11(h: NormalizedHandoff): Finding[] {
  return [...analyze(h), ...booleanFindings(h)];
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
