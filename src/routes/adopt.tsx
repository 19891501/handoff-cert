import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { adopt, verifyIncoming, type AdoptResult } from "@/lib/adopt/hook";
import { EVENTS, HOSTS, STACK, UNKNOWN_EVENT, tamper as tamperEvent, type HostId } from "@/lib/adopt/hosts";
import { checkoutGraph, runGraph, type GraphStep } from "@/lib/adopt/langgraph";
import { cn, pretty } from "@/lib/utils";

export const Route = createFileRoute("/adopt")({ component: AdoptPage });

type HostKey = Exclude<HostId, "unknown">;

function AdoptPage() {
  const [host, setHost] = useState<HostKey>("langgraph");
  const [result, setResult] = useState<AdoptResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [tamper, setTamper] = useState<"MATCH" | "MISMATCH" | null>(null);
  const [refused, setRefused] = useState<AdoptResult | null>(null);
  const [steps, setSteps] = useState<GraphStep[] | null>(null);

  const spec = HOSTS.find((h) => h.id === host)!;
  const event = EVENTS[host];
  const patchLines = useMemo(() => spec.patch.split("\n"), [spec]);
  const langgraph = host === "langgraph";

  function envelopeOf(): unknown {
    return steps?.find((s) => s.envelope)?.envelope ?? event;
  }

  function reset() {
    setResult(null);
    setTamper(null);
    setRefused(null);
    setSteps(null);
  }

  async function branch() {
    setBusy(true);
    reset();
    if (langgraph) {
      const run = await runGraph(checkoutGraph());
      setSteps(run.steps);
      const sealed = run.steps.find((s) => s.proof);
      if (sealed?.proof) {
        setResult({ ok: true, host: "langgraph", proof: sealed.proof });
      }
      setBusy(false);
      return;
    }
    const next = await adopt(event);
    setResult(next);
    setBusy(false);
  }

  async function refuseUnknown() {
    setBusy(true);
    setResult(null);
    setTamper(null);
    setSteps(null);
    setRefused(await adopt(UNKNOWN_EVENT));
    setBusy(false);
  }

  async function receive(altered: boolean) {
    if (!result || !result.ok) return;
    setBusy(true);
    const incoming = altered
      ? tamperEvent(host, envelopeOf())
      : envelopeOf();
    const v = await verifyIncoming(result.proof, incoming);
    setTamper(v);
    setBusy(false);
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:py-12">
      <p className="text-xs font-medium uppercase tracking-[0.22em] text-subtle">
        Adoption · wrapNode · Command.goto
      </p>
      <h1 className="mt-2 font-display text-4xl tracking-tight">Adopter</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
        LangGraph n'a pas de callback after-node. Le handoff, c'est
        `Command.goto`. On enveloppe le nœud. Sans goto, le hook se tait.
      </p>

      <div className="mt-8 overflow-hidden rounded-xl bg-card p-5 shadow-[var(--shadow-border)]">
        <p className="text-xs font-medium uppercase tracking-[0.16em] text-subtle">
          Déjà là
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {STACK.map((name) => (
            <span
              key={name}
              className="rounded-md bg-muted px-2.5 py-1.5 text-xs text-muted-foreground"
            >
              {name}
            </span>
          ))}
          <span className="rounded-md bg-accent px-2.5 py-1.5 text-xs text-accent-foreground">
            wrapNode
          </span>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        {HOSTS.map((h) => (
          <Button
            key={h.id}
            variant={host === h.id ? "default" : "outline"}
            onClick={() => {
              setHost(h.id);
              reset();
            }}
          >
            {h.label}
          </Button>
        ))}
      </div>
      <p className="mt-3 text-sm text-muted-foreground">
        {spec.already}. On ajoute {spec.added}{" "}
        {spec.added === 1 ? "ligne de wrap" : "lignes"}.
      </p>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <div className="min-w-0 space-y-4">
          <article className="overflow-hidden rounded-xl bg-card shadow-[var(--shadow-border)]">
            <div className="border-b border-border px-4 py-3 text-xs font-medium uppercase tracking-[0.16em] text-subtle">
              Hook
            </div>
            <pre className="overflow-x-auto p-4 font-mono text-xs leading-relaxed break-all text-muted-foreground sm:break-normal">
              {patchLines.map((line, i) => (
                <span key={i} className="block">
                  {line || " "}
                </span>
              ))}
            </pre>
          </article>
          <article className="overflow-hidden rounded-xl bg-card shadow-[var(--shadow-border)]">
            <div className="border-b border-border px-4 py-3 text-xs font-medium uppercase tracking-[0.16em] text-subtle">
              {langgraph ? "Nœud d'origine" : "Événement déjà émis"}
            </div>
            <pre className="max-h-64 overflow-auto p-4 font-mono text-xs leading-relaxed text-muted-foreground">
              {langgraph
                ? pretty({
                    node: "payment_agent",
                    returns: {
                      update: { charged: true, payment: { status: "succeeded", charge_id: "ch_1" } },
                      goto: "fulfillment_agent",
                    },
                  })
                : pretty(event)}
            </pre>
          </article>
        </div>

        <div className="min-w-0 space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button onClick={branch} disabled={busy}>
              {langgraph ? "Exécuter le graphe" : "Brancher le sceau"}
            </Button>
            <Button variant="outline" onClick={refuseUnknown} disabled={busy}>
              Enveloppe inconnue
            </Button>
          </div>

          {steps ? (
            <ol className="space-y-2">
              {steps.map((step) => (
                <li
                  key={`${step.node}-${step.goto}`}
                  className="flex min-h-11 items-center justify-between gap-3 rounded-xl bg-card px-4 py-3 text-sm shadow-[var(--shadow-border)]"
                >
                  <span className="font-mono text-xs">
                    {step.node} → {step.goto ?? "∅"}
                  </span>
                  {step.sealed ? (
                    <Badge tone="reprenable">sceau</Badge>
                  ) : (
                    <Badge tone="default">silencieux</Badge>
                  )}
                </li>
              ))}
            </ol>
          ) : null}

          {result?.ok ? (
            <>
              <article className="rounded-xl bg-card p-5 shadow-[var(--shadow-border)]">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone="default">{result.host}</Badge>
                  <Badge tone="partiel">{result.proof.status}</Badge>
                  <span className="font-mono text-xs text-subtle">{result.proof.id}</span>
                </div>
                <p className="mt-3 text-sm text-muted-foreground">
                  {result.proof.from} → {result.proof.to}. UNKNOWN : le wrap n'est
                  pas un juge. fulfillment_agent n'a pas de goto, donc pas de sceau.
                </p>
                <p className="mt-2 font-mono text-xs text-subtle">
                  {result.proof.committed.payload_hash.slice(0, 22)}…
                </p>
              </article>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={() => receive(false)} disabled={busy}>
                  B reçoit l'identique
                </Button>
                <Button variant="outline" onClick={() => receive(true)} disabled={busy}>
                  B reçoit une copie altérée
                </Button>
              </div>
              {tamper ? (
                <p
                  className={cn(
                    "text-sm",
                    tamper === "MATCH" ? "text-reprenable" : "text-corrompu",
                  )}
                >
                  {tamper === "MATCH"
                    ? "MATCH — l'empreinte reçue est celle engagée."
                    : "MISMATCH — divergence après l'engagement."}
                </p>
              ) : null}
              <pre className="max-h-56 overflow-auto rounded-xl bg-card p-4 font-mono text-xs leading-relaxed text-muted-foreground shadow-[var(--shadow-border)]">
                {pretty(result.proof)}
              </pre>
            </>
          ) : null}

          {refused && !refused.ok ? (
            <article className="rounded-xl bg-card p-5 shadow-[var(--shadow-border)]">
              <Badge tone="corrompu">refus</Badge>
              <p className="mt-3 text-sm text-muted-foreground">{refused.reason}</p>
              <pre className="mt-3 font-mono text-xs text-subtle">{pretty(UNKNOWN_EVENT)}</pre>
            </article>
          ) : null}

          {!result && !refused && !steps ? (
            <p className="text-sm text-muted-foreground">
              Un edge statique n'est pas un handoff. `Command.resume` non plus.
              Seul `goto` vers un autre nœud déclenche le sceau.
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
