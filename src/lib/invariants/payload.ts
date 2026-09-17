import { int, pick, type Rng } from "./rng";

const KEYS = ["a", "b", "amount", "order_id", "status", "note", "count", "ok"] as const;
const WORDS = ["alpha", "beta", "gamma", "done", "paid", "open"] as const;

export function randomJson(rng: Rng, depth = 0): unknown {
  const kind = int(rng, 0, depth > 2 ? 4 : 6);
  if (kind === 0) return int(rng, 0, 50);
  if (kind === 1) return pick(rng, WORDS);
  if (kind === 2) return rng() < 0.5;
  if (kind === 3) return null;
  if (kind === 4) {
    const n = int(rng, 0, 3);
    return Array.from({ length: n }, () => randomJson(rng, depth + 1));
  }
  const n = int(rng, 1, 4);
  const used = new Set<string>();
  const obj: Record<string, unknown> = {};
  for (let i = 0; i < n; i++) {
    const key = pick(rng, KEYS);
    if (used.has(key)) continue;
    used.add(key);
    obj[key] = randomJson(rng, depth + 1);
  }
  return obj;
}

export function mutateValue(rng: Rng, value: unknown): unknown {
  if (typeof value === "number") return value + 1 + int(rng, 0, 3);
  if (typeof value === "string") return `${value}~`;
  if (typeof value === "boolean") return !value;
  if (value === null) return 0;
  if (Array.isArray(value)) {
    if (value.length === 0) return [1];
    const i = int(rng, 0, value.length - 1);
    const next = [...value];
    next[i] = mutateValue(rng, next[i]);
    return next;
  }
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 0) return { extra: 1 };
    if (rng() < 0.34) {
      const { [entries[0]![0]]: _, ...rest } = value as Record<string, unknown>;
      void _;
      return rest;
    }
    if (rng() < 0.5) {
      return { ...(value as Record<string, unknown>), extra: int(rng, 1, 9) };
    }
    const [k, v] = pick(rng, entries);
    return { ...(value as Record<string, unknown>), [k]: mutateValue(rng, v) };
  }
  return 1;
}

export function deepEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}
