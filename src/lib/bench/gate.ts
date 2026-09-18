import { certify, toPublicCertificate } from "@/lib/handoff/engine";
import type { Certificate, PublicCertificate, Verdict } from "@/lib/handoff/types";

/** B reprend seulement si le notaire dit REPRENABLE. */
export type GateDecision = "PASS" | "STOP";

export type RulesetId = "1.0" | "1.1";

export interface GateResult {
  couple: "CERT+GATE";
  ruleset: RulesetId;
  decision: GateDecision;
  verdict: Verdict;
  reason: string;
  certificate: PublicCertificate;
}

type CertifyFn = (packet: unknown) => Promise<Certificate>;

/** false = import already failed; undefined = not tried; fn = loaded. */
let certify11Cache: CertifyFn | false | undefined;

function bindCertify11(mod: { certify11?: CertifyFn }): CertifyFn | null {
  if (typeof mod.certify11 !== "function") return null;
  const impl = mod.certify11;
  return (packet) => impl(packet);
}

/**
 * Lazy load of certify11. If the module is missing or has no certify11,
 * return null — never invent a 1.1 judge.
 */
async function loadCertify11(): Promise<CertifyFn | null> {
  if (certify11Cache === false) return null;
  if (certify11Cache) return certify11Cache;

  const attempts: Array<() => Promise<{ certify11?: CertifyFn }>> = [
    () => import("../handoff/ruleset11.ts"),
    () => import("../handoff/ruleset11"),
    () => import("@/lib/handoff/ruleset11"),
  ];

  for (const load of attempts) {
    try {
      const fn = bindCertify11(await load());
      if (fn) {
        certify11Cache = fn;
        return fn;
      }
    } catch {
      continue;
    }
  }

  certify11Cache = false;
  return null;
}

export async function hasRuleset11(): Promise<boolean> {
  return (await loadCertify11()) !== null;
}

function fromCertificate(cert: Certificate, ruleset: RulesetId): GateResult {
  const certificate = toPublicCertificate(cert);
  const label = ruleset === "1.1" ? "V1.1" : "V0";
  if (cert.verdict === "REPRENABLE") {
    return {
      couple: "CERT+GATE",
      ruleset,
      decision: "PASS",
      verdict: cert.verdict,
      reason: `${label} : REPRENABLE — B est autorisé à reprendre.`,
      certificate,
    };
  }
  return {
    couple: "CERT+GATE",
    ruleset,
    decision: "STOP",
    verdict: cert.verdict,
    reason:
      cert.verdict === "CORROMPU"
        ? `${label} : CORROMPU — reprise bloquée.`
        : `${label} : PARTIEL — reprise bloquée (reste non repris comme achevé).`,
    certificate,
  };
}

export async function gateResume(
  packet: unknown,
  ruleset: RulesetId = "1.0",
): Promise<GateResult> {
  if (ruleset === "1.1") {
    const certify11 = await loadCertify11();
    if (!certify11) {
      throw new Error(
        "ruleset 1.1 unavailable: certify11 import failed — 1.1 is not invented",
      );
    }
    const cert = await certify11(packet);
    return fromCertificate(cert, "1.1");
  }

  const cert = await certify(packet);
  return fromCertificate(cert, "1.0");
}
