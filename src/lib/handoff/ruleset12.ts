import { canonicalize, sha256Hex, shortHash } from "./hash";
import { normalize } from "./normalize";
import {
  confidenceOf,
  fold,
  impliesFailure,
  impliesSuccess,
  judge,
  OK_STATUS,
  stringValues,
} from "./engine";
import { analyze11 } from "./ruleset11";
import type {
  Certificate,
  EvidenceItem,
  Finding,
  NormalizedHandoff,
} from "./types";
import { ISSUER } from "./types";

export const RULESET_12 = "1.2";

export const RULESET_12_DOC = [
  "HANDOFF CERT ruleset 1.2",
  "inherits 1.1",
  "expected_output/spec in linked evidence is not execution proof",
  "file path without content hash/digest/sha is not a digest",
  "chat/ledger/message is not a tool_result",
  "code SPEC_NOT_EVIDENCE is critical → CORROMPU",
  "code PATH_NOT_DIGEST is critical → CORROMPU",
  "code CHAT_NOT_TOOL is critical → CORROMPU",
  "only when a success claim is linked to that evidence",
].join("\n");

const SPEC_KEYS = new Set([
  "expectedoutput",
  "expectedresult",
  "desiredoutput",
  "specification",
  "spec",
]);

const PATH_KEYS = new Set([
  "path",
  "filepath",
  "file",
  "filename",
  "outputfile",
  "outputpath",
]);

const DIGEST_KEYS = new Set([
  "hash",
  "digest",
  "sha",
  "sha256",
  "sha1",
  "contenthash",
  "checksum",
  "md5",
]);

const CHAT_KEYS = new Set([
  "ledger",
  "chat",
  "chathistory",
  "conversation",
  "transcript",
  "sharedchat",
]);

const CHAT_TYPE_OR_SOURCE = [
  "ledger",
  "chat",
  "magentic",
  "conversation",
  "transcript",
] as const;

function keyFold(key: string): string {
  return fold(key).replace(/[_-]/g, "");
}

function walkKeys(value: unknown, acc: { key: string; value: unknown }[] = []): {
  key: string;
  value: unknown;
}[] {
  if (Array.isArray(value)) {
    for (const item of value) walkKeys(item, acc);
    return acc;
  }
  if (value && typeof value === "object") {
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      acc.push({ key: k, value: v });
      walkKeys(v, acc);
    }
  }
  return acc;
}

/**
 * V0 SUCCESS_TOKENS miss French completions (produit, écrit, collectés).
 * 1.2 still uses impliesSuccess, and treats passé composé « a/ont été » as success.
 */
function isSuccessClaim(claim: string): boolean {
  if (!claim) return false;
  if (impliesFailure(claim)) return false;
  if (impliesSuccess(claim)) return true;
  const f = fold(claim);
  if (/\b(a|ont)\s+ete\b/.test(f)) return true;
  if (/\b(has|have)\s+been\b/.test(f)) return true;
  return false;
}

/** FAIL/OK status of an actual run — not a spec, path, or chat blob. */
function hasActualRunStatus(ev: EvidenceItem): boolean {
  const status = fold(ev.status);
  if (!status) return false;
  if (OK_STATUS.has(status)) return true;
  return impliesFailure(ev.status);
}

function hasDigest(ev: EvidenceItem): boolean {
  if (ev.content_hash.trim()) return true;
  for (const { key, value } of walkKeys(ev.content)) {
    const f = keyFold(key);
    const digestLike =
      DIGEST_KEYS.has(f) || f.endsWith("hash") || f.endsWith("digest") || f.includes("sha256");
    if (!digestLike) continue;
    if (typeof value === "string" && value.trim()) return true;
  }
  return false;
}

function looksLikePath(value: unknown): boolean {
  if (typeof value !== "string") return false;
  const v = value.trim();
  if (!v || /\s/.test(v)) return false;
  if (v.includes("/") || v.includes("\\")) return true;
  return /\.[\w]{1,8}$/.test(v);
}

function isSpecEvidence(ev: EvidenceItem): boolean {
  return walkKeys(ev.content).some(({ key }) => SPEC_KEYS.has(keyFold(key)));
}

function isPathEvidence(ev: EvidenceItem): boolean {
  return walkKeys(ev.content).some(
    ({ key, value }) => PATH_KEYS.has(keyFold(key)) && looksLikePath(value),
  );
}

function isChatImpersonation(ev: EvidenceItem): boolean {
  const type = fold(ev.type);
  const source = fold(ev.source);
  if (CHAT_TYPE_OR_SOURCE.some((t) => type === t || type.includes(t))) return true;
  if (CHAT_TYPE_OR_SOURCE.some((t) => source.includes(t))) return true;
  if (walkKeys(ev.content).some(({ key }) => CHAT_KEYS.has(keyFold(key)))) return true;
  const blob = fold(stringValues(ev.content).join(" "));
  return /\b(chat history|shared chat|task ledger)\b/.test(blob);
}

function evidenceQualityFindings(h: NormalizedHandoff): Finding[] {
  const findings: Finding[] = [];
  const byId = new Map(h.canonical.evidence.map((e) => [e.id, e]));

  for (const claim of h.canonical.work_done) {
    if (!claim.claim) continue;
    if (!isSuccessClaim(claim.claim)) continue;

    for (const ref of claim.evidence_refs) {
      const ev = byId.get(ref);
      if (!ev) continue;

      // Conservative: a real FAIL/OK run status is execution proof — do not fire.
      if (hasActualRunStatus(ev)) continue;

      if (isSpecEvidence(ev)) {
        findings.push({
          code: "SPEC_NOT_EVIDENCE",
          severity: "critical",
          message: `L'affirmation « ${claim.claim} » s'appuie sur une spécification (expected_output/spec) dans la preuve ${ev.id}, pas sur une exécution.`,
          path: `evidence.${ev.id}`,
        });
      }

      if (isPathEvidence(ev) && !hasDigest(ev)) {
        findings.push({
          code: "PATH_NOT_DIGEST",
          severity: "critical",
          message: `L'affirmation « ${claim.claim} » s'appuie sur un chemin de fichier sans empreinte (hash/digest/sha) dans la preuve ${ev.id}.`,
          path: `evidence.${ev.id}`,
        });
      }

      if (isChatImpersonation(ev)) {
        findings.push({
          code: "CHAT_NOT_TOOL",
          severity: "critical",
          message: `L'affirmation « ${claim.claim} » s'appuie sur un ledger/chat/message (preuve ${ev.id}), pas sur un tool_result.`,
          path: `evidence.${ev.id}`,
        });
      }
    }
  }

  return findings;
}

export function analyze12(h: NormalizedHandoff): Finding[] {
  return [...analyze11(h), ...evidenceQualityFindings(h)];
}

function unique(items: string[]): string[] {
  return [...new Set(items.filter(Boolean))];
}

export async function certify12(input: unknown): Promise<Certificate> {
  const normalized = normalize(input);
  const findings = analyze12(normalized);
  const verdict = judge(findings);
  const confidence = confidenceOf(findings);
  const inputHash = await sha256Hex(canonicalize(normalized.canonical));
  const rulesetHash = await sha256Hex(RULESET_12_DOC);

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
    ruleset: RULESET_12,
    ruleset_hash: `sha256:${rulesetHash}`,
    input_hash: `sha256:${inputHash}`,
    evidence_hashes: evidenceHashes,
    issued_at: new Date().toISOString(),
    issuer: ISSUER,
    from: normalized.canonical.from,
    to: normalized.canonical.to,
  };
}
