import { createFileRoute, Link, useRouterState } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LangToggle } from "@/components/layout/lang-toggle";
import { capCopy } from "@/lib/i18n/copy";
import { localeFromPath, pageHref } from "@/lib/i18n/locale";
import { GATE_SKU, LICENCE, RECEIPT } from "@/lib/offer/mission";

export const Route = createFileRoute("/cap")({ component: CapPage });

export function CapPage() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const locale = localeFromPath(pathname);
  const copy = capCopy(locale);
  const numberLocale = locale === "en" ? "en-GB" : "fr-FR";

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:py-16">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="text-xs font-medium uppercase tracking-[0.22em] text-subtle">
          {copy.kicker}
        </p>
        <LangToggle page="cap" locale={locale} />
      </div>
      <h1 className="mt-4 max-w-3xl font-display text-4xl leading-[1.1] tracking-tight sm:text-5xl md:text-6xl">
        {copy.name}
      </h1>
      <p className="mt-5 max-w-2xl text-base text-muted-foreground sm:text-lg">
        {copy.sentence}
      </p>
      <p className="mt-3 max-w-2xl text-sm text-muted-foreground">{copy.whyMoney}</p>

      <div className="mt-8 flex flex-wrap gap-3">
        <Button asChild>
          <Link to={pageHref("offre", locale)}>{copy.collect}</Link>
        </Button>
        <Button asChild variant="outline">
          <Link to="/verdict">{copy.freezeRed}</Link>
        </Button>
      </div>

      <section className="mt-14 rounded-xl bg-card p-5 shadow-[var(--shadow-border)] sm:p-8">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-subtle">
          {copy.targetsKicker}
        </p>
        <h2 className="mt-3 font-display text-3xl tracking-tight">{copy.targetsTitle}</h2>
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {copy.targets.map((t) => (
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
          title={copy.receiptName}
          price={`${RECEIPT.price_eur} €`}
          role={copy.receiptRole}
          tone="partiel"
        />
        <Sku
          sku={GATE_SKU.sku}
          title={copy.gateName}
          price={`${GATE_SKU.price_eur.toFixed(2)} €`}
          role={copy.gateRole}
          tone="reprenable"
        />
        <Sku
          sku={LICENCE.sku}
          title={copy.licenceName}
          price={`${LICENCE.price_eur.toLocaleString(numberLocale)} € / ${copy.licencePeriod}`}
          role={copy.licenceRole}
          tone="default"
        />
      </div>

      <section className="mt-10 rounded-xl bg-card p-5 shadow-[var(--shadow-border)] sm:p-8">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-subtle">
          {copy.neverKicker}
        </p>
        <h2 className="mt-3 font-display text-3xl tracking-tight">{copy.neverTitle}</h2>
        <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
          {copy.never.map((line) => (
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
