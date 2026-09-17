import {
  FAIL_TOKENS,
  OK_STATUS,
  SUCCESS_TOKENS,
  fold,
} from "@/lib/handoff/engine";
import { langOf } from "./markers";

export type TokenFamily = "claim-success" | "claim-fail" | "status-ok" | "status-fail";

export interface TokenType {
  token: string;
  family: TokenFamily;
  lang: "fr" | "en";
  match: "exact+prefix" | "exact";
}

export const TOKEN_TYPES: TokenType[] = [
  ...SUCCESS_TOKENS.map((token) => ({
    token,
    family: "claim-success" as const,
    lang: langOf(token),
    match: "exact+prefix" as const,
  })),
  ...FAIL_TOKENS.map((token) => ({
    token,
    family: "claim-fail" as const,
    lang: langOf(token),
    match: "exact+prefix" as const,
  })),
  ...[...OK_STATUS].map((token) => ({
    token,
    family: "status-ok" as const,
    lang: langOf(token),
    match: "exact" as const,
  })),
  ...FAIL_TOKENS.map((token) => ({
    token,
    family: "status-fail" as const,
    lang: langOf(token),
    match: "exact" as const,
  })),
];

export const FAMILIES: Array<{
  id: TokenFamily;
  title: string;
  body: string;
  match: string;
}> = [
  {
    id: "claim-success",
    title: "Claim succès",
    body: "Phrase de work_done. Exact ou préfixe (≥4). Accents repliés.",
    match: "exact + préfixe",
  },
  {
    id: "claim-fail",
    title: "Claim échec",
    body: "Même scanner, liste FAIL. Une claim sans token n'a pas de polarité.",
    match: "exact + préfixe",
  },
  {
    id: "status-ok",
    title: "Status OK",
    body: "evidence.status, Set exact. Court-circuite le contenu. « true » et « ok » sont ici, pas dans la claim.",
    match: "exact",
  },
  {
    id: "status-fail",
    title: "Status FAIL",
    body: "Même liste que claim-fail, mais match exact (pas de préfixe). Status gagne.",
    match: "exact",
  },
];

export function statusPolarity(status: string): "ok" | "fail" | "none" {
  const s = fold(status);
  if (!s) return "none";
  if (OK_STATUS.has(s)) return "ok";
  if (FAIL_TOKENS.includes(s)) return "fail";
  return "none";
}

export const STATUS_ONLY = [...OK_STATUS].filter((s) => !(SUCCESS_TOKENS as readonly string[]).includes(s));
export const CLAIM_ONLY_OK = SUCCESS_TOKENS.filter((s) => !OK_STATUS.has(s));
