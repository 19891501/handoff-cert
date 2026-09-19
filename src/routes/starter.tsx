import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LANGGRAPH_END } from "@/lib/adopt/langgraph";
import {
  STARTER_PATCH,
  destOf,
  probeHandoff,
  starterPackets,
  type ProbeResult,
  type StarterKind,
  type StarterPacket,
} from "@/lib/adopt/starter";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/starter")({ component: StarterPage });

const LANES: Array<{ kind: StarterKind; title: string; hint: string }> = [
  { kind: "wrap", title: "wrapNode", hint: "observateur — jamais un juge" },
  { kind: "1.0", title: "gate 1.0", hint: "reçu gelé — B part encore à tort" },
  { kind: "1.2", title: "gate 1.2", hint: "grille payée — STOP sur CORROMPU" },
];

function StarterPage() {
  const packets = useMemo(() => starterPackets(), []);
  const [id, setId] = useState(packets[1]?.id ?? packets[0]!.id);
  const [probes, setProbes] = useState<Record<StarterKind, ProbeResult> | null>(null);
  const [busy, setBusy] = useState(false);
  const packet = packets.find((p) => p.id === id) ?? packets[0]!;

  async function run(next?: StarterPacket) {
    const row = next ?? packet;
    setBusy(true);
    const [wrap, v10, v12] = await Promise.all([
      probeHandoff(row.packet, "wrap"),
      probeHandoff(row.packet, "1.0"),
      probeHandoff(row.packet, "1.2"),
    ]);
    setProbes({ wrap, "1.0": v10, "1.2": v12 });
    setBusy(false);
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:py-12">
      <p className="text-xs font-medium uppercase tracking-[0.22em] text-subtle">
        LangGraph · starter · ruleset 1.2
      </p>
      <h1 className="mt-2 font-display text-4xl tracking-tight">Arrêter goto</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
        CORROMPU propagerait l'erreur. `gateNode` ruleset 1.2 réécrit
        `Command.goto` en `{LANGGRAPH_END}`. `wrapNode` scelle et laisse
        passer. V0 n'est pas cette grille.
      </p>

      <div className="mt-6 flex flex-wrap gap-3">
        <Button onClick={() => void run()} disabled={busy}>
          Exécuter le starter
        </Button>
        <Button asChild variant="outline">
          <Link to="/goto">Command.goto</Link>
        </Button>
      </div>

      <article className="mt-8 overflow-hidden rounded-xl bg-card shadow-[var(--shadow-border)]">
        <div className="border-b border-border px-4 py-3 text-xs font-medium uppercase tracking-[0.16em] text-subtle">
          Une ligne
        </div>
        <pre className="overflow-x-auto p-4 font-mono text-xs leading-relaxed text-muted-foreground">
          {STARTER_PATCH}
        </pre>
      </article>

      <div className="mt-6 flex flex-wrap gap-2">
        {packets.map((p) => (
          <Button
            key={p.id}
            variant={id === p.id ? "default" : "outline"}
            onClick={() => {
              setId(p.id);
              setProbes(null);
            }}
          >
            {p.id}
          </Button>
        ))}
      </div>
      <p className="mt-3 max-w-2xl text-sm text-muted-foreground">{packet.why}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        <Badge tone={packet.world === "CORROMPU" ? "corrompu" : "reprenable"}>
          monde {packet.world}
        </Badge>
        <Badge tone="default">wrap → executor</Badge>
        <Badge tone={packet.expect10 === "end" ? "corrompu" : "partiel"}>
          1.0 → {packet.expect10 === "end" ? LANGGRAPH_END : "executor"}
        </Badge>
        <Badge tone={packet.expect12 === "end" ? "corrompu" : "reprenable"}>
          1.2 → {packet.expect12 === "end" ? LANGGRAPH_END : "executor"}
        </Badge>
      </div>

      <div className="mt-8 grid min-w-0 gap-4 lg:grid-cols-3">
        {LANES.map((lane) => {
          const probe = probes?.[lane.kind];
          return (
            <Lane
              key={lane.kind}
              title={lane.title}
              hint={lane.hint}
              probe={probe}
              busy={busy}
            />
          );
        })}
      </div>

      <section className="mt-12 max-w-2xl">
        <h2 className="font-display text-2xl tracking-tight">Comment couper</h2>
        <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
          <li>
            <span className="text-foreground">ruleset: "1.2"</span> — pas le
            défaut. Sans cet argument, `gateNode` reste le reçu 1.0.
          </li>
          <li>
            <span className="text-foreground">STOP</span> — `goto` devient
            `{LANGGRAPH_END}`, `continuation_gate: "STOP"`,
            `continuation_verdict: "CORROMPU"`.
          </li>
          <li>
            <span className="text-foreground">PASS</span> — seulement
            REPRENABLE. PARTIEL coupe aussi.
          </li>
          <li>
            <span className="text-foreground">Fail-closed</span> — paquet
            absent ou 1.2 manquant : END, pas un juge inventé.
          </li>
        </ul>
        <p className="mt-6 text-sm text-muted-foreground">
          Fichiers :{" "}
          <span className="font-mono text-xs text-foreground">examples/langgraph/</span>
          . Même contrat que le banc{" "}
          <Link to="/attaque" className="underline-offset-4 hover:underline">
            Attaque
          </Link>
          .
        </p>
      </section>
    </div>
  );
}

