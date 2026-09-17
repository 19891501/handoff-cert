import { jcs } from "./jcs";

export const SHA_ALGOS = [
  {
    id: "SHA-1",
    bits: 160,
    used: false,
    why: "Collisions publiques (SHAttered). Interdit pour le commit.",
  },
  {
    id: "SHA-256",
    bits: 256,
    used: true,
    why: "cp.v1 — committed.payload_hash et evidence[].hash.",
  },
  {
    id: "SHA-384",
    bits: 384,
    used: false,
    why: "Plus long. Pas plus vrai.",
  },
  {
    id: "SHA-512",
    bits: 512,
    used: false,
    why: "Plus long. Pas plus vrai.",
  },
] as const;

export type ShaId = (typeof SHA_ALGOS)[number]["id"];

export const SAMPLE_STATE = {
  amount: 100,
  charged: true,
  order_id: "ord_9",
};

export async function shaHex(algo: ShaId, text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest(algo, data);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function shaAll(text: string): Promise<Record<ShaId, string>> {
  const out = {} as Record<ShaId, string>;
  for (const algo of SHA_ALGOS) {
    out[algo.id] = await shaHex(algo.id, text);
  }
  return out;
}

export function hammingBits(a: string, b: string): { flipped: number; total: number; ratio: number } {
  const n = Math.max(a.length, b.length);
  let flipped = Math.abs(a.length - b.length) * 4;
  const m = Math.min(a.length, b.length);
  for (let i = 0; i < m; i++) {
    let x = parseInt(a[i] ?? "0", 16) ^ parseInt(b[i] ?? "0", 16);
    while (x) {
      flipped += x & 1;
      x >>= 1;
    }
  }
  const total = n * 4;
  return { flipped, total, ratio: total === 0 ? 0 : flipped / total };
}

export function bytesOf(hex: string): number {
  return Math.ceil(hex.length / 2);
}

export const MUTATIONS: Array<{ id: string; title: string; apply: (v: unknown) => unknown }> = [
  {
    id: "same",
    title: "identique",
    apply: (v) => v,
  },
  {
    id: "reorder",
    title: "clés réordonnées",
    apply: (v) => {
      if (!v || typeof v !== "object" || Array.isArray(v)) return v;
      const rec = v as Record<string, unknown>;
      return { order_id: rec.order_id, charged: rec.charged, amount: rec.amount };
    },
  },
  {
    id: "pretty",
    title: "pretty (espaces)",
    apply: (v) => v,
  },
  {
    id: "lie",
    title: "charged: false",
    apply: (v) => ({ ...(v as object), charged: false }),
  },
];

export function canonOf(mutation: string, value: unknown): { text: string; kind: "jcs" | "pretty" } {
  if (mutation === "pretty") return { text: JSON.stringify(value, null, 2), kind: "pretty" };
  return { text: jcs(value), kind: "jcs" };
}
