import { canonicalize } from "@/lib/handoff/hash";
import { certify } from "@/lib/handoff/engine";
import {
  ZERO_HASH,
  commit,
  digest,
  verify,
  type IntegrityCertificate,
} from "@/lib/integrity/kernel";
import { mutateValue, randomJson } from "./payload";
import { int, mulberry32, pick, shuffleKeys } from "./rng";

export interface TrialFailure {
  seed: number;
  note: string;
  before?: unknown;
  after?: unknown;
}

export interface PropertyDef {
  id: string;
  layer: "integrite" | "continuation";
  title: string;
  expected: string;
  trials: number;
  run: (seed: number) => Promise<TrialFailure | null>;
}

const TS = "2026-09-16T08:41:12Z";

function secretFromSeed(seed: number): Uint8Array {
  const bytes = new Uint8Array(32);
  const rng = mulberry32(seed ^ 0x9e3779b9);
  for (let i = 0; i < 32; i++) bytes[i] = Math.floor(rng() * 256);
  return bytes;
}

async function signed(payload: unknown, seed: number, eventId: string) {
  const secret = secretFromSeed(seed);
  const cert = await commit({
    payload,
    sender: "agent_A",
    receiver: "agent_B",
    event_id: eventId,
    timestamp: TS,
    previous_event_hash: ZERO_HASH,
    secret,
    key_id: "k-lab",
  });
  return { cert, secret };
}

function handoff(opts: {
  claim: string;
  status: string;
  refs: boolean;
  remaining: boolean;
  extra?: Record<string, unknown>;
}) {
  const evidence = opts.status
    ? [
        {
          id: "e1",
          type: "tool_result",
          source: "lab",
          timestamp: TS,
          status: opts.status,
          content: { n: 1 },
        },
      ]
    : [];
  return {
    from: "A",
    to: "B",
    task: "Exécuter la tâche de laboratoire",
    state: { known: { job: "lab" }, version: "1" },
    work_done: [
      {
        claim: opts.claim,
        evidence_refs: opts.refs ? ["e1"] : [],
      },
    ],
    work_remaining: opts.remaining ? ["Continuer"] : undefined,
    evidence,
    ...opts.extra,
  };
}

