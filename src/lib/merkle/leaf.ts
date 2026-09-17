import { canonicalize, sha256Hex } from "@/lib/handoff/hash";
import { RULESET_VERSION } from "@/lib/handoff/types";

export interface UsageLeaf {
  sequence: number;
  timestamp: string;
  input_hash: string;
  ruleset_hash: string;
  nonce_serveur: string;
  id: string;
}

export async function hashRuleset(): Promise<string> {
  return sha256Hex(`handoff-cert-ruleset:${RULESET_VERSION}`);
}

export async function hashLeaf(leaf: UsageLeaf): Promise<string> {
  return sha256Hex(`mmr:leaf:${canonicalize(leaf)}`);
}

export function makeLeaf(
  sequence: number,
  nonce: string,
  rulesetHash: string,
  inputSeed: string,
  issuedAt: string,
): UsageLeaf {
  return {
    sequence,
    timestamp: issuedAt,
    input_hash: inputSeed,
    ruleset_hash: rulesetHash,
    nonce_serveur: nonce,
    id: `c${sequence.toString(16).padStart(4, "0")}`,
  };
}
