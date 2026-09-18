import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FINAL_VERDICT } from "@/lib/bench/verdict";
import { runAttack, type AttackReport } from "@/lib/bench/attack";

export const Route = createFileRoute("/verdict")({ component: VerdictPage });

function VerdictPage() {
  const [report, setReport] = useState<AttackReport | null>(null);

  useEffect(() => {
    void runAttack().then(setReport);
  }, []);

  const killed = FINAL_VERDICT.claim_reprise_sure === "tue";

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:py-12">
      <p className="text-xs font-medium uppercase tracking-[0.22em] text-subtle">
        {FINAL_VERDICT.date} · ruleset {FINAL_VERDICT.ruleset} · gelé
      </p>
      <h1 className="mt-2 font-display text-4xl tracking-tight sm:text-5xl">Verdict final</h1>
      <p className="mt-3 max-w-2xl text-base text-muted-foreground">{FINAL_VERDICT.phrase}</p>

      <div className="mt-6 flex flex-wrap gap-2">
        <Badge tone={killed ? "corrompu" : "reprenable"}>
          Reprise sûre : {FINAL_VERDICT.claim_reprise_sure}
        </Badge>
        <Badge tone="reprenable">Laboratoire : {FINAL_VERDICT.laboratoire}</Badge>
        <Badge tone="partiel">Produit facturé : {FINAL_VERDICT.produit_facture}</Badge>
        <Badge tone="default">Standard : {FINAL_VERDICT.standard}</Badge>
      </div>

      <article className="mt-10 rounded-xl bg-card p-5 shadow-[var(--shadow-border)] sm:p-8">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-subtle">
          Ce qu'il faut dire
        </p>
        <h2 className="mt-3 font-display text-3xl tracking-tight">
          On sait certifier un paquet. On ne sait pas empêcher B de partir à tort.
        </h2>
        <p className="mt-4 max-w-2xl text-sm text-muted-foreground">
          Le notaire V0 est déterministe, gelé, et honnête sur ses 4 faux
          REPRENABLE. La grille CERT+GATE copie ce notaire. Le monde de{" "}
          {FINAL_VERDICT.premier_contre_exemple} ({FINAL_VERDICT.source}) est
          CORROMPU ; V0 dit REPRENABLE ; B est autorisé. Token FAIL : la grille
          arrête. Booléen, préfixe, spec, chemin, chat : elle laisse passer.
        </p>
        <dl className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Kills" value={String(FINAL_VERDICT.kills)} tone="corrompu" />
          <Stat label="Faux REPRENABLE" value={`${FINAL_VERDICT.faux_reprenable}/${FINAL_VERDICT.attaques}`} tone="corrompu" />
          <Stat label="Contrôles" value={FINAL_VERDICT.controles} />
          <Stat label="Contre-exemple" value={FINAL_VERDICT.premier_contre_exemple} />
        </dl>
        {report && report.projectClaim === "tuee" && report.nKills === FINAL_VERDICT.kills ? (
          <p className="mt-6 font-mono text-xs text-subtle">
            Banc relancé : {report.nKills} kills, claim {report.projectClaim}. Aligné sur le gel.
          </p>
        ) : report ? (
          <p className="mt-6 font-mono text-xs text-corrompu">
            Banc ≠ gel ({report.nKills} kills). Le verdict figé et le banc ont divergé.
          </p>
        ) : null}
      </article>

      <div className="mt-8 grid gap-4 lg:grid-cols-3">
        <Card
          title="On garde"
          items={[
            "V0 gelé — lock KFP rouge",
            "Trophée 24/24 = régression",
            "wrapNode silencieux hors goto",
            "Intégrité ≠ vérité ≠ paiement",
          ]}
        />
        <Card
          title="On a fermé"
          items={[
            "Relais /settle : requirements serveur",
            "JSON lu avant le paiement",
            "Replay de nonce ≠ second certificat",
            "e.message on-chain plus dans le 402",
          ]}
        />
        <Card
          title="On ne fait pas"
          items={[
            "Retuner V0 pour tuer KFP-001",
            "Ruleset 1.1 déguisé en patch",
            "HMAC AION, comptes, reconstruct",
            "Raconter 24/24 comme une reprise sûre",
          ]}
        />
      </div>

      <p className="mt-10 max-w-2xl text-sm text-muted-foreground">
        Décision restante, humaine : un ruleset 1.1 <em>à côté</em> de 1.0, ou
        arrêter. Pas un troisième tour d'analyse.
      </p>

      <div className="mt-6 flex flex-wrap gap-3">
        <Button asChild>
          <Link to="/attaque">Banc</Link>
        </Button>
        <Button asChild variant="outline">
          <Link to="/falsify">Dossier KFP</Link>
        </Button>
        <Button asChild variant="outline">
          <Link to="/offre">Offre</Link>
        </Button>
      </div>
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

function Card({ title, items }: { title: string; items: string[] }) {
  return (
    <article className="rounded-xl bg-card p-5 shadow-[var(--shadow-border)]">
      <h3 className="font-display text-xl tracking-tight">{title}</h3>
      <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </article>
  );
}
