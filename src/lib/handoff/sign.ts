import { jcs } from "../format/jcs";
import type { PublicCertificate } from "./types";

/**
 * Issuer signature over the portable public fields of a HANDOFF certificate.
 *
 * Algorithm: Ed25519 via WebCrypto when the runtime supports it. The 32-byte
 * `secret` is the issuer seed (PKCS8-wrapped). This is the identity of the
 * issuer, not of agent A.
 *
 * Fallback: HMAC-SHA256 over the same canonical bytes when Ed25519 is absent.
 * Pass a dedicated ISSUER_SECRET as `secret`. HMAC is a MAC, not an identity
 * of A (nor of the issuer as a public key).
 *
 * serveCertify attaches `{ signature, key_id }` as `issuer_sig` on the public
 * certificate when ISSUER_SECRET or ISSUER_ED25519_KEY is set. Engine
 * certify() stays unsigned. integrite remains non_fourni: an issuer MAC is
 * not a verification of agent A, and is not claimed as such.
 *
 * Never a fake HMAC — unset env yields no signature field at all.
 */

export const SIGN_ALG_ED25519 = "Ed25519" as const;
export const SIGN_ALG_HMAC = "HMAC-SHA256" as const;

export type SigningAlgorithm = typeof SIGN_ALG_ED25519 | typeof SIGN_ALG_HMAC;

/** PKCS#8 prefix for a 32-byte Ed25519 seed (RFC 8410). */
const PKCS8_PREFIX = Uint8Array.of(
  0x30, 0x2e, 0x02, 0x01, 0x00, 0x30, 0x05, 0x06, 0x03, 0x2b, 0x65, 0x70, 0x04, 0x22, 0x04, 0x20,
);

export type SignablePublicFields = Pick<
  PublicCertificate,
  "verdict" | "ruleset" | "input_hash" | "certificate_id"
>;

/** On-wire issuer signature. Not an identity of agent A. */
export interface IssuerSig {
  signature: string;
  key_id: string;
}

let ed25519Cached: boolean | null = null;

export async function signingAlgorithm(): Promise<SigningAlgorithm> {
  return (await ed25519Available()) ? SIGN_ALG_ED25519 : SIGN_ALG_HMAC;
}

export function canonicalPublicCertificate(pub: SignablePublicFields): string {
  return jcs({
    certificate_id: pub.certificate_id,
    input_hash: pub.input_hash,
    ruleset: pub.ruleset,
    verdict: pub.verdict,
  });
}

/**
 * Decode ISSUER_SECRET / ISSUER_ED25519_KEY. Even-length hex when it parses,
 * otherwise UTF-8. Never invents a default key.
 */
export function decodeIssuerSecret(raw: string): Uint8Array {
  const s = raw.trim();
  const hex = fromHex(s);
  if (hex && hex.byteLength > 0) return hex;
  return encode(s);
}

/**
 * Issuer material from env, or null if unset/blank. Prefers
 * ISSUER_ED25519_KEY over ISSUER_SECRET. No default, no fake MAC.
 */
export function issuerSecretFromEnv(
  source: NodeJS.ProcessEnv = process.env,
): Uint8Array | null {
  const raw = source.ISSUER_ED25519_KEY?.trim() || source.ISSUER_SECRET?.trim();
  if (!raw) return null;
  return decodeIssuerSecret(raw);
}

/**
 * Sign portable public fields for the wire when issuer material is configured.
 * Returns null when both env vars are unset — callers must omit `issuer_sig`.
 */
export async function issuerSigOnWire(
  pub: SignablePublicFields,
  source: NodeJS.ProcessEnv = process.env,
): Promise<IssuerSig | null> {
  const secret = issuerSecretFromEnv(source);
  if (!secret) return null;
  return signPublicCertificate(pub, secret);
}

export async function signPublicCertificate(
  pub: SignablePublicFields,
  secret: Uint8Array,
): Promise<{ signature: string; key_id: string }> {
  const message = encode(canonicalPublicCertificate(pub));
  if (await ed25519Available()) {
    const seed = await toEd25519Seed(secret);
    const privateKey = await importEd25519Private(seed);
    const publicKey = await publicFromPrivate(privateKey);
    const sig = new Uint8Array(await crypto.subtle.sign("Ed25519", privateKey, message));
    return { signature: toHex(sig), key_id: await keyIdEd25519(publicKey) };
  }
  const signature = await hmacSha256Hex(secret, message);
  return { signature, key_id: await keyIdHmac(secret) };
}

export async function verifyPublicCertificate(
  pub: SignablePublicFields,
  signature: string,
  secret: Uint8Array,
): Promise<boolean> {
  try {
    const message = encode(canonicalPublicCertificate(pub));
    const sig = fromHex(signature);
    if (!sig) return false;
    if (await ed25519Available()) {
      if (sig.byteLength !== 64) return false;
      const seed = await toEd25519Seed(secret);
      const privateKey = await importEd25519Private(seed);
      const publicKey = await publicFromPrivate(privateKey);
      return crypto.subtle.verify("Ed25519", publicKey, sig, message);
    }
    const expected = await hmacSha256Hex(secret, message);
    return timingSafeEqualHex(signature.toLowerCase(), expected);
  } catch {
    return false;
  }
}

async function ed25519Available(): Promise<boolean> {
  if (ed25519Cached != null) return ed25519Cached;
  try {
    const seed = new Uint8Array(32);
    await importEd25519Private(seed);
    ed25519Cached = true;
  } catch {
    ed25519Cached = false;
  }
  return ed25519Cached;
}

async function toEd25519Seed(secret: Uint8Array): Promise<Uint8Array> {
  if (secret.byteLength === 32) {
    const copy = new Uint8Array(32);
    copy.set(secret);
    return copy;
  }
  return new Uint8Array(await crypto.subtle.digest("SHA-256", secret));
}

async function importEd25519Private(seed: Uint8Array): Promise<CryptoKey> {
  const pkcs8 = new Uint8Array(PKCS8_PREFIX.length + 32);
  pkcs8.set(PKCS8_PREFIX);
  pkcs8.set(seed, PKCS8_PREFIX.length);
  return crypto.subtle.importKey("pkcs8", pkcs8, "Ed25519", true, ["sign"]);
}

async function publicFromPrivate(privateKey: CryptoKey): Promise<CryptoKey> {
  const jwk = await crypto.subtle.exportKey("jwk", privateKey);
  const { d: _d, key_ops: _ops, ext: _ext, ...pub } = jwk;
  return crypto.subtle.importKey(
    "jwk",
    { ...pub, key_ops: ["verify"] },
    "Ed25519",
    true,
    ["verify"],
  );
}

async function keyIdEd25519(publicKey: CryptoKey): Promise<string> {
  const raw = new Uint8Array(await crypto.subtle.exportKey("raw", publicKey));
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", raw));
  return `ed25519:${toHex(digest).slice(0, 16)}`;
}

async function keyIdHmac(secret: Uint8Array): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", secret));
  return `hmac-sha256:${toHex(digest).slice(0, 16)}`;
}

async function hmacSha256Hex(secret: Uint8Array, message: Uint8Array): Promise<string> {
  const copy = new Uint8Array(secret.byteLength);
  copy.set(secret);
  const key = await crypto.subtle.importKey(
    "raw",
    copy,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, message);
  return toHex(new Uint8Array(sig));
}

function encode(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

function fromHex(hex: string): Uint8Array | null {
  const s = hex.trim().toLowerCase();
  if (!s || s.length % 2 !== 0 || /[^0-9a-f]/.test(s)) return null;
  const out = new Uint8Array(s.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(s.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
