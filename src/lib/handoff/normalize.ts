import type {
  CanonicalHandoff,
  EvidenceItem,
  NormalizedHandoff,
  Presence,
  WorkClaim,
} from "./types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function asString(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return "";
}

function asStringList(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(asString).filter(Boolean);
  if (typeof value === "string" && value.trim()) return [value.trim()];
  return [];
}

function looksLikeHandoff(raw: Record<string, unknown>): boolean {
  return (
    "task" in raw ||
    "work_done" in raw ||
    "evidence" in raw ||
    "work_remaining" in raw ||
    "from" in raw ||
    "to" in raw ||
    "state" in raw
  );
}

function unwrap(raw: Record<string, unknown>): Record<string, unknown> {
  for (const key of ["handoff", "params", "output", "canonical", "data", "payload"]) {
    const inner = raw[key];
    if (isRecord(inner) && looksLikeHandoff(inner)) {
      return { ...raw, ...inner };
    }
  }
  return raw;
}

function pickStatus(record: Record<string, unknown>): string {
  for (const key of ["status", "result", "validation_result", "outcome"]) {
    if (typeof record[key] === "string") return asString(record[key]);
  }
  if (isRecord(record.content)) {
    for (const key of ["status", "result", "validation_result", "outcome"]) {
      if (typeof record.content[key] === "string") return asString(record.content[key]);
    }
  }
  return "";
}

function normalizeClaim(item: unknown, index: number): WorkClaim {
  if (typeof item === "string") {
    return { claim: item.trim(), evidence_refs: [], critical: false };
  }
  if (!isRecord(item)) {
    return { claim: "", evidence_refs: [], critical: false };
  }
  const refs = asStringList(item.evidence_refs ?? item.evidence ?? item.refs);
  return {
    claim: asString(item.claim ?? item.description ?? item.step ?? `claim_${index + 1}`),
    evidence_refs: refs,
    critical: Boolean(item.critical),
  };
}

function normalizeEvidence(item: unknown, index: number): EvidenceItem {
  if (typeof item === "string") {
    return {
      id: `e${index + 1}`,
      type: "note",
      content: item,
      content_hash: "",
      timestamp: "",
      source: "",
      status: "",
    };
  }
  if (!isRecord(item)) {
    return {
      id: `e${index + 1}`,
      type: "unknown",
      content: item,
      content_hash: "",
      timestamp: "",
      source: "",
      status: "",
    };
  }
  return {
    id: asString(item.id) || `e${index + 1}`,
    type: asString(item.type) || "tool_result",
    content: item.content ?? item.value ?? item.body ?? null,
    content_hash: asString(item.content_hash ?? item.hash),
    timestamp: asString(item.timestamp ?? item.ts ?? item.time),
    source: asString(item.source ?? item.issuer ?? item.agent),
    status: pickStatus(item),
  };
}

function normalizeTask(value: unknown): CanonicalHandoff["task"] {
  if (typeof value === "string") {
    return { objective: value.trim(), constraints: [], critical: false };
  }
  if (!isRecord(value)) {
    return { objective: "", constraints: [], critical: false };
  }
  return {
    objective: asString(value.objective ?? value.goal ?? value.description ?? value.name),
    constraints: asStringList(value.constraints),
    critical: Boolean(value.critical),
  };
}

function normalizeState(value: unknown): CanonicalHandoff["state"] {
  if (!isRecord(value)) {
    return { known: {}, unknown: [], version: "" };
  }
  const known = isRecord(value.known)
    ? value.known
    : Object.fromEntries(
        Object.entries(value).filter(
          ([k]) => !["known", "unknown", "version"].includes(k),
        ),
      );
  return {
    known,
    unknown: asStringList(value.unknown),
    version: asString(value.version),
  };
}

const emptyPresence = (): Presence => ({
  task: false,
  state: false,
  work_done: false,
  work_remaining: false,
  evidence: false,
  uncertainties: false,
});

export function emptyHandoff(): NormalizedHandoff {
  return {
    canonical: {
      from: "",
      to: "",
      task: { objective: "", constraints: [], critical: false },
      state: { known: {}, unknown: [], version: "" },
      work_done: [],
      work_remaining: [],
      evidence: [],
      uncertainties: [],
    },
    presence: emptyPresence(),
  };
}

export function normalize(input: unknown): NormalizedHandoff {
  if (!isRecord(input)) return emptyHandoff();
  const src = unwrap(input);
  const task = normalizeTask(src.task);
  const workDoneRaw = src.work_done ?? src.workDone ?? src.completed;
  const remainingRaw = src.work_remaining ?? src.workRemaining ?? src.remaining;
  const evidenceRaw = src.evidence ?? src.proofs;
  const uncertaintiesRaw = src.uncertainties ?? src.unknowns;

  const presence: Presence = {
    task: src.task !== undefined && task.objective.length > 0,
    state: src.state !== undefined,
    work_done: workDoneRaw !== undefined,
    work_remaining: remainingRaw !== undefined,
    evidence: evidenceRaw !== undefined,
    uncertainties: uncertaintiesRaw !== undefined,
  };

  return {
    canonical: {
      from: asString(src.from ?? src.source ?? src.agent),
      to: asString(src.to ?? src.target ?? src.next),
      task,
      state: normalizeState(src.state),
      work_done: Array.isArray(workDoneRaw)
        ? workDoneRaw.map(normalizeClaim)
        : typeof workDoneRaw === "string" && workDoneRaw.trim()
          ? [normalizeClaim(workDoneRaw, 0)]
          : [],
      work_remaining: asStringList(remainingRaw),
      evidence: Array.isArray(evidenceRaw)
        ? evidenceRaw.map(normalizeEvidence)
        : evidenceRaw
          ? [normalizeEvidence(evidenceRaw, 0)]
          : [],
      uncertainties: asStringList(uncertaintiesRaw),
    },
    presence,
  };
}
