export const SCHEMA_ID = "cp.v1" as const;
export const CANON = "jcs-rfc8785" as const;

export type ContinuationStatus = "REPRENABLE" | "PARTIEL" | "CORROMPU" | "UNKNOWN";

export interface ContinuationProof {
  v: typeof SCHEMA_ID;
  id: string;
  trace: string;
  from: string;
  to: string;
  time: string;
  canon: typeof CANON;
  expected: {
    steps: string[];
    evidence: string[];
  };
  committed: {
    event_id: string;
    payload_hash: string;
  };
  received: {
    payload_hash: string;
  };
  evidence: Array<{
    id: string;
    type: string;
    hash: string;
    source: string;
    ts: string;
  }>;
  provenance: {
    prev: string | null;
    key_id: string;
  };
  state: {
    reconstructible: boolean;
    hash: string;
  };
  contradictions: string[];
  missing: string[];
  status: ContinuationStatus;
  next_evidence: string | null;
  stop: boolean;
  payload?: unknown;
}

export const WIRE_MAP: Array<{ concept: string; wire: string; sealed: boolean }> = [
  { concept: "EXPECTED", wire: "expected", sealed: true },
  { concept: "COMMITTED", wire: "committed.payload_hash", sealed: true },
  { concept: "RECEIVED", wire: "received.payload_hash", sealed: true },
  { concept: "EVIDENCE", wire: "evidence[].hash", sealed: true },
  { concept: "PROVENANCE", wire: "provenance", sealed: true },
  { concept: "STATE", wire: "state.hash", sealed: true },
  { concept: "CONTRADICTIONS", wire: "contradictions", sealed: true },
  { concept: "MISSING", wire: "missing", sealed: true },
  { concept: "PAYLOAD", wire: "payload", sealed: false },
];

export function seal(proof: ContinuationProof): ContinuationProof {
  const { payload: _drop, ...rest } = proof;
  void _drop;
  return rest;
}

export const SAMPLE_PAYLOAD = {
  order: "ord_9",
  amount: 100,
  note: "café",
};

export function samplePartiel(): ContinuationProof {
  return {
    v: SCHEMA_ID,
    id: "cp_01J8K3",
    trace: "tr_checkout",
    from: "agent_A",
    to: "agent_B",
    time: "2026-09-17T15:36:00.000Z",
    canon: CANON,
    expected: {
      steps: ["charge", "verify_payment", "write_ledger"],
      evidence: ["e_charge", "e_verify"],
    },
    committed: {
      event_id: "evt_A1",
      payload_hash: "sha256:9b74c9897bac770ffc029102a200c5de9b74c9897bac770ffc029102a200c5de",
    },
    received: {
      payload_hash: "sha256:9b74c9897bac770ffc029102a200c5de9b74c9897bac770ffc029102a200c5de",
    },
    evidence: [
      {
        id: "e_charge",
        type: "tool_result",
        hash: "sha256:aa11bb22cc33dd44ee55ff6677889900aa11bb22cc33dd44ee55ff6677889900",
        source: "stripe.charges.create",
        ts: "2026-09-17T15:35:40.000Z",
      },
    ],
    provenance: {
      prev: null,
      key_id: "k-agent-A",
    },
    state: {
      reconstructible: false,
      hash: "sha256:00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff",
    },
    contradictions: [],
    missing: ["e_verify"],
    status: "PARTIEL",
    next_evidence: "e_verify",
    stop: false,
    payload: SAMPLE_PAYLOAD,
  };
}

export function sampleReprenable(): ContinuationProof {
  const base = samplePartiel();
  return {
    ...base,
    id: "cp_01J8K4",
    evidence: [
      ...base.evidence,
      {
        id: "e_verify",
        type: "tool_result",
        hash: "sha256:ffeeddccbbaa99887766554433221100ffeeddccbbaa99887766554433221100",
        source: "stripe.charges.retrieve",
        ts: "2026-09-17T15:35:51.000Z",
      },
    ],
    missing: [],
    status: "REPRENABLE",
    next_evidence: null,
    stop: true,
    state: { reconstructible: true, hash: "sha256:feedfacefeedfacefeedfacefeedfacefeedfacefeedfacefeedfacefeedface" },
  };
}

export function sampleCorrompu(): ContinuationProof {
  const base = sampleReprenable();
  return {
    ...base,
    id: "cp_01J8K5",
    status: "CORROMPU",
    contradictions: ["claim:paiement_effectue ⊥ evidence:e_charge.status=FAIL"],
    state: { reconstructible: false, hash: base.state.hash },
    next_evidence: null,
    stop: true,
  };
}

export function mutateMissing(proof: ContinuationProof): ContinuationProof {
  return {
    ...proof,
    missing: [...proof.missing, "e_ledger"],
    status: proof.status === "REPRENABLE" ? "PARTIEL" : proof.status,
    next_evidence: "e_ledger",
    stop: false,
  };
}

export function mutateUnicodeNote(proof: ContinuationProof): ContinuationProof {
  const payload = proof.payload;
  if (!payload || typeof payload !== "object") return proof;
  const rec = { ...(payload as Record<string, unknown>) };
  if (typeof rec.note === "string") rec.note = rec.note.normalize("NFD");
  return { ...proof, payload: rec };
}

export const LOCALE_TRAP: Record<string, number> = { n: 1, o: 3, ñ: 2 };
