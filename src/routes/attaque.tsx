import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { runAttack, runResetAB, type AttackReport, type ResetAB } from "@/lib/bench/attack";
import { RESET_PROTOCOL } from "@/lib/bench/falsify";
import { pretty } from "@/lib/utils";

export const Route = createFileRoute("/attaque")({ component: AttaquePage });

function AttaquePage() {
  const [report, setReport] = useState<AttackReport | null>(null);
  const [reset, setReset] = useState<ResetAB | null>(null);
  const [busy, setBusy] = useState(false);

  async function run() {
    setBusy(true);
    const next = await runAttack();
    setReport(next);
    if (next.killer) setReset(await runResetAB(next.killer.attack.packet));
    else setReset(null);
    setBusy(false);
  }

  useEffect(() => {
    void run();
  }, []);

  const killed = report?.projectClaim === "tuee";

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:py-12">
      <p className="text-xs font-medium uppercase tracking-[0.22em] text-subtle">
        CERT+GATE · Reset A→B · juge gelé
      </p>
      <h1 className="mt-2 font-display text-4xl tracking-tight">Attaque</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
        Prouve que le couple empêche une reprise dangereuse — ou publie le
        contre-exemple qui tue le claim. wrapNode observe. gateNode juge. V0
        n'est pas retuné.
      </p>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <Button onClick={() => void run()} disabled={busy}>
          Relancer l'attaque
        </Button>
        {report ? (
          <Badge tone={killed ? "corrompu" : "reprenable"}>
            {killed ? "Claim tué" : "Claim tenu sur ce corpus"}
          </Badge>
        ) : null}
      </div>

      {report ? (
        <>
          <article className="mt-8 rounded-xl bg-card p-5 shadow-[var(--shadow-border)] sm:p-8">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-subtle">
              Verdict de l'expérience
            </p>
            <h2 className="mt-3 font-display text-3xl tracking-tight">
              {killed ? "Le couple ne tient pas." : "Pas de kill sur ce corpus."}
            </h2>
            <p className="mt-3 max-w-2xl text-sm text-muted-foreground">{report.sentence}</p>
            <dl className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat label="Attaques" value={String(report.n)} />
              <Stat label="Faux REPRENABLE" value={String(report.nFalseReprenable)} tone="corrompu" />
              <Stat label="Kills" value={String(report.nKills)} tone="corrompu" />
              <Stat label="Contrôles ok" value={`${report.nControlOk}/2`} />
            </dl>
          </article>

          {report.killer ? (
            <article className="mt-6 rounded-xl bg-card p-5 shadow-[var(--shadow-border)] sm:p-8">
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-subtle">
                Premier contre-exemple
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="font-mono text-sm">{report.killer.attack.id}</span>
                <Badge tone="corrompu">kill</Badge>
                <Badge tone="default">{report.killer.attack.vector}</Badge>
              </div>
              <h3 className="mt-3 font-display text-2xl tracking-tight">
                {report.killer.attack.title}
              </h3>
              <p className="mt-3 text-sm text-muted-foreground">{report.killer.attack.why}</p>
              <p className="mt-4 text-sm">
                Monde {report.killer.attack.world} → V0 {report.killer.gate.verdict} → grille{" "}
                <span className="font-medium">{report.killer.gate.decision}</span>
                {" · "}
                wrapNode continue toujours.
              </p>
              {reset ? (
                <p className="mt-2 font-mono text-xs text-subtle">
                  Reset A→B ({reset.kind}) · historique {reset.history} · B continue ={" "}
                  {String(reset.b_continues)}
                </p>
              ) : null}
              <pre className="mt-4 max-h-56 overflow-auto font-mono text-[11px] leading-relaxed text-muted-foreground">
                {pretty({
                  from: (report.killer.attack.packet as { from?: string }).from,
                  to: (report.killer.attack.packet as { to?: string }).to,
                  claim: (
                    report.killer.attack.packet as {
                      work_done?: Array<{ claim?: string }>;
                    }
                  ).work_done?.[0]?.claim,
                  gate: report.killer.gate.decision,
                  certificate_id: report.killer.gate.certificate.certificate_id,
                })}
              </pre>
            </article>
          ) : null}

          <section className="mt-10">
            <h2 className="font-display text-2xl tracking-tight">Scoreboard</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Faux REPRENABLE = le monde n'autorise pas, la grille laisse B partir.
              Kill = le monde est CORROMPU et B part quand même.
            </p>
            <div className="mt-6 space-y-3">
              {report.rows.map((r) => (
                <article
                  key={r.attack.id}
                  className="rounded-xl bg-card px-4 py-4 shadow-[var(--shadow-border)] sm:px-5"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs">{r.attack.id}</span>
                    <Badge tone={r.kills ? "corrompu" : r.falseReprenable ? "partiel" : "default"}>
                      {r.kills ? "kill" : r.falseReprenable ? "faux R" : r.attack.danger}
                    </Badge>
                    <Badge tone={r.gate.decision === "PASS" ? "reprenable" : "corrompu"}>
                      GATE {r.gate.decision}
                    </Badge>
                    <Badge tone="default">
                      {r.attack.world} → {r.gate.verdict}
                    </Badge>
                  </div>
                  <p className="mt-2 text-sm">{r.attack.title}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{r.attack.why}</p>
                </article>
              ))}
            </div>
          </section>

          <section className="mt-12 max-w-2xl">
            <h2 className="font-display text-2xl tracking-tight">Reset A→B</h2>
            <p className="mt-3 text-sm text-muted-foreground">{RESET_PROTOCOL.question}</p>
            <ol className="mt-4 list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
              {RESET_PROTOCOL.steps.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ol>
            <p className="mt-4 font-mono text-xs text-subtle">
              Protocole {RESET_PROTOCOL.kind}. Lancé. B n'est pas un LLM — c'est la
              permission de reprendre. Un kill est un livrable.
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              wrapNode n'arrête rien. C'est l'observateur. Le couple attaqué est
              certify() + gateResume().{" "}
              <Link to="/falsify" className="underline-offset-4 hover:underline">
                Dossier KFP
              </Link>
              .
            </p>
          </section>
        </>
      ) : null}
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "corrompu";
}) {
  return (
    <div className="rounded-lg bg-background/60 px-3 py-3">
      <dt className="text-[11px] font-medium uppercase tracking-[0.16em] text-subtle">{label}</dt>
      <dd className={`mt-1 font-display text-2xl tracking-tight ${tone === "corrompu" ? "text-corrompu" : ""}`}>
        {value}
      </dd>
    </div>
  );
}
