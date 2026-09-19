import type { CertifyResponse, GateResult, RulesetId } from "./types.ts";

function judgeLabel(ruleset: RulesetId): string {
  return ruleset === "1.0" ? "V0" : `V${ruleset}`;
}

/**
 * CERT+GATE couple over a certify response.
 * B resumes only if the notary says REPRENABLE. Same reasons as src/lib/bench/gate.ts.
 * wrapNode is the observer. This is the couple under attack.
 */
export function fromCertificate(
  certified: CertifyResponse,
  ruleset: RulesetId,
): GateResult {
  const { certificate, offer, payment } = certified;
  const label = judgeLabel(ruleset);
  if (certificate.verdict === "REPRENABLE") {
    return {
      couple: "CERT+GATE",
      ruleset,
      decision: "PASS",
      verdict: certificate.verdict,
      reason: `${label} : REPRENABLE — B est autorisé à reprendre.`,
      certificate,
      offer,
      payment,
    };
  }
  return {
    couple: "CERT+GATE",
    ruleset,
    decision: "STOP",
    verdict: certificate.verdict,
    reason:
      certificate.verdict === "CORROMPU"
        ? `${label} : CORROMPU — reprise bloquée.`
        : `${label} : PARTIEL — reprise bloquée (reste non repris comme achevé).`,
    certificate,
    offer,
    payment,
  };
}
