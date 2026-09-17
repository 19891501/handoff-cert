import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ENGINE_FIXTURES,
  PIPELINE,
  reductionOf,
  traceEngine,
} from "@/lib/bench/engine-trace";
import { RULESET_VERSION } from "@/lib/handoff/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/rules")({ component: RulesPage });

function RulesPage() {
  const [id, setId] = useState(ENGINE_FIXTURES[0]!.id);
  const fixture = ENGINE_FIXTURES.find((f) => f.id === id)!;
  const trace = useMemo(
    () => traceEngine(fixture.payload, fixture.expected),
    [fixture],
  );

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:py-12">
      <p className="text-xs font-medium uppercase tracking-[0.22em] text-subtle">
        Ruleset {RULESET_VERSION} · gelé · fail-closed
      </p>
      <h1 className="mt-2 font-display text-4xl tracking-tight">Moteur</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
        Trois étapes. Les warnings ne changent pas le verdict. Pas de LLM. Un
        finding critical manquant (KFP-001) est le trou, pas un réglage à faire.
      </p>

      <ol className="mt-8 grid gap-3 sm:grid-cols-3">
        {PIPELINE.map((step, i) => (
          <li key={step.id} className="rounded-xl bg-card p-4 shadow-[var(--shadow-border)]">
            <p className="font-mono text-xs text-subtle">0{i + 1}</p>
            <p className="mt-2 font-display text-xl tracking-tight">{step.title}</p>
            <p className="mt-1 text-sm text-muted-foreground">{step.body}</p>
          </li>
        ))}
      </ol>

      <div className="mt-8 flex flex-wrap gap-2">
        {ENGINE_FIXTURES.map((f) => (
          <Button
            key={f.id}
            variant={id === f.id ? "default" : "outline"}
            onClick={() => setId(f.id)}
          >
            {f.title}
          </Button>
        ))}
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <Badge tone={trace.falseSafe ? "corrompu" : trace.verdict === "CORROMPU" ? "corrompu" : trace.verdict === "PARTIEL" ? "partiel" : "reprenable"}>
          {trace.verdict}
        </Badge>
        <span className="font-mono text-xs text-subtle">{reductionOf(trace.findings)}</span>
        {trace.falseSafe ? (
          <Badge tone="corrompu">faux REPRENABLE</Badge>
        ) : null}
      </div>

      <div className="mt-6 overflow-hidden rounded-xl bg-card shadow-[var(--shadow-border)]">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border text-xs uppercase tracking-[0.14em] text-subtle">
              <th className="px-4 py-3 font-medium">Code</th>
              <th className="px-4 py-3 font-medium">Sévérité</th>
              <th className="px-4 py-3 font-medium">Chemin</th>
            </tr>
          </thead>
          <tbody>
            {trace.findings.length === 0 ? (
              <tr>
                <td className="px-4 py-3 text-muted-foreground" colSpan={3}>
                  Aucun finding. Le juge rend REPRENABLE.
                </td>
              </tr>
            ) : (
              trace.findings.map((f, i) => (
                <tr key={`${f.code}-${i}`} className="border-b border-border last:border-0">
                  <td className="px-4 py-3 font-mono text-xs">{f.code}</td>
                  <td
                    className={cn(
                      "px-4 py-3 font-mono text-xs",
                      f.severity === "critical" && "text-corrompu",
                      f.severity === "error" && "text-partiel",
                    )}
                  >
                    {f.severity}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                    {f.path ?? "—"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {trace.findings[0] ? (
        <p className="mt-4 max-w-2xl text-sm text-muted-foreground">{trace.findings[0].message}</p>
      ) : null}

      <p className="mt-10 max-w-2xl text-sm text-muted-foreground">
        CLAIM ≠ EVIDENCE n'est implémenté que si un token FAIL croise une
        claim de succès. Un booléen qui nie n'émet pas de critical. Le
        moteur le montre. On ne le patch pas.
      </p>
    </div>
  );
}
