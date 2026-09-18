import { certify, toPublicCertificate } from "@/lib/handoff/engine";
import type { PublicCertificate, Verdict } from "@/lib/handoff/types";

/** B reprend seulement si le notaire V0 dit REPRENABLE. */
export type GateDecision = "PASS" | "STOP";

export interface GateResult {
  couple: "CERT+GATE";
  ruleset: "1.0";
  decision: GateDecision;
  verdict: Verdict;
  reason: string;
  certificate: PublicCertificate;
}

export async function gateResume(packet: unknown): Promise<GateResult> {
  const cert = await certify(packet);
  const certificate = toPublicCertificate(cert);
  if (cert.verdict === "REPRENABLE") {
    return {
      couple: "CERT+GATE",
      ruleset: "1.0",
      decision: "PASS",
      verdict: cert.verdict,
      reason: "V0 : REPRENABLE — B est autorisé à reprendre.",
      certificate,
    };
  }
  return {
    couple: "CERT+GATE",
    ruleset: "1.0",
    decision: "STOP",
    verdict: cert.verdict,
    reason:
      cert.verdict === "CORROMPU"
        ? "V0 : CORROMPU — reprise bloquée."
        : "V0 : PARTIEL — reprise bloquée (reste non repris comme achevé).",
    certificate,
  };
}
