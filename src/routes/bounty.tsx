import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  BOUNTY,
  BOUNTY_REFUSED,
  BOUNTY_RULES,
  BOUNTY_SUBMIT,
  STARTER_PACKET,
  corpusFalse12,
  probeBounty,
  type BountyProbe,
} from "@/lib/offer/bounty";
import { KNOWN_FALSE } from "@/lib/bench/falsify";
import { runAttack12, type AttackReport } from "@/lib/bench/attack";
import { CORPUS_CASES } from "@/lib/handoff/corpus";
import { GATE_SKU } from "@/lib/offer/mission";
import { pretty } from "@/lib/utils";
import type { Verdict } from "@/lib/handoff/types";

export const Route = createFileRoute("/bounty")({ component: BountyPage });

const WORLDS: Verdict[] = ["CORROMPU", "PARTIEL", "REPRENABLE"];

function lockedPacket(tag: string): unknown | null {
  const k = KNOWN_FALSE.find((x) => x.tag === tag);
  if (!k) return null;
  return CORPUS_CASES.find((c) => c.id === k.id)?.payload ?? null;
}

function BountyPage() {
  const [text, setText] = useState(pretty(STARTER_PACKET));
  const [world, setWorld] = useState<Verdict>("CORROMPU");
  const [preset, setPreset] = useState("starter");
  const [probe, setProbe] = useState<BountyProbe | null>(null);
  const [report12, setReport12] = useState<AttackReport | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const parsed = useMemo(() => {
    try {
      return { ok: true as const, value: JSON.parse(text) as unknown };
    } catch (e) {
      return {
        ok: false as const,
        error: e instanceof Error ? e.message : "JSON invalide",
      };
    }
  }, [text]);

  useEffect(() => {
    void runAttack12().then(setReport12);
  }, []);

  async function runProbe(packet: unknown, declared: Verdict) {
    setBusy(true);
    setErr(null);
    try {
      setProbe(await probeBounty(packet, declared));
    } catch (e) {
      setErr(e instanceof Error ? e.message : "probe impossible");
      setProbe(null);
    } finally {
      setBusy(false);
    }
  }

  function loadLocked(tag: string) {
    const packet = lockedPacket(tag);
    if (!packet) return;
    setPreset(tag);
    setWorld("CORROMPU");
    setText(pretty(packet));
    void runProbe(packet, "CORROMPU");
  }

  function loadStarter() {
    setPreset("starter");
    setWorld("CORROMPU");
    setText(pretty(STARTER_PACKET));
    setProbe(null);
  }

  const faux12 = report12?.nFalseReprenable ?? corpusFalse12();

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:py-12">
      <p className="text-xs font-medium uppercase tracking-[0.22em] text-subtle">
        Bounty · {BOUNTY.target.ruleset} · pas de cash tant que ce n'est pas réel
      </p>
      <h1 className="mt-2 font-display text-4xl tracking-tight sm:text-5xl">
        {BOUNTY.name}
      </h1>
      <p className="mt-3 max-w-2xl text-base text-muted-foreground">
        Un nouveau KFP si 1.2 PASSe encore. Monde CORROMPU, grille PASS, B
        partirait. Les quatre lockés ne paient pas : 1.2 les STOP déjà.
      </p>

      <article className="mt-8 rounded-xl bg-card p-5 shadow-[var(--shadow-border)] sm:p-8">
        <div className="flex flex-wrap gap-2">
          <Badge tone="partiel">{BOUNTY.billing}</Badge>
          <Badge tone="corrompu">Cash : non</Badge>
          <Badge tone="default">Jusqu'à réel</Badge>
        </div>
        <h2 className="mt-4 font-display text-3xl tracking-tight">
          Pas de virement. L'IOU n'est pas de l'argent.
        </h2>
        <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
          {BOUNTY.why_no_cash} Versé = {BOUNTY.paid_out_eur} €. Clients
          payants = {BOUNTY.paying_customers}. SKU {BOUNTY.sku} encaisse en
          preview seulement.
        </p>
      </article>

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        <article className="rounded-xl bg-card p-5 shadow-[var(--shadow-border)]">
          <p className="text-xs uppercase tracking-[0.16em] text-subtle">
            Nouvelle classe
          </p>
          <p className="mt-2 font-display text-4xl tracking-tight">
            {BOUNTY.payout_class_eur}&nbsp;€
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            missingRule distinct. IOU. Cash = 0.
          </p>
        </article>
        <article className="rounded-xl bg-card p-5 shadow-[var(--shadow-border)]">
          <p className="text-xs uppercase tracking-[0.16em] text-subtle">
            Nouvelle instance
          </p>
          <p className="mt-2 font-display text-4xl tracking-tight">
            {BOUNTY.payout_instance_eur}&nbsp;€
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Autre paquet, même dette, 1.2 PASS encore.
          </p>
        </article>
        <article className="rounded-xl bg-card p-5 shadow-[var(--shadow-border)]">
          <p className="text-xs uppercase tracking-[0.16em] text-subtle">
            Faux REPRENABLE 1.2
          </p>
          <p className="mt-2 font-display text-4xl tracking-tight">{faux12}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Sur le corpus actuel. Cible : un de plus.
          </p>
        </article>
      </div>

      <section className="mt-10 grid gap-4 lg:grid-cols-2">
        <article className="rounded-xl bg-card p-5 shadow-[var(--shadow-border)] sm:p-8">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-subtle">
            Ce qui paie
          </p>
          <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm text-muted-foreground">
            {BOUNTY_RULES.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ol>
        </article>
        <article className="rounded-xl bg-card p-5 shadow-[var(--shadow-border)] sm:p-8">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-subtle">
            Ce qui ne paie pas
          </p>
          <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
            {BOUNTY_REFUSED.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </article>
      </section>

      <section className="mt-10">
        <h2 className="font-display text-2xl tracking-tight">Lockés — déjà STOP 1.2</h2>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Quatre dettes V0. La grille payée les refuse. Les resoumettre ne
          déclenche pas l'IOU.
        </p>
        <div className="mt-6 space-y-3">
          {KNOWN_FALSE.map((k) => (
            <article
              key={k.tag}
              className="rounded-xl bg-card px-4 py-4 shadow-[var(--shadow-border)] sm:px-5"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-xs">{k.tag}</span>
                <Badge tone="corrompu">exclu</Badge>
                <Badge tone="default">{k.classId}</Badge>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">{k.missingRule}</p>
            </article>
          ))}
        </div>
      </section>

      {report12 ? (
        <section className="mt-10">
          <h2 className="font-display text-2xl tracking-tight">
            Scoreboard {GATE_SKU.ruleset}
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {report12.nKills} kill · {report12.nFalseReprenable} faux REPRENABLE
            · {report12.n} attaques. Un bounty est un kill 1.2 qui n'est pas
            encore là.
          </p>
          <div className="mt-6 space-y-3">
            {report12.rows.map((r) => (
              <article
                key={r.attack.id}
                className="rounded-xl bg-card px-4 py-4 shadow-[var(--shadow-border)] sm:px-5"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs">{r.attack.id}</span>
                  <Badge
                    tone={
                      r.kills ? "corrompu" : r.falseReprenable ? "partiel" : "default"
                    }
                  >
                    {r.kills ? "kill" : r.falseReprenable ? "faux R" : r.attack.danger}
                  </Badge>
                  <Badge tone={r.gate.decision === "PASS" ? "reprenable" : "corrompu"}>
                    GATE {r.gate.decision}
                  </Badge>
                </div>
                <p className="mt-2 text-sm">{r.attack.title}</p>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <section className="mt-12">
        <h2 className="font-display text-2xl tracking-tight">Éprouver 1.2</h2>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Collez un paquet. Déclarez le monde. La machine dit si 1.2 PASSe.
          Elle ne verse rien.
        </p>
        <div className="mt-6 flex flex-wrap gap-2">
          <Button
            variant={preset === "starter" ? "default" : "outline"}
            onClick={loadStarter}
          >
            Modèle
          </Button>
          {BOUNTY.target.excludes.map((tag) => (
            <Button
              key={tag}
              variant={preset === tag ? "default" : "outline"}
              onClick={() => loadLocked(tag)}
            >
              {tag}
            </Button>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {WORLDS.map((w) => (
            <Button
              key={w}
              variant={world === w ? "default" : "outline"}
              onClick={() => setWorld(w)}
            >
              Monde {w}
            </Button>
          ))}
        </div>
        <textarea
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setErr(null);
          }}
          spellCheck={false}
          className="mt-4 min-h-64 w-full rounded-xl bg-card p-4 font-mono text-xs leading-relaxed text-foreground shadow-[var(--shadow-border)] outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
          aria-label="Paquet JSON"
        />
        {!parsed.ok ? (
          <p className="mt-2 text-sm text-corrompu">{parsed.error}</p>
        ) : null}
        <div className="mt-3 flex flex-wrap gap-3">
          <Button
            disabled={busy || !parsed.ok}
            onClick={() => parsed.ok && void runProbe(parsed.value, world)}
          >
            {busy ? "Juge…" : "Éprouver 1.2"}
          </Button>
          {err ? <p className="self-center text-sm text-corrompu">{err}</p> : null}
        </div>
        {probe ? <ProbeCard probe={probe} /> : null}
      </section>

      <section className="mt-14 border-t border-border pt-10">
        <h2 className="font-display text-2xl tracking-tight">Soumettre</h2>
        <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
          {BOUNTY_SUBMIT.via} sur {BOUNTY_SUBMIT.repo}.{" "}
          {BOUNTY_SUBMIT.files.join(" · ")}. {BOUNTY_SUBMIT.note}
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Button asChild variant="outline">
            <Link to="/falsify">Dossier KFP</Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/attaque">Banc 1.2</Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/offre">SKU grille</Link>
          </Button>
        </div>
      </section>
    </div>
  );
}

function ProbeCard({ probe }: { probe: BountyProbe }) {
  return (
    <article className="mt-6 rounded-xl bg-card p-5 shadow-[var(--shadow-border)] sm:p-8">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={probe.qualifies ? "partiel" : "default"}>
          {probe.qualifies ? "candidat" : "refusé"}
        </Badge>
        <Badge tone={probe.v12.decision === "PASS" ? "reprenable" : "corrompu"}>
          1.2 {probe.v12.decision}
        </Badge>
        <Badge tone={probe.v0.decision === "PASS" ? "reprenable" : "corrompu"}>
          V0 {probe.v0.decision}
        </Badge>
        <Badge tone="corrompu">due {probe.due_eur} €</Badge>
      </div>
      <p className="mt-4 text-sm text-muted-foreground">{probe.reason}</p>
      <p className="mt-2 font-mono text-xs text-subtle">
        monde {probe.world} · V0 {probe.v0.verdict} · 1.2 {probe.v12.verdict}
        {probe.locked ? ` · ${probe.locked}` : ""} · cash {String(probe.cash)}
      </p>
    </article>
  );
}
