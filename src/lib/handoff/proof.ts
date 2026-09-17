import { normalize } from "./normalize";

export function proofFromPayload(input: unknown) {
  const { canonical } = normalize(input);
  const byId = new Map(canonical.evidence.map((e) => [e.id, e]));
  return canonical.work_done.map((claim) => {
    const first = claim.evidence_refs.map((id) => byId.get(id)).find(Boolean);
    return {
      claim: claim.claim,
      evidenceId: first?.id,
      source: first?.source,
      timestamp: first?.timestamp,
      linked: Boolean(first),
    };
  });
}
