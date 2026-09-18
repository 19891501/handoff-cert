import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FINAL_VERDICT } from "@/lib/bench/verdict";
import {
  runAttack,
  runAttack11,
  runAttack12,
  type AttackReport,
} from "@/lib/bench/attack";

export const Route = createFileRoute("/verdict")({ component: VerdictPage });

function getRunAttack11(): (() => Promise<AttackReport>) | null {
  return runAttack11;
}

function getRunAttack12(): (() => Promise<AttackReport>) | null {
  return typeof runAttack12 === "function" ? runAttack12 : null;
}

const RUN_ATTACK_11 = getRunAttack11();
const RUN_ATTACK_12 = getRunAttack12();

function VerdictPage() {
  const [report, setReport] = useState<AttackReport | null>(null);
  const [report11, setReport11] = useState<AttackReport | null>(null);
  const [report12, setReport12] = useState<AttackReport | null>(null);
  const [error11, setError11] = useState(false);
  const [error12, setError12] = useState(false);

  useEffect(() => {
    void runAttack().then(setReport);
    if (RUN_ATTACK_11) {
      void RUN_ATTACK_11()
        .then((r) => {
          setReport11(r);
          setError11(false);
        })
        .catch(() => {
          setReport11(null);
          setError11(true);
        });
    }
    if (RUN_ATTACK_12) {
      void RUN_ATTACK_12()
        .then((r) => {
          setReport12(r);
          setError12(false);
        })
        .catch(() => {
          setReport12(null);
          setError12(true);
        });
    }
  }, []);

  const killed = FINAL_VERDICT.claim_reprise_sure === "tue";
  const has12 = Boolean(RUN_ATTACK_12);

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

      {RUN_ATTACK_11 ? (
        <article className="mt-6 rounded-xl bg-card p-5 shadow-[var(--shadow-border)] sm:p-8">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-subtle">
            Ruleset 1.1 (autre notaire)
          </p>
          <h2 className="mt-3 font-display text-3xl tracking-tight">
            À côté de V0. Pas à sa place.
          </h2>
          <p className="mt-4 max-w-2xl text-sm text-muted-foreground">
            Second notaire, live. Il ne réécrit pas le gel et ne ferme pas{" "}
            {FINAL_VERDICT.premier_contre_exemple} sur 1.0. Reprise sûre V0 :
            tuée.
          </p>
          {report11 ? (
            <>
              <div className="mt-6 flex flex-wrap gap-2">
                <Badge tone={report11.projectClaim === "tuee" ? "corrompu" : "partiel"}>
                  Claim 1.1 : {report11.projectClaim === "tuee" ? "tué" : "tenu sur ce corpus"}
                </Badge>
                <Badge tone="corrompu">V0 : tué</Badge>
                <Badge tone="default">
                  Ruleset {report11.ruleset ?? "1.1"}
                </Badge>
              </div>
              <dl className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Stat
                  label="Kills"
                  value={String(report11.nKills)}
                  tone={report11.nKills > 0 ? "corrompu" : undefined}
                />
                <Stat
                  label="Faux REPRENABLE"
                  value={`${report11.nFalseReprenable}/${report11.n}`}
                  tone={report11.nFalseReprenable > 0 ? "corrompu" : undefined}
                />
                <Stat label="Contrôles" value={`${report11.nControlOk}/2`} />
                <Stat
                  label="Contre-exemple"
                  value={report11.killer?.attack.id ?? "aucun"}
                />
              </dl>
              <p className="mt-6 font-mono text-xs text-subtle">{report11.sentence}</p>
            </>
          ) : (
            <p className="mt-6 font-mono text-xs text-subtle">
              {error11 ? "Banc 1.1 illisible. Aucun chiffre inventé." : "Banc 1.1 en cours."}
            </p>
          )}
        </article>
      ) : null}

      {has12 ? (
        <article className="mt-6 rounded-xl bg-card p-5 shadow-[var(--shadow-border)] sm:p-8">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-subtle">
            1.2 autre notaire
          </p>
          <h2 className="mt-3 font-display text-3xl tracking-tight">
            À côté de V0. Pas à sa place.
          </h2>
          <p className="mt-4 max-w-2xl text-sm text-muted-foreground">
            Troisième notaire, live. Il ne réécrit pas le gel et ne ferme pas{" "}
            {FINAL_VERDICT.premier_contre_exemple} sur 1.0. Reprise sûre V0 :
            tuée.
          </p>
          {report12 ? (
            <>
              <div className="mt-6 flex flex-wrap gap-2">
                <Badge tone={report12.projectClaim === "tuee" ? "corrompu" : "partiel"}>
                  Claim 1.2 : {report12.projectClaim === "tuee" ? "tué" : "tenu sur ce corpus"}
                </Badge>
                <Badge tone="corrompu">V0 : tué</Badge>
                <Badge tone="default">
                  Ruleset {report12.ruleset ?? "1.2"}
                </Badge>
              </div>
              <dl className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Stat
                  label="Kills"
                  value={String(report12.nKills)}
                  tone={report12.nKills > 0 ? "corrompu" : undefined}
                />
                <Stat
                  label="Faux REPRENABLE"
                  value={`${report12.nFalseReprenable}/${report12.n}`}
                  tone={report12.nFalseReprenable > 0 ? "corrompu" : undefined}
                />
                <Stat label="Contrôles" value={`${report12.nControlOk}/2`} />
                <Stat
                  label="Contre-exemple"
                  value={report12.killer?.attack.id ?? "aucun"}
                />
              </dl>
              <p className="mt-6 font-mono text-xs text-subtle">{report12.sentence}</p>
            </>
          ) : (
            <p className="mt-6 font-mono text-xs text-subtle">
              {error12 ? "Banc 1.2 illisible. Aucun chiffre inventé." : "Banc 1.2 en cours."}
            </p>
          )}
        </article>
      ) : null}

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
        {has12 ? (
          <>
            Les rulesets 1.1 et 1.2 sont d'autres notaires, <em>à côté</em> de
            1.0. V0 n'est pas retuné. Reprise sûre 1.0 : tuée.
          </>
        ) : RUN_ATTACK_11 ? (
          <>
            Le ruleset 1.1 est un autre notaire, <em>à côté</em> de 1.0. V0
            n'est pas retuné. Reprise sûre 1.0 : tuée.
          </>
        ) : (
          <>
            Décision restante, humaine : un ruleset 1.1 <em>à côté</em> de 1.0, ou
            arrêter. Pas un troisième tour d'analyse.
          </>
        )}
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
