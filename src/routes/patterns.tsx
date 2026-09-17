import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PATTERNS, type Pattern } from "@/lib/adopt/patterns";
import type { GraphStep } from "@/lib/adopt/langgraph";
import { cn, pretty } from "@/lib/utils";

export const Route = createFileRoute("/patterns")({ component: PatternsPage });

function PatternsPage() {
  const [id, setId] = useState(PATTERNS[0]!.id);
  const [steps, setSteps] = useState<GraphStep[] | null>(null);
  const [busy, setBusy] = useState(false);
  const pattern = PATTERNS.find((p) => p.id === id)!;

  async function run(next?: Pattern) {
    const p = next ?? pattern;
    setBusy(true);
    const out = await p.run();
    setSteps(out.steps);
    setBusy(false);
  }

  const sealed = steps?.some((s) => s.sealed) ?? false;

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:py-12">
      <p className="text-xs font-medium uppercase tracking-[0.22em] text-subtle">
        LangGraph · motifs officiels
      </p>
      <h1 className="mt-2 font-display text-4xl tracking-tight">Motifs</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
        LangChain documente plusieurs façons de « passer la main ». Une seule
        classe est un handoff : un autre nœud, un autre agent, reprend. Le
        middleware d'un agent unique n'en est pas un.
      </p>

      <div className="mt-6 flex flex-wrap gap-2">
        {PATTERNS.map((p) => (
          <Button
            key={p.id}
            variant={id === p.id ? "default" : "outline"}
            onClick={() => {
              setId(p.id);
              setSteps(null);
            }}
          >
            {p.title}
          </Button>
        ))}
      </div>

      <div className="mt-8 grid min-w-0 gap-6 lg:grid-cols-2">
        <div className="min-w-0 space-y-4">
          <article className="rounded-xl bg-card p-5 shadow-[var(--shadow-border)]">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={pattern.handoff ? "reprenable" : "default"}>
                {pattern.handoff ? "handoff" : "pas un handoff"}
              </Badge>
              <span className="text-xs text-subtle">{pattern.official}</span>
            </div>
            <p className="mt-4 text-sm text-muted-foreground">{pattern.why}</p>
          </article>
          <article className="min-w-0 overflow-hidden rounded-xl bg-card shadow-[var(--shadow-border)]">
            <div className="border-b border-border px-4 py-3 text-xs font-medium uppercase tracking-[0.16em] text-subtle">
              Motif
            </div>
            <pre className="overflow-x-auto p-4 font-mono text-xs leading-relaxed break-all text-muted-foreground sm:break-normal">
              {pattern.snippet}
            </pre>
          </article>
        </div>

        <div className="min-w-0 space-y-4">
          <Button onClick={() => run()} disabled={busy}>
            Exécuter le motif
          </Button>
          {steps ? (
            <>
              <ol className="space-y-2">
                {steps.map((step) => (
                  <li
                    key={`${step.node}-${step.goto}`}
                    className="flex min-h-11 items-center justify-between gap-3 rounded-xl bg-card px-4 py-3 text-sm shadow-[var(--shadow-border)]"
                  >
                    <span className="min-w-0 truncate font-mono text-xs">
                      {step.node} → {step.goto}
                    </span>
                    {step.sealed ? (
                      <Badge tone="reprenable">sceau</Badge>
                    ) : (
                      <Badge tone="default">silencieux</Badge>
                    )}
                  </li>
                ))}
              </ol>
              <p
                className={cn(
                  "text-sm",
                  sealed === pattern.handoff ? "text-reprenable" : "text-corrompu",
                )}
              >
                {sealed === pattern.handoff
                  ? pattern.handoff
                    ? "Le wrap a scellé. Un successeur existe."
                    : "Le wrap s'est tu. Personne n'a repris."
                  : "Divergence entre le motif et le hook."}
              </p>
              {steps.find((s) => s.proof) ? (
                <pre className="max-h-48 overflow-auto rounded-xl bg-card p-4 font-mono text-xs text-muted-foreground shadow-[var(--shadow-border)]">
                  {pretty({
                    from: steps.find((s) => s.proof)!.proof!.from,
                    to: steps.find((s) => s.proof)!.proof!.to,
                    status: steps.find((s) => s.proof)!.proof!.status,
                    parent: steps.find((s) => s.envelope)
                      ? (steps.find((s) => s.envelope)!.envelope as { command?: { graph?: unknown } })
                          .command?.graph
                      : null,
                  })}
                </pre>
              ) : null}
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              Attendu : {pattern.handoff ? "sceau" : "silence"}.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
