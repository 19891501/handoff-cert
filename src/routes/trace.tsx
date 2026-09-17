import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { CertificateView } from "@/components/cert/certificate-view";
import { VerdictStamp, VerdictDot } from "@/components/cert/stamp";
import { TRACE_CHAIN, certify, type Certificate, type Verdict } from "@/lib/handoff";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/trace")({ component: TracePage });

type Hop = {
  id: string;
  from: string;
  to: string;
  role: string;
  payload: unknown;
  certificate: Certificate | null;
};

function TracePage() {
  const [hops, setHops] = useState<Hop[]>(
    TRACE_CHAIN.map((h) => ({ ...h, certificate: null })),
  );
  const [active, setActive] = useState("H1");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const next: Hop[] = [];
      for (const hop of TRACE_CHAIN) {
        const certificate = await certify(hop.payload);
        next.push({ ...hop, certificate });
      }
      if (!cancelled) setHops(next);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const current = hops.find((h) => h.id === active) ?? hops[0];
  const epistemic = hops.map((h) => h.certificate?.verdict ?? null);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:py-12">
      <p className="text-xs font-medium uppercase tracking-[0.22em] text-subtle">
        Correctif production · 4 frontières
      </p>
      <h1 className="mt-2 font-display text-4xl tracking-tight">Trace</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
        Ce n'est plus « l'agent a répondu ». C'est l'état
        épistémique du travail à chaque passage de frontière.
      </p>

      <ol className="mt-8 grid gap-3 sm:grid-cols-4">
        {hops.map((hop, i) => {
          const verdict: Verdict | null = hop.certificate?.verdict ?? null;
          return (
            <li key={hop.id}>
              <button
                type="button"
                onClick={() => setActive(hop.id)}
                className={cn(
                  "flex h-full w-full flex-col rounded-xl bg-card p-4 text-left shadow-[var(--shadow-border)] transition-[box-shadow] duration-150",
                  active === hop.id && "shadow-[var(--shadow-border-hover)]",
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs text-subtle">{hop.id}</span>
                  {verdict ? <VerdictDot verdict={verdict} /> : null}
                </div>
                {verdict ? (
                  <VerdictStamp verdict={verdict} className="mx-auto my-3 size-20" />
                ) : (
                  <div className="mx-auto my-3 size-20 animate-pulse rounded-full bg-muted" />
                )}
                <p className="font-mono text-xs text-muted-foreground">
                  {hop.from} → {hop.to}
                </p>
                <p className="mt-1 text-sm">{hop.role}</p>
                {i < hops.length - 1 ? (
                  <p className="mt-3 text-xs text-subtle sm:hidden">puis {hops[i + 1]?.id}</p>
                ) : null}
              </button>
            </li>
          );
        })}
      </ol>

      <div className="mt-6 overflow-x-auto rounded-xl bg-card px-4 py-3 shadow-[var(--shadow-border)]">
        <p className="font-mono text-xs text-muted-foreground">
          TASK
          {epistemic.map((v, i) => (
            <span key={hops[i]?.id}>
              {" · "}
              {hops[i]?.id} {v ?? "…"}
            </span>
          ))}
        </p>
      </div>

      {current?.certificate ? (
        <div className="mt-8">
          <CertificateView certificate={current.certificate} />
        </div>
      ) : null}
    </div>
  );
}
