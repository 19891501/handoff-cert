import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  runAttack,
  runAttack11,
  runResetAB,
  type AttackReport,
  type ResetAB,
} from "@/lib/bench/attack";
import * as attackBench from "@/lib/bench/attack";
import { RESET_PROTOCOL } from "@/lib/bench/falsify";
import { pretty } from "@/lib/utils";

export const Route = createFileRoute("/attaque")({ component: AttaquePage });

function getRunAttack11(): (() => Promise<AttackReport>) | null {
  return runAttack11;
}

function getRunAttack12(): (() => Promise<AttackReport>) | null {
  const fn = (attackBench as { runAttack12?: unknown }).runAttack12;
  return typeof fn === "function" ? (fn as () => Promise<AttackReport>) : null;
}

const RUN_ATTACK_11 = getRunAttack11();
const RUN_ATTACK_12 = getRunAttack12();

function AttaquePage() {
  const [report, setReport] = useState<AttackReport | null>(null);
  const [report11, setReport11] = useState<AttackReport | null>(null);
  const [report12, setReport12] = useState<AttackReport | null>(null);
  const [error11, setError11] = useState(false);
  const [error12, setError12] = useState(false);
  const [reset, setReset] = useState<ResetAB | null>(null);
  const [busy, setBusy] = useState(false);

  async function run() {
    setBusy(true);
    setError11(false);
    setError12(false);
    const next = await runAttack();
    setReport(next);
    if (next.killer) setReset(await runResetAB(next.killer.attack.packet));
    else setReset(null);

    if (RUN_ATTACK_11) {
      try {
        setReport11(await RUN_ATTACK_11());
      } catch {
        setReport11(null);
        setError11(true);
      }
    } else {
      setReport11(null);
    }

    if (RUN_ATTACK_12) {
      try {
        setReport12(await RUN_ATTACK_12());
      } catch {
        setReport12(null);
        setError12(true);
      }
    } else {
      setReport12(null);
    }
    setBusy(false);
  }

  useEffect(() => {
    void run();
  }, []);

  const killed = report?.projectClaim === "tuee";
  const has11 = Boolean(RUN_ATTACK_11);
  const has12 = Boolean(RUN_ATTACK_12);
  const extraNotaries = Number(has11) + Number(has12);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:py-12">
      <p className="text-xs font-medium uppercase tracking-[0.22em] text-subtle">
        {has12
          ? "CERT+GATE · trois notaires · V0 gelé"
          : has11
            ? "CERT+GATE · deux notaires · V0 gelé"
            : "CERT+GATE · Reset A→B · juge gelé"}
      </p>
      <h1 className="mt-2 font-display text-4xl tracking-tight">Attaque</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
        {has12
          ? "Trois notaires, même corpus. V0 / GATE 1.0 : claim tué. 1.1 et 1.2 ne sont pas un patch du gel. KFP-001 reste ouvert sur 1.0."
          : has11
            ? "Deux notaires, même corpus. V0 / GATE 1.0 : claim tué. 1.1 n'est pas un patch du gel. KFP-001 reste ouvert sur 1.0."
            : "Prouve que le couple empêche une reprise dangereuse — ou publie le contre-exemple qui tue le claim. wrapNode observe. gateNode juge. V0 n'est pas retuné."}
      </p>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <Button onClick={() => void run()} disabled={busy}>
          Relancer l'attaque
        </Button>
        {report ? (
          <Badge tone={killed ? "corrompu" : "reprenable"}>
            {has11 || has12
              ? killed
                ? "V0 : claim tué"
                : "V0 : claim tenu sur ce corpus"
              : killed
                ? "Claim tué"
                : "Claim tenu sur ce corpus"}
          </Badge>
        ) : null}
        {has11 && report11 ? (
          <Badge tone={report11.projectClaim === "tuee" ? "corrompu" : "partiel"}>
            {report11.projectClaim === "tuee"
              ? "1.1 : claim tué"
              : "1.1 : tenu sur ce corpus"}
          </Badge>
        ) : null}
        {has12 && report12 ? (
          <Badge tone={report12.projectClaim === "tuee" ? "corrompu" : "partiel"}>
            {report12.projectClaim === "tuee"
              ? "1.2 : claim tué"
              : "1.2 : tenu sur ce corpus"}
          </Badge>
        ) : null}
      </div>

      {(report || has11 || has12) ? (
        <>
          <div
            className={
              extraNotaries > 1
                ? "mt-8 grid gap-4 lg:grid-cols-3"
                : extraNotaries === 1
                  ? "mt-8 grid gap-4 lg:grid-cols-2"
                  : "mt-8"
            }
          >
            {report ? (
              <NotaryCard
                eyebrow={has11 || has12 ? "V0 / GATE 1.0" : "Verdict de l'expérience"}
                heading={killed ? "Le couple ne tient pas." : "Pas de kill sur ce corpus."}
                body={
                  has11 || has12
                    ? `${report.sentence} KFP-001 n'est pas fermé sur 1.0.`
                    : report.sentence
                }
                report={report}
              />
            ) : (
              <article className="rounded-xl bg-card p-5 shadow-[var(--shadow-border)] sm:p-8">
                <p className="text-xs font-medium uppercase tracking-[0.18em] text-subtle">
                  {has11 || has12 ? "V0 / GATE 1.0" : "Verdict de l'expérience"}
                </p>
                <p className="mt-4 font-mono text-xs text-subtle">Banc 1.0 en cours.</p>
              </article>
            )}
            {has11 ? (
              report11 ? (
                <NotaryCard
                  eyebrow="Ruleset 1.1 (autre notaire)"
                  heading={
                    report11.projectClaim === "tuee"
                      ? "Le notaire 1.1 ne tient pas non plus."
                      : "Pas de kill 1.1 sur ce corpus."
                  }
                  body={
                    report11.projectClaim === "tuee"
                      ? `${report11.sentence} Cela ne réécrit pas V0.`
                      : `${report11.sentence} Cela ne ferme pas KFP-001 sur V0.`
                  }
                  report={report11}
                />
              ) : (
                <article className="rounded-xl bg-card p-5 shadow-[var(--shadow-border)] sm:p-8">
                  <p className="text-xs font-medium uppercase tracking-[0.18em] text-subtle">
                    Ruleset 1.1 (autre notaire)
                  </p>
                  <p className="mt-4 font-mono text-xs text-subtle">
                    {error11
                      ? "Banc 1.1 illisible. Aucun chiffre inventé."
                      : "Banc 1.1 en cours."}
                  </p>
                </article>
              )
            ) : null}
            {has12 ? (
              report12 ? (
                <NotaryCard
                  eyebrow="1.2 autre notaire"
                  heading={
                    report12.projectClaim === "tuee"
                      ? "Le notaire 1.2 ne tient pas non plus."
                      : "Pas de kill 1.2 sur ce corpus."
                  }
                  body={
                    report12.projectClaim === "tuee"
                      ? `${report12.sentence} Cela ne réécrit pas V0.`
                      : `${report12.sentence} Cela ne ferme pas KFP-001 sur V0.`
                  }
                  report={report12}
                />
              ) : (
                <article className="rounded-xl bg-card p-5 shadow-[var(--shadow-border)] sm:p-8">
                  <p className="text-xs font-medium uppercase tracking-[0.18em] text-subtle">
                    1.2 autre notaire
                  </p>
                  <p className="mt-4 font-mono text-xs text-subtle">
                    {error12
                      ? "Banc 1.2 illisible. Aucun chiffre inventé."
                      : "Banc 1.2 en cours."}
                  </p>
                </article>
              )
            ) : null}
          </div>

          {report?.killer ? (
            <article className="mt-6 rounded-xl bg-card p-5 shadow-[var(--shadow-border)] sm:p-8">
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-subtle">
                {has11 || has12 ? "Premier contre-exemple · V0" : "Premier contre-exemple"}
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="font-mono text-sm">{report.killer.attack.id}</span>
                <Badge tone="corrompu">kill</Badge>
                <Badge tone="default">{report.killer.attack.vector}</Badge>
                {has11 || has12 ? <Badge tone="corrompu">ouvert sur 1.0</Badge> : null}
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

          {has11 || has12 ? (
            <div
              className={
                has11 && has12
                  ? "mt-10 grid gap-10 lg:grid-cols-3"
                  : "mt-10 grid gap-10 lg:grid-cols-2"
              }
            >
              {report ? (
                <Scoreboard
                  title="Scoreboard V0 / GATE 1.0"
                  blurb="Faux REPRENABLE = le monde n'autorise pas, la grille laisse B partir. Kill = le monde est CORROMPU et B part quand même. Claim tué."
                  report={report}
                />
              ) : (
                <section>
                  <h2 className="font-display text-2xl tracking-tight">
                    Scoreboard V0 / GATE 1.0
                  </h2>
                  <p className="mt-2 font-mono text-xs text-subtle">Banc 1.0 en cours.</p>
                </section>
              )}
              {has11 ? (
                report11 ? (
                  <Scoreboard
                    title="Scoreboard ruleset 1.1"
                    blurb="Autre notaire, même attaques. Un score 1.1 ne ferme pas KFP-001 sur V0."
                    report={report11}
                  />
                ) : (
                  <section>
                    <h2 className="font-display text-2xl tracking-tight">Scoreboard ruleset 1.1</h2>
                    <p className="mt-2 font-mono text-xs text-subtle">
                      {error11
                        ? "Banc 1.1 illisible. Aucun chiffre inventé."
                        : "Banc 1.1 en cours."}
                    </p>
                  </section>
                )
              ) : null}
              {has12 ? (
                report12 ? (
                  <Scoreboard
                    title="Scoreboard 1.2 autre notaire"
                    blurb="Autre notaire, même attaques. Un score 1.2 ne ferme pas KFP-001 sur V0."
                    report={report12}
                  />
                ) : (
                  <section>
                    <h2 className="font-display text-2xl tracking-tight">
                      Scoreboard 1.2 autre notaire
                    </h2>
                    <p className="mt-2 font-mono text-xs text-subtle">
                      {error12
                        ? "Banc 1.2 illisible. Aucun chiffre inventé."
                        : "Banc 1.2 en cours."}
                    </p>
                  </section>
                )
              ) : null}
            </div>
          ) : report ? (
            <Scoreboard
              title="Scoreboard"
              blurb="Faux REPRENABLE = le monde n'autorise pas, la grille laisse B partir. Kill = le monde est CORROMPU et B part quand même."
              report={report}
              className="mt-10"
            />
          ) : null}

          {report ? (
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
          ) : null}
        </>
      ) : null}
    </div>
  );
}

function NotaryCard({
  eyebrow,
  heading,
  body,
  report,
}: {
  eyebrow: string;
  heading: string;
  body: string;
  report: AttackReport;
}) {
  return (
    <article className="rounded-xl bg-card p-5 shadow-[var(--shadow-border)] sm:p-8">
      <p className="text-xs font-medium uppercase tracking-[0.18em] text-subtle">
        {eyebrow}
      </p>
      <h2 className="mt-3 font-display text-3xl tracking-tight">{heading}</h2>
      <p className="mt-3 max-w-2xl text-sm text-muted-foreground">{body}</p>
      <dl className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Attaques" value={String(report.n)} />
        <Stat
          label="Faux REPRENABLE"
          value={String(report.nFalseReprenable)}
          tone={report.nFalseReprenable > 0 ? "corrompu" : undefined}
        />
        <Stat
          label="Kills"
          value={String(report.nKills)}
          tone={report.nKills > 0 ? "corrompu" : undefined}
        />
        <Stat label="Contrôles ok" value={`${report.nControlOk}/2`} />
      </dl>
    </article>
  );
}

function Scoreboard({
  title,
  blurb,
  report,
  className,
}: {
  title: string;
  blurb: string;
  report: AttackReport;
  className?: string;
}) {
  return (
    <section className={className}>
      <h2 className="font-display text-2xl tracking-tight">{title}</h2>
      <p className="mt-2 text-sm text-muted-foreground">{blurb}</p>
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