function Lane({
  title,
  hint,
  probe,
  busy,
}: {
  title: string;
  hint: string;
  probe: ProbeResult | null | undefined;
  busy: boolean;
}) {
  const stopped = probe?.stopped ?? false;
  const dest = probe ? destOf(probe) : "executor";
  const live = Boolean(probe);
  return (
    <article className="min-w-0 overflow-hidden rounded-xl bg-card shadow-[var(--shadow-border)]">
      <div className="border-b border-border px-4 py-3">
        <p className="font-mono text-xs uppercase tracking-[0.16em] text-subtle">{title}</p>
        <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
      </div>
      <div className="flex flex-col items-center gap-3 px-4 py-6">
        <NodeBox name="planner" />
        <Arrow
          live={live}
          stopped={stopped}
          label={live ? `goto ${dest}` : busy ? "…" : "goto executor"}
        />
        <NodeBox name={live && stopped ? LANGGRAPH_END : "executor"} muted={live && stopped} />
        {probe ? (
          <div className="mt-2 flex flex-wrap justify-center gap-2">
            {probe.gate ? (
              <Badge tone={probe.stopped ? "corrompu" : "reprenable"}>{probe.gate}</Badge>
            ) : (
              <Badge>silence</Badge>
            )}
            {probe.verdict ? (
              <Badge
                tone={
                  probe.verdict === "CORROMPU"
                    ? "corrompu"
                    : probe.verdict === "REPRENABLE"
                      ? "reprenable"
                      : "partiel"
                }
              >
                {probe.verdict}
              </Badge>
            ) : null}
          </div>
        ) : (
          <p className="mt-2 text-xs text-subtle">Pas encore exécuté</p>
        )}
      </div>
    </article>
  );
}

function NodeBox({ name, muted }: { name: string; muted?: boolean }) {
  return (
    <div
      className={cn(
        "flex min-h-12 w-full max-w-48 items-center justify-center rounded-lg px-3 py-2 text-center font-mono text-xs",
        muted ? "bg-muted text-subtle" : "bg-accent text-accent-foreground",
      )}
    >
      {name}
    </div>
  );
}

function Arrow({
  live,
  stopped,
  label,
}: {
  live: boolean;
  stopped: boolean;
  label: string;
}) {
  return (
    <div className="flex flex-col items-center gap-1">
      <span
        className={cn(
          "font-mono text-[11px] uppercase tracking-[0.14em]",
          !live ? "text-subtle" : stopped ? "text-corrompu" : "text-reprenable",
        )}
      >
        {label}
      </span>
      <div
        className={cn(
          "h-px w-16",
          !live ? "bg-border" : stopped ? "bg-corrompu" : "bg-reprenable",
        )}
      />
    </div>
  );
}
