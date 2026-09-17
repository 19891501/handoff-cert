import {
  FAIL_TOKENS,
  SUCCESS_TOKENS,
  fold,
  hasToken,
  impliesFailure,
  impliesSuccess,
  stringValues,
} from "@/lib/handoff/engine";

const FR_FAIL = new Set([
  "annule",
  "echoue",
  "echec",
  "rejete",
  "refuse",
  "faux",
  "invalide",
  "corrompu",
]);
const FR_OK = new Set([
  "termine",
  "effectue",
  "valide",
  "paye",
  "approuve",
  "confirme",
  "reussi",
]);

export type MarkerLang = "fr" | "en";

export function langOf(token: string): MarkerLang {
  return FR_FAIL.has(token) || FR_OK.has(token) ? "fr" : "en";
}

export function matchingTokens(text: string, tokens: readonly string[]): string[] {
  return tokens.filter((token) => hasToken(text, [token]));
}

export interface MarkerScan {
  text: string;
  folded: string;
  success: string[];
  fail: string[];
  polarity: "success" | "fail" | "both" | "none";
  visible: string[];
}

export function scanText(text: string): MarkerScan {
  const success = matchingTokens(text, SUCCESS_TOKENS);
  const fail = matchingTokens(text, FAIL_TOKENS);
  const polarity =
    success.length && fail.length
      ? "both"
      : success.length
        ? "success"
        : fail.length
          ? "fail"
          : "none";
  return {
    text,
    folded: fold(text),
    success,
    fail,
    polarity,
    visible: stringValues(text),
  };
}

export function scanValue(value: unknown): MarkerScan {
  const visible = stringValues(value);
  const text = visible.join(" ");
  return { ...scanText(text), visible };
}

export const MARKER_FIXTURES: Array<{ id: string; title: string; value: unknown }> = [
  {
    id: "fr-ok",
    title: "Claim FR",
    value: "Le mode exécuteur a été confirmé.",
  },
  {
    id: "en-ok",
    title: "Claim EN succeeded",
    value: "the task succeeded with no problems",
  },
  {
    id: "en-success",
    title: "Claim EN success",
    value: "the task was a success",
  },
  {
    id: "adapter",
    title: "Repli adaptateur",
    value: "absentes",
  },
  {
    id: "false-str",
    title: "Mot false",
    value: "false",
  },
  {
    id: "bool",
    title: "Booléen false",
    value: { executorModeObservedAfterHandoff: false },
  },
];

export { FAIL_TOKENS, SUCCESS_TOKENS, impliesSuccess, impliesFailure };
