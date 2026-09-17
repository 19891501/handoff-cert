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
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({ component: Home });

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
        Couche de certification · V0 gelé
      </p>
      <h1 className="reveal reveal-1 mt-4 max-w-3xl font-display text-4xl leading-[1.1] tracking-tight sm:text-5xl md:text-6xl">
        Peut-on reprendre <em className="italic">sans deviner</em>&nbsp;?
      </h1>
      <p className="reveal reveal-2 mt-5 max-w-2xl text-base text-muted-foreground sm:text-lg">
        HANDOFF CERT n'est pas une application d'agents. C'est un
        sceau à la frontière : assez d'état, de preuves et de reste pour que
        B reprenne sans reconstruire l'histoire de A.
      </p>
      <div className="reveal reveal-3 mt-8 flex flex-wrap gap-3">
        <Button asChild>
          <Link to="/offre">
            Voir l'offre
            <ArrowRight />
          </Link>
        </Button>
        <Button asChild variant="outline">
          <Link to="/certify">Certifier un paquet</Link>
        </Button>
      </div>

      <section className="reveal reveal-4 mt-14 rounded-xl bg-card p-5 shadow-[var(--shadow-border)] sm:p-8">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-subtle">
          Verdict final
        </p>
        <h2 className="mt-3 font-display text-3xl tracking-tight">Le noyau tient. On publie les trous.</h2>
        <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
          Architecture GO. Juge déterministe GO, et gelé. Banc trophée 24/24.
          Corpus 18/22 — quatre faux REPRENABLE nommés, lockés. Sceau JCS →
          SHA-256. Insertion : Command.goto seulement. Reconstruct non. Reset
          A→B : protocole écrit, pas lancé. Hypothèse commerciale : inconnue.
        </p>
        <div className="mt-6 overflow-hidden rounded-lg bg-background/60">
          <table className="w-full text-sm">
            <tbody>
              {[
                ["Trophée", "24/24 — régression, pas une croyance"],
                ["Adversarial", "4 KFP encore faux — le lock doit rester rouge si on « corrige »"],
                ["Sceau", "cp.v1 · Integrity ≠ Truth"],
                ["Hook", "wrapNode autour de goto · silence ailleurs"],
                ["On ne construit pas", "comptes, npm, HMAC, x402, reconstruct"],
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
            <Link to="/falsify">Dossier</Link>
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
