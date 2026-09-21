import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ATTACKS,
  RESET_PROTOCOL,
  scanKnownFalse,
  type AttackClass,
  type FalsifyRow,
} from "@/lib/bench/falsify";
import { pretty } from "@/lib/utils";

export const Route = createFileRoute("/falsify")({ component: FalsifyPage });

function FalsifyPage() {
  const [attack, setAttack] = useState<AttackClass>(ATTACKS[3]!);
  const [rows, setRows] = useState<FalsifyRow[] | null>(null);
  const [busy, setBusy] = useState(false);

  async function run() {
    setBusy(true);
    setRows(await scanKnownFalse());
    setBusy(false);
  }

  useEffect(() => {
    void run();
  }, []);

  const still = rows?.filter((r) => r.stillFalse).length ?? 0;

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:py-12">
      <p className="text-xs font-medium uppercase tracking-[0.22em] text-subtle">
        Méthode · juge gelé · publier les échecs
      </p>
      <h1 className="mt-2 font-display text-4xl tracking-tight">Falsification</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
        Un banc trophée montre que V0 s'accorde avec lui-même. Un banc
        adversarial montre où il laisse passer une machine. On publie le
        second. On ne retune pas le premier.
      </p>

      <div className="mt-6 flex flex-wrap gap-2">
        {ATTACKS.map((a) => (
          <Button
            key={a.id}
            variant={attack.id === a.id ? "default" : "outline"}
            onClick={() => setAttack(a)}
          >
            {a.title}
          </Button>
        ))}
      </div>

      <article className="mt-6 rounded-xl bg-card p-5 shadow-[var(--shadow-border)]">
        <p className="text-xs text-subtle">Contre {attack.versus}</p>
        <p className="mt-3 text-sm text-muted-foreground">{attack.method}</p>
      </article>

      <div className="mt-8 flex flex-wrap items-center gap-3">
        <Button onClick={() => void run()} disabled={busy}>
          Relancer le juge gelé
        </Button>
        {rows ? (
          <Badge tone="corrompu">
            {still} faux REPRENABLE encore là
          </Badge>
        ) : null}
      </div>

      {rows ? (
        <div className="mt-6 space-y-4">
          {rows.map((r) => (
            <article
              key={r.tag}
              className="overflow-hidden rounded-xl bg-card shadow-[var(--shadow-border)]"
            >
              <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3">
                <span className="font-mono text-xs">{r.tag}</span>
                <Badge tone="corrompu">{r.caze.id}</Badge>
                <Badge tone="default">{r.classId}</Badge>
                <Badge tone="default">
                  {r.caze.expected} → {r.actual}
                </Badge>
              </div>
              <div className="grid min-w-0 gap-4 p-4 lg:grid-cols-2">
                <div>
                  <p className="text-sm">{r.caze.title}</p>
                  <p className="mt-2 text-sm text-muted-foreground">{r.missingRule}</p>
                  <p className="mt-3 font-mono text-xs text-subtle">
                    {r.stillFalse
                      ? "Toujours faux. Le juge n'a pas été « corrigé »."
                      : "Le gel a bougé — ce tag n'est plus un faux positif."}
                  </p>
                </div>
                <pre className="max-h-48 overflow-auto font-mono text-[11px] leading-relaxed break-all text-muted-foreground sm:break-normal">
                  {pretty({
                    from: (r.caze.payload as { from?: string }).from,
                    to: (r.caze.payload as { to?: string }).to,
                    claim: (r.caze.payload as { work_done?: Array<{ claim?: string }> }).work_done?.[0]
                      ?.claim,
                  })}
                </pre>
              </div>
            </article>
          ))}
        </div>
      ) : null}

      <section className="mt-12 max-w-2xl">
        <h2 className="font-display text-2xl tracking-tight">Reset A→B</h2>
        <p className="mt-3 text-sm text-muted-foreground">{RESET_PROTOCOL.question}</p>
        <ol className="mt-4 list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
          {RESET_PROTOCOL.steps.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ol>
        <p className="mt-4 font-mono text-xs text-subtle">
          Protocole gelé. Lancé en mécanique (GATE = B). Un négatif est un livrable.
        </p>
        <p className="mt-2 text-sm text-muted-foreground">{RESET_PROTOCOL.threshold}</p>
        <p className="mt-4 flex flex-wrap gap-3">
          <Button asChild variant="outline">
            <Link to="/attaque">Attaquer CERT+GATE</Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/bounty">Bounty 1.2</Link>
          </Button>
        </p>
      </section>
    </div>
  );
}
