import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CertificateView } from "@/components/cert/certificate-view";
import { VerdictStamp } from "@/components/cert/stamp";
import { certify, getCase, type Certificate, type Verdict } from "@/lib/handoff";
import { FEATURED_CASES } from "@/lib/handoff/cases";
import { KNOWN_FALSE } from "@/lib/bench/falsify";
import { FINAL_VERDICT } from "@/lib/bench/verdict";
import * as attackMod from "@/lib/bench/attack";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({ component: Home });

const HAS_ATTACK_11 =
  typeof (attackMod as Record<string, unknown>).runAttack11 === "function";

function Home() {
  const [active, setActive] = useState<(typeof FEATURED_CASES)[number]>("clean_validation");
  const [cert, setCert] = useState<Certificate | null>(null);
  const featured = FEATURED_CASES.map((id) => getCase(id)!);

  useEffect(() => {
    const c = getCase(active);
    if (!c) return;
    let cancelled = false;
    certify(c.payload).then((result) => {
      if (!cancelled) setCert(result);
    });
    return () => {
      cancelled = true;
    };
  }, [active]);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:py-16">
      <p className="reveal text-xs font-medium uppercase tracking-[0.22em] text-subtle">
        Cap 2030 · TLS des reprises · V0 gelé
      </p>
      <h1 className="reveal reveal-1 mt-4 max-w-3xl font-display text-4xl leading-[1.1] tracking-tight sm:text-5xl md:text-6xl">
        On certifie. On encaisse. On n'arrête pas B à tort sur 1.0.
      </h1>
      <p className="reveal reveal-2 mt-5 max-w-2xl text-base text-muted-foreground sm:text-lg">
        {FINAL_VERDICT.phrase} Le volume, c'est chaque goto. La grille
        vendue, c'est 1.2.
      </p>
      <div className="reveal reveal-3 mt-8 flex flex-wrap gap-3">
        <Button asChild>
          <Link to="/cap">
            Le cap
            <ArrowRight />
          </Link>
        </Button>
        <Button asChild variant="outline">
          <Link to="/prix">Les prix</Link>
        </Button>
        <Button asChild variant="outline">
          <Link to="/offre">Les SKU</Link>
        </Button>
      </div>

      <section className="reveal reveal-4 mt-14 rounded-xl bg-card p-5 shadow-[var(--shadow-border)] sm:p-8">
        <div className="flex flex-wrap gap-2">
          <Badge tone="corrompu">Reprise sûre : tuée</Badge>
          <Badge tone="reprenable">Laboratoire : tenu</Badge>
          <Badge tone="partiel">Facturé : non</Badge>
        </div>
        <h2 className="mt-5 font-display text-3xl tracking-tight">
          {FINAL_VERDICT.kills} kills · {FINAL_VERDICT.premier_contre_exemple}
        </h2>
        <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
          Monde CORROMPU, V0 REPRENABLE, grille PASS. Contrôles lexique{" "}
          {FINAL_VERDICT.controles} : un token FAIL arrête encore B. Ce n'est
          pas suffisant. Lock KFP rouge. Pas de ruleset 1.1 déguisé.
          {HAS_ATTACK_11 ? (
            <>
              {" "}
              Autre notaire 1.1 : à côté de V0 —{" "}
              <Link to="/attaque" className="underline-offset-4 hover:underline">
                comparer au banc
              </Link>
              .
            </>
          ) : null}
        </p>
        <div className="mt-6 overflow-hidden rounded-lg bg-background/60">
          <table className="w-full text-sm">
            <tbody>
              {[
                ["Claim « B ne part pas à tort »", "Tué — 4 mondes CORROMPU en PASS"],
                ["Notaire V0", "Tenu, gelé, 4 KFP publics"],
                ["Relais x402", "Fermé — requirements serveur"],
                ["SKU / nonce", "Un nonce, un certificat"],
                ["1.1 / npm / HMAC", "Non. Décision humaine, pas un tour de plus."],
              ].map(([k, v]) => (
                <tr key={k} className="border-b border-border last:border-0">
                  <td className="px-4 py-3 font-medium">{k}</td>
                  <td className="px-4 py-3 text-muted-foreground">{v}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="mt-14 grid gap-3 sm:grid-cols-3">
        {featured.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setActive(c.id as (typeof FEATURED_CASES)[number])}
            className={cn(
              "min-h-11 rounded-xl bg-card p-4 text-left shadow-[var(--shadow-border)] transition-[box-shadow,transform] duration-150 ease-out active:scale-[0.99]",
              active === c.id && "shadow-[var(--shadow-border-hover)]",
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <VerdictStamp verdict={c.expected} className="size-16" />
              <span className="font-mono text-xs text-subtle">{c.expected}</span>
            </div>
            <h2 className="mt-4 font-display text-xl tracking-tight">{c.title}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{c.description}</p>
          </button>
        ))}
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_0.9fr]">
        {cert ? <CertificateView certificate={cert} /> : <CertificateSkeleton />}
        <aside className="rounded-xl bg-card p-5 shadow-[var(--shadow-border)] sm:p-6">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-subtle">
            Quatre dettes
          </p>
          <ul className="mt-4 space-y-3">
            {KNOWN_FALSE.map((k) => (
              <li key={k.tag}>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone="corrompu">{k.tag}</Badge>
                  <span className="font-mono text-xs text-subtle">{k.id}</span>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{k.missingRule}</p>
              </li>
            ))}
          </ul>
          <Button asChild variant="outline" className="mt-6">
            <Link to="/verdict">Verdict</Link>
          </Button>
        </aside>
      </div>

      <section className="mt-16 border-t border-border pt-10">
        <h2 className="font-display text-3xl tracking-tight">Trois verdicts</h2>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Pas un score. Une décision. REPRENABLE à tort est l'erreur critique :
          une machine continuerait.
        </p>
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <VerdictCard
            verdict="REPRENABLE"
            text="Assez d'état, de preuves et de reste — selon le ruleset, pas selon la vérité du monde."
          />
          <VerdictCard
            verdict="PARTIEL"
            text="Il manque une information requise. Rien n'est encore nié."
          />
          <VerdictCard
            verdict="CORROMPU"
            text="Une affirmation est contredite. Continuer propagerait l'erreur."
          />
        </div>
      </section>
    </div>
  );
}

function VerdictCard({ verdict, text }: { verdict: Verdict; text: string }) {
  return (
    <div className="rounded-xl bg-card p-5 shadow-[var(--shadow-border)]">
      <VerdictStamp verdict={verdict} className="size-20" />
      <h3 className="mt-4 font-display text-2xl tracking-tight">{verdict}</h3>
      <p className="mt-2 text-sm text-muted-foreground">{text}</p>
    </div>
  );
}

function CertificateSkeleton() {
  return (
    <div className="h-80 animate-pulse rounded-xl bg-card shadow-[var(--shadow-border)]" />
  );
}