export const PROPERTIES: PropertyDef[] = [
  {
    id: "I1",
    layer: "integrite",
    title: "Réordonnancement des clés",
    expected: "même empreinte",
    trials: 80,
    async run(seed) {
      const rng = mulberry32(seed);
      const payload = randomJson(rng);
      const shuffled = shuffleKeys(rng, payload);
      const a = await digest(payload);
      const b = await digest(shuffled);
      if (a !== b) {
        return { seed, note: "JCS a divergé sur un réordonnancement.", before: payload, after: shuffled };
      }
      return null;
    },
  },
  {
    id: "I2",
    layer: "integrite",
    title: "Payload modifié après signature",
    expected: "jamais INTACT",
    trials: 80,
    async run(seed) {
      const rng = mulberry32(seed);
      const payload = randomJson(rng);
      let mutated = mutateValue(rng, payload);
      let guard = 0;
      while (canonicalize(mutated) === canonicalize(payload) && guard < 8) {
        mutated = mutateValue(rng, mutated);
        guard += 1;
      }
      if (canonicalize(mutated) === canonicalize(payload)) return null;
      const { cert, secret } = await signed(payload, seed, `evt-${seed}`);
      const result = await verify({
        certificate: cert,
        received: mutated,
        secret,
        seen: new Set(),
        expectedPrevious: ZERO_HASH,
      });
      if (result.integrity === "INTACT") {
        return {
          seed,
          note: "False Safe : INTACT sur un contenu distinct.",
          before: payload,
          after: mutated,
        };
      }
      return null;
    },
  },
  {
    id: "I3",
    layer: "integrite",
    title: "Signature altérée",
    expected: "INVALID_SIGNATURE",
    trials: 40,
    async run(seed) {
      const rng = mulberry32(seed);
      const payload = randomJson(rng);
      const { cert, secret } = await signed(payload, seed, `evt-${seed}`);
      const dirty: IntegrityCertificate = {
        envelope: cert.envelope,
        signature: cert.signature.replace(/[0-9a-f]/, (c) => (c === "a" ? "b" : "a")),
      };
      const result = await verify({
        certificate: dirty,
        received: payload,
        secret,
        seen: new Set(),
        expectedPrevious: ZERO_HASH,
      });
      if (result.integrity !== "INVALID_SIGNATURE") {
        return { seed, note: `Obtenu ${result.integrity}.`, before: cert.signature, after: dirty.signature };
      }
      return null;
    },
  },
  {
    id: "I4",
    layer: "integrite",
    title: "Pas de certificat",
    expected: "UNVERIFIABLE",
    trials: 20,
    async run(seed) {
      const rng = mulberry32(seed);
      const payload = randomJson(rng);
      const result = await verify({
        certificate: null,
        received: payload,
        secret: secretFromSeed(seed),
        seen: new Set(),
        expectedPrevious: null,
      });
      if (result.integrity !== "UNVERIFIABLE") {
        return { seed, note: `Obtenu ${result.integrity}.` };
      }
      return null;
    },
  },
  {
    id: "I5",
    layer: "integrite",
    title: "Mensonge signé, réception identique",
    expected: "INTACT — Integrity ≠ Truth",
    trials: 40,
    async run(seed) {
      const lie = { claim: "Le paiement a été effectué.", amount: int(mulberry32(seed), 1, 9999) };
      const { cert, secret } = await signed(lie, seed, `lie-${seed}`);
      const result = await verify({
        certificate: cert,
        received: lie,
        secret,
        seen: new Set(),
        expectedPrevious: ZERO_HASH,
      });
      if (result.integrity !== "INTACT") {
        return { seed, note: `Le mensonge signé n'est pas INTACT (${result.integrity}).`, before: lie };
      }
      return null;
    },
  },
  {
    id: "I6",
    layer: "integrite",
    title: "Replay du même event_id",
    expected: "REPLAY",
    trials: 20,
    async run(seed) {
      const rng = mulberry32(seed);
      const payload = randomJson(rng);
      const { cert, secret } = await signed(payload, seed, `rep-${seed}`);
      const result = await verify({
        certificate: cert,
        received: payload,
        secret,
        seen: new Set([cert.envelope.event_id]),
        expectedPrevious: ZERO_HASH,
      });
      if (result.integrity !== "REPLAY") {
        return { seed, note: `Obtenu ${result.integrity}.` };
      }
      return null;
    },
  },
  {
    id: "C1",
    layer: "continuation",
    title: "Preuves retirées",
    expected: "jamais REPRENABLE",
    trials: 60,
    async run(seed) {
      const rng = mulberry32(seed);
      const claim = pick(rng, [
        "Les tests ont réussi.",
        "Le paiement a été effectué.",
        "La validation a été confirmée.",
      ]);
      const packet = handoff({
        claim,
        status: "",
        refs: false,
        remaining: rng() < 0.5,
      });
      packet.evidence = [];
      const cert = await certify(packet);
      if (cert.verdict === "REPRENABLE") {
        return { seed, note: "False Safe : REPRENABLE sans preuve.", before: packet };
      }
      return null;
    },
  },
  {
    id: "C2",
    layer: "continuation",
    title: "Affirmation de succès + preuve FAIL",
    expected: "jamais REPRENABLE",
    trials: 60,
    async run(seed) {
      const rng = mulberry32(seed);
      const claim = pick(rng, [
        "Les tests ont réussi.",
        "Le paiement a été effectué.",
        "La compilation a réussi.",
      ]);
      const status = pick(rng, ["FAIL", "CANCELLED", "DENIED", "REJECTED"]);
      const packet = handoff({ claim, status, refs: true, remaining: true });
      const cert = await certify(packet);
      if (cert.verdict === "REPRENABLE") {
        return {
          seed,
          note: "False Safe : REPRENABLE malgré une preuve d'échec liée.",
          before: packet,
        };
      }
      return null;
    },
  },
  {
    id: "C3",
    layer: "continuation",
    title: "Réordonnancement JSON",
    expected: "même verdict",
    trials: 40,
    async run(seed) {
      const rng = mulberry32(seed);
      const packet = handoff({
        claim: "Les tests ont réussi.",
        status: pick(rng, ["PASS", "FAIL", ""]),
        refs: rng() < 0.7,
        remaining: true,
      });
      const a = await certify(packet);
      const b = await certify(shuffleKeys(rng, packet));
      if (a.verdict !== b.verdict) {
        return {
          seed,
          note: `${a.verdict} ≠ ${b.verdict}`,
          before: packet,
        };
      }
      return null;
    },
  },
  {
    id: "C4",
    layer: "continuation",
    title: "Preuve inutilisée ajoutée",
    expected: "même verdict",
    trials: 40,
    async run(seed) {
      const rng = mulberry32(seed);
      const packet = handoff({
        claim: "Les tests ont réussi.",
        status: "PASS",
        refs: true,
        remaining: true,
      });
      const extra = {
        ...packet,
        evidence: [
          ...packet.evidence,
          {
            id: "unused",
            type: "note",
            source: "lab",
            timestamp: TS,
            status: "PASS",
            content: { noise: int(rng, 1, 9) },
          },
        ],
      };
      const a = await certify(packet);
      const b = await certify(extra);
      if (a.verdict !== b.verdict) {
        return {
          seed,
          note: `Verdict déplacé ${a.verdict} → ${b.verdict} par une pièce non liée.`,
          before: packet,
          after: extra,
        };
      }
      return null;
    },
  },
];

export interface PropertyResult {
  def: PropertyDef;
  passed: number;
  failed: number;
  failure: TrialFailure | null;
}

export async function runProperty(
  def: PropertyDef,
  onTrial?: (done: number) => void,
): Promise<PropertyResult> {
  let passed = 0;
  let failure: TrialFailure | null = null;
  for (let i = 0; i < def.trials; i++) {
    const seed = (i + 1) * 0x9e3779b9 + def.id.charCodeAt(1);
    const miss = await def.run(seed >>> 0);
    if (miss) {
      failure = miss;
      break;
    }
    passed += 1;
    onTrial?.(i + 1);
  }
  return {
    def,
    passed,
    failed: failure ? 1 : 0,
    failure,
  };
}
