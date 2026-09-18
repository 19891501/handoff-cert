import { jcs } from "../format/jcs.ts";

/** RFC 8785 JSON Canonicalization Scheme — same algorithm as jcs(). */
export function canonicalize(value: unknown): string {
  return jcs(value);
}

export async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
}

export function shortHash(hex: string, n = 12): string {
  return hex.slice(0, n);
}
