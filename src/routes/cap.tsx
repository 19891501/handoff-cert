import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { GATE_SKU, LICENCE, MISSION, NEVER, RECEIPT, TARGETS } from "@/lib/offer/mission";

export const Route = createFileRoute("/cap")({ component: CapPage });

function CapPage() {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:py-16">
      <p className="text-xs font-medium uppercase tracking-[0.22em] text-subtle">
        Cap · {MISSION.horizon} · liberté totale
      </p>
      <h1 className="mt-4 max-w-3xl font-display text-4xl leading-[1.1] tracking-tight sm:text-5xl md:text-6xl">
        {MISSION.name}
      </h1>
      <p className="mt-5 max-w-2xl text-base text-muted-foreground sm:text-lg">
        {MISSION.sentence}
      </p>
      <p className="mt-3 max-w-2xl text-sm text-muted-foreground">{MISSION.why_money}</p>

      <div className="mt-8 flex flex-wrap gap-3">
        <Button asChild>
          <Link to="/offre">Encaisser</Link>
        </Button>
        <Button asChild variant="outline">
          <Link to="/verdict">Le gel reste rouge</Link>
        </Button>
      </div>

      <section className="mt-14 rounded-xl bg-card p-5 shadow-[var(--shadow-border)] sm:p-8">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-subtle">
          Très grands objectifs
        </p>
        <h2 className="mt-3 font-display text-3xl tracking-tight">
          On vise la rente, pas un laboratoire.
        </h2>
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {TARGETS.map((t) => (
            <article key={t.id} className="rounded-lg bg-background/60 p-4">
              <Badge tone="partiel">{t.money}</Badge>
              <h3 className="mt-3 font-display text-2xl tracking-tight">{t.label}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{t.why}</p>
            </article>
          ))}
        </div>
      </section>

      <div className="mt-8 grid gap-4 lg:grid-cols-3">
        <Sku
          sku={RECEIPT.sku}
          title={RECEIPT.name}
          price={`${RECEIPT.price_eur} €`}
          role={RECEIPT.role}
          tone="partiel"
        />
        <Sku
          sku={GATE_SKU.sku}
          title={GATE_SKU.name}
          price={`${GATE_SKU.price_eur.toFixed(2)} €`}
          role={GATE_SKU.role}
          tone="reprenable"
        />
        <Sku
          sku={LICENCE.sku}
          title={LICENCE.name}
          price={`${LICENCE.price_eur.toLocaleString("fr-FR")} € / ${LICENCE.period}`}
          role={LICENCE.role}
          tone="default"
        />
      </div>

      <section className="mt-10 rounded-xl bg-card p-5 shadow-[var(--shadow-border)] sm:p-8">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-subtle">
          Rien négliger
        </p>
        <h2 className="mt-3 font-display text-3xl tracking-tight">Ce qu'on ne fera jamais</h2>
        <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
          {NEVER.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function Sku({
  sku,
  title,
  price,
  role,
  tone,
}: {
  sku: string;
  title: string;
  price: string;
  role: string;
  tone: "reprenable" | "partiel" | "default";
}) {
  return (
    <article className="rounded-xl bg-card p-5 shadow-[var(--shadow-border)]">
      <Badge tone={tone}>{sku}</Badge>
      <h3 className="mt-4 font-display text-2xl tracking-tight">{title}</h3>
      <p className="mt-2 font-display text-3xl tracking-tight">{price}</p>
      <p className="mt-2 text-sm text-muted-foreground">{role}</p>
    </article>
  );
}
