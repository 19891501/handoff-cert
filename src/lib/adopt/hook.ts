import { jcs } from "@/lib/format/jcs";
import {
  CANON,
  SCHEMA_ID,
  seal,
  type ContinuationProof,
} from "@/lib/format/proof";
import { sha256Hex } from "@/lib/handoff/hash";
import { recognize, type HostId } from "./hosts";

export interface AdoptOk {
  ok: true;
  host: Exclude<HostId, "unknown">;
  proof: ContinuationProof;
}

export interface AdoptFail {
  ok: false;
  host: "unknown";
  reason: string;
}

export type AdoptResult = AdoptOk | AdoptFail;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function extract(host: Exclude<HostId, "unknown">, raw: Record<string, unknown>) {
  if (host === "langgraph") {
    const command = isRecord(raw.command) ? raw.command : {};
    const updates = isRecord(raw.updates) ? raw.updates : {};
    return {
      from: String(raw.node ?? "node"),
      to: String(command.goto ?? "unknown"),
      trace: String(raw.graph ?? "graph"),
      payload: { state: raw.state ?? {}, updates },
      evidence: Object.keys(updates).map((k) => ({
        id: k,
        type: "state_update",
        source: `langgraph.updates.${k}`,
        body: updates[k],
      })),
    };
  }
  if (host === "otel") {
    const attrs = isRecord(raw.attributes) ? raw.attributes : {};
    const events = Array.isArray(raw.events) ? raw.events : [];
    return {
      from: String(attrs["gen_ai.agent.name"] ?? "span"),
      to: String(attrs["gen_ai.handoff.target"] ?? "unknown"),
      trace: String(raw.traceId ?? "trace"),
      payload: { attributes: attrs, name: raw.name },
      evidence: events.filter(isRecord).map((ev, i) => ({
        id: `ev${i + 1}`,
        type: String(ev.name ?? "event"),
        source: "otel.event",
        body: ev.attributes ?? ev,
      })),
    };
  }
  if (host === "crewai") {
    return {
      from: String(raw.agent ?? "agent"),
      to: String(raw.handoff_to ?? "unknown"),
      trace: String(raw.crew ?? "crew"),
      payload: { task: raw.task, output: raw.output },
      evidence: raw.output
        ? [
            {
              id: "task_output",
              type: "agent_output",
              source: "crewai.output",
              body: raw.output,
            },
          ]
        : [],
    };
  }
  return {
    from: String(raw.from),
    to: String(raw.to),
    trace: String(raw.trace ?? "http"),
    payload: {
      task: raw.task ?? null,
      state: raw.state ?? {},
    },
    evidence: [],
  };
}

export async function adopt(raw: unknown): Promise<AdoptResult> {
  const host = recognize(raw);
  if (host === "unknown" || !isRecord(raw)) {
    return {
      ok: false,
      host: "unknown",
      reason: "UNVERIFIABLE — enveloppe inconnue. Rien n'est inventé.",
    };
  }
  const extracted = extract(host, raw);
  const payloadHash = `sha256:${await sha256Hex(jcs(extracted.payload))}`;
  const evidence = [];
  for (const ev of extracted.evidence) {
    evidence.push({
      id: ev.id,
      type: ev.type,
      hash: `sha256:${await sha256Hex(jcs(ev.body))}`,
      source: ev.source,
      ts: "2026-09-17T15:36:00.000Z",
    });
  }
  const stateHash = `sha256:${await sha256Hex(jcs({ from: extracted.from, to: extracted.to, payloadHash }))}`;
  const proof: ContinuationProof = {
    v: SCHEMA_ID,
    id: `cp_${payloadHash.slice(7, 15)}`,
    trace: extracted.trace,
    from: extracted.from,
    to: extracted.to,
    time: "2026-09-17T15:36:00.000Z",
    canon: CANON,
    expected: { steps: [], evidence: [] },
    committed: { event_id: `evt_${extracted.from}`, payload_hash: payloadHash },
    received: { payload_hash: payloadHash },
    evidence,
    provenance: { prev: null, key_id: "local" },
    state: { reconstructible: false, hash: stateHash },
    contradictions: [],
    missing: [],
    status: "UNKNOWN",
    next_evidence: null,
    stop: false,
  };
  return { ok: true, host, proof: seal(proof) };
}

export async function verifyIncoming(
  proof: ContinuationProof,
  incoming: unknown,
): Promise<"MATCH" | "MISMATCH"> {
  const host = recognize(incoming);
  if (host === "unknown" || !isRecord(incoming)) return "MISMATCH";
  const extracted = extract(host, incoming);
  const hash = `sha256:${await sha256Hex(jcs(extracted.payload))}`;
  return hash === proof.committed.payload_hash ? "MATCH" : "MISMATCH";
}
