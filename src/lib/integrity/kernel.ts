import { canonicalize, sha256Hex } from "@/lib/handoff/hash";

export type Integrity =
  | "INTACT"
  | "MODIFIED"
  | "INVALID_SIGNATURE"
  | "UNVERIFIABLE"
  | "CHAIN_BROKEN"
  | "REPLAY";

export interface Envelope {
  version: "1";
  event_id: string;
  sender: string;
  receiver: string;
  timestamp: string;
  canonicalization: "JCS";
  payload_hash: string;
  previous_event_hash: string;
  schema_hash: string;
  key_id: string;
}

export interface IntegrityCertificate {
  envelope: Envelope;
  signature: string;
}

export interface VerifyResult {
  integrity: Integrity;
  signature: "VALID" | "INVALID" | "MISSING";
  chain: "VALID" | "BROKEN" | "UNKNOWN";
  payload: "MATCH" | "MISMATCH" | "UNKNOWN";
}

export const SCHEMA_HASH = "sha256:handoff-cert-integrity-v1";
export const ZERO_HASH = "0".repeat(64);

export async function digest(payload: unknown): Promise<string> {
  return sha256Hex(canonicalize(payload));
}

export async function hmacHex(secret: Uint8Array, message: string): Promise<string> {
  const copy = new Uint8Array(secret.byteLength);
  copy.set(secret);
  const key = await crypto.subtle.importKey(
    "raw",
    copy,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return Array.from(new Uint8Array(sig), (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function commit(args: {
  payload: unknown;
  sender: string;
  receiver: string;
  event_id: string;
  timestamp: string;
  previous_event_hash: string;
  secret: Uint8Array;
  key_id: string;
}): Promise<IntegrityCertificate> {
  const payload_hash = await digest(args.payload);
  const envelope: Envelope = {
    version: "1",
    event_id: args.event_id,
    sender: args.sender,
    receiver: args.receiver,
    timestamp: args.timestamp,
    canonicalization: "JCS",
    payload_hash,
    previous_event_hash: args.previous_event_hash,
    schema_hash: SCHEMA_HASH,
    key_id: args.key_id,
  };
  const signature = await hmacHex(args.secret, canonicalize(envelope));
  return { envelope, signature };
}

export async function verify(args: {
  certificate: IntegrityCertificate | null;
  received: unknown;
  secret: Uint8Array | null;
  seen: Set<string>;
  expectedPrevious: string | null;
}): Promise<VerifyResult> {
  const { certificate, received, secret, seen, expectedPrevious } = args;
  if (!certificate || !certificate.signature || !secret) {
    return {
      integrity: "UNVERIFIABLE",
      signature: "MISSING",
      chain: "UNKNOWN",
      payload: "UNKNOWN",
    };
  }
  const expectedSig = await hmacHex(secret, canonicalize(certificate.envelope));
  if (expectedSig !== certificate.signature) {
    return {
      integrity: "INVALID_SIGNATURE",
      signature: "INVALID",
      chain: "UNKNOWN",
      payload: "UNKNOWN",
    };
  }
  if (seen.has(certificate.envelope.event_id)) {
    return {
      integrity: "REPLAY",
      signature: "VALID",
      chain: "VALID",
      payload: "MATCH",
    };
  }
  if (
    expectedPrevious != null &&
    certificate.envelope.previous_event_hash !== expectedPrevious
  ) {
    return {
      integrity: "CHAIN_BROKEN",
      signature: "VALID",
      chain: "BROKEN",
      payload: "MATCH",
    };
  }
  const receivedHash = await digest(received);
  if (receivedHash !== certificate.envelope.payload_hash) {
    return {
      integrity: "MODIFIED",
      signature: "VALID",
      chain: "VALID",
      payload: "MISMATCH",
    };
  }
  return {
    integrity: "INTACT",
    signature: "VALID",
    chain: "VALID",
    payload: "MATCH",
  };
}
