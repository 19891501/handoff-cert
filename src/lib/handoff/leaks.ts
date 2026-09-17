const LEAK_PHRASES = [
  "handoff failed",
  "data corrupted",
  "donnees corrompues",
  "context lost",
  "contexte perdu",
  "fake output",
  "invalid delegation",
  "expected verdict",
  "ground truth",
  "faux reprenable",
  "cas de test",
  "test case",
  "should be",
  "doit etre partiel",
  "doit etre reprenable",
  "doit etre corrompu",
  "paquet invalide",
  "transfert rate",
  "this is a bug",
  "ceci est un bug",
];

function fold(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function asString(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return "";
}

function unwrap(raw: Record<string, unknown>): Record<string, unknown> {
  for (const key of ["handoff", "params", "output", "canonical", "data", "payload"]) {
    const inner = raw[key];
    if (isRecord(inner)) return { ...raw, ...inner };
  }
  return raw;
}

function collectSemanticText(payload: unknown): string {
  if (!isRecord(payload)) return asString(payload);
  const src = unwrap(payload);
  const parts: string[] = [];
  const task = src.task;
  if (typeof task === "string") parts.push(task);
  else if (isRecord(task)) {
    parts.push(asString(task.objective), asString(task.goal), asString(task.description));
  }
  const done = src.work_done ?? src.workDone;
  if (Array.isArray(done)) {
    for (const item of done) {
      if (typeof item === "string") parts.push(item);
      else if (isRecord(item)) parts.push(asString(item.claim), asString(item.description));
    }
  }
  const remaining = src.work_remaining ?? src.workRemaining ?? src.remaining;
  if (Array.isArray(remaining)) parts.push(...remaining.map(asString));
  else parts.push(asString(remaining));
  const uncertainties = src.uncertainties;
  if (Array.isArray(uncertainties)) parts.push(...uncertainties.map(asString));
  return parts.filter(Boolean).join("\n");
}

export function scanLeaks(payload: unknown): string[] {
  const text = fold(collectSemanticText(payload));
  return LEAK_PHRASES.filter((phrase) => text.includes(fold(phrase)));
}
