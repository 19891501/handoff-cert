/** RFC 8785 JSON Canonicalization Scheme — subset for JSON data (no BigInt).
 *  Strings are Unicode NFC before serialization. Key order is UTF-16 code units, never localeCompare. */

export function jcs(value: unknown): string {
  if (value === null || typeof value === "boolean") return JSON.stringify(value);
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new TypeError("JCS refuse NaN et Infinity");
    return JSON.stringify(value);
  }
  if (typeof value === "string") return JSON.stringify(nfc(value));
  if (typeof value === "bigint") throw new TypeError("JCS refuse bigint");
  if (Array.isArray(value)) {
    return `[${value.map((item) => (item === undefined ? "null" : jcs(item))).join(",")}]`;
  }
  if (typeof value === "object") {
    const rec = value as Record<string, unknown>;
    const keys = Object.keys(rec)
      .filter((k) => rec[k] !== undefined)
      .sort((a, b) => compareUtf16(nfc(a), nfc(b)));
    return `{${keys.map((k) => `${JSON.stringify(nfc(k))}:${jcs(rec[k])}`).join(",")}}`;
  }
  throw new TypeError("JCS: type non JSON");
}

export function compareUtf16(a: string, b: string): number {
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

export function sortKeysLocale(value: unknown, locale: string): unknown {
  if (Array.isArray(value)) return value.map((v) => sortKeysLocale(v, locale));
  if (value && typeof value === "object") {
    const rec = value as Record<string, unknown>;
    const keys = Object.keys(rec).sort((a, b) => a.localeCompare(b, locale));
    const out: Record<string, unknown> = {};
    for (const k of keys) out[k] = sortKeysLocale(rec[k], locale);
    return out;
  }
  return value;
}

export function shuffleKeys(value: unknown, seed: number): unknown {
  if (Array.isArray(value)) return value.map((v) => shuffleKeys(v, seed + 1));
  if (value && typeof value === "object") {
    const rec = value as Record<string, unknown>;
    const keys = Object.keys(rec);
    let a = seed >>> 0;
    for (let i = keys.length - 1; i > 0; i--) {
      a = (a + 0x6d2b79f5) >>> 0;
      const j = a % (i + 1);
      [keys[i], keys[j]] = [keys[j]!, keys[i]!];
    }
    const out: Record<string, unknown> = {};
    for (const k of keys) out[k] = shuffleKeys(rec[k], seed + k.length);
    return out;
  }
  return value;
}

export function utf8Len(text: string): number {
  return new TextEncoder().encode(text).byteLength;
}

export function nfc(s: string): string {
  return s.normalize("NFC");
}

export function nfd(s: string): string {
  return s.normalize("NFD");
}
