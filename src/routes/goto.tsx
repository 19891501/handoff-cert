import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { classify, PRESETS } from "@/lib/adopt/classify";
import { sealHandoff, type LangGraphCommand } from "@/lib/adopt/langgraph";
import { cn, pretty } from "@/lib/utils";

export const Route = createFileRoute("/goto")({ component: GotoPage });

function GotoPage() {
  const [preset, setPreset] = useState(PRESETS[0]!.id);
  const [value, setValue] = useState<unknown>(PRESETS[0]!.value);
  const [sealed, setSealed] = useState<unknown>(null);
  const verdict = useMemo(() => classify(value), [value]);

  useEffect(() => {
    let cancelled = false;
    if (!verdict.handoff) {
      setSealed(null);
      return;
    }
    void sealHandoff(
      "payment_agent",
      { order_id: "ord_9" },
      value as LangGraphCommand,
      "checkout",
    ).then((out) => {
      if (!cancelled) setSealed(out.command.update?.continuation_proof ?? null);
    });
    return () => {
      cancelled = true;
    };
  }, [value, verdict.handoff]);

  function load(id: string) {
    const p = PRESETS.find((x) => x.id === id);
    if (!p) return;
    setPreset(id);
    setValue(p.value);
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:py-12">
      <p className="text-xs font-medium uppercase tracking-[0.22em] text-subtle">
        LangGraph · Command · wrapNode
      </p>
      <h1 className="mt-2 font-display text-4xl tracking-tight">Command.goto</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
        Ce n'est pas un edge. Ce n'est pas un resume. C'est le
        transfert vers un autre nœud — le seul moment où le sceau a un destinataire.
      </p>

      <div className="mt-6 flex flex-wrap gap-2">
        {PRESETS.map((p) => (
          <Button
            key={p.id}
            variant={preset === p.id ? "default" : "outline"}
            onClick={() => load(p.id)}
          >
            {p.title}
          </Button>
        ))}
      </div>

      <div className="mt-8 overflow-hidden rounded-xl bg-card px-4 py-8 shadow-[var(--shadow-border)] sm:px-8">
        <div className="flex flex-col items-stretch gap-4 sm:flex-row sm:items-center sm:justify-center sm:gap-6">
          <NodeBox name="payment_agent" />
          <Arrow
            handoff={verdict.handoff}
            label={verdict.handoff ? `goto ${verdict.dest}` : verdict.label}
          />
          <NodeBox
            name={verdict.handoff ? verdict.dest : verdict.dest === "__end__" ? "__end__" : "—"}
            muted={!verdict.handoff}
          />
        </div>
        <p className="mt-6 text-center text-sm">
          {verdict.handoff ? (
            <span className="text-reprenable">Handoff. Le wrap scelle.</span>
          ) : (
            <span className="text-muted-foreground">Pas un handoff. Le wrap se tait.</span>
          )}
        </p>
      </div>

      <div className="mt-8 grid min-w-0 gap-6 lg:grid-cols-2">
        <article className="min-w-0 overflow-hidden rounded-xl bg-card shadow-[var(--shadow-border)]">
          <div className="border-b border-border px-4 py-3 text-xs font-medium uppercase tracking-[0.16em] text-subtle">
            Objet retourné
          </div>
          <pre className="max-h-80 overflow-auto p-4 font-mono text-xs leading-relaxed break-all text-muted-foreground sm:break-normal">
            {pretty(value)}
          </pre>
        </article>
        <article className="min-w-0 rounded-xl bg-card p-5 shadow-[var(--shadow-border)]">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={verdict.handoff ? "reprenable" : "default"}>
              {verdict.label}
            </Badge>
            {verdict.parent ? <Badge tone="partiel">PARENT</Badge> : null}
          </div>
          <p className="mt-4 text-sm text-muted-foreground">{verdict.why}</p>
          {verdict.handoff && sealed ? (
            <p className="mt-4 font-mono text-xs text-subtle">
              continuation_proof.id ·{" "}
              {typeof sealed === "object" && sealed && "id" in sealed
                ? String((sealed as { id: string }).id)
                : "…"}
            </p>
          ) : null}
          {!verdict.handoff ? (
            <p className="mt-4 font-mono text-xs text-subtle">
              continuation_proof absent
            </p>
          ) : null}
        </article>
      </div>

      <section className="mt-12 max-w-2xl">
        <h2 className="font-display text-2xl tracking-tight">Quatre champs, un seul déclenche</h2>
        <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
          <li>
            <span className="text-foreground">goto</span> — destination. Sans nœud
            successeur, il n'y a personne à qui transmettre le sceau.
          </li>
          <li>
            <span className="text-foreground">update</span> — état emporté. Hashé,
            pas recopié dans l'export.
          </li>
          <li>
            <span className="text-foreground">graph: PARENT</span> — même handoff,
            autre graphe.
          </li>
          <li>
            <span className="text-foreground">resume</span> — interrupt. Pas un
            successeur.
          </li>
        </ul>
      </section>
    </div>
  );
}

function NodeBox({ name, muted }: { name: string; muted?: boolean }) {
  return (
    <div
      className={cn(
        "flex min-h-14 min-w-0 items-center justify-center rounded-lg px-4 py-3 text-center font-mono text-xs",
        muted
          ? "bg-muted text-subtle"
          : "bg-accent text-accent-foreground",
      )}
    >
      {name}
    </div>
  );
}

function Arrow({ handoff, label }: { handoff: boolean; label: string }) {
  return (
    <div className="flex flex-col items-center gap-1 sm:min-w-40">
      <span
        className={cn(
          "font-mono text-[11px] uppercase tracking-[0.14em]",
          handoff ? "text-reprenable" : "text-subtle",
        )}
      >
        {label}
      </span>
      <div
        className={cn(
          "h-px w-16 sm:w-full",
          handoff ? "bg-reprenable" : "bg-border",
        )}
      />
    </div>
  );
}
