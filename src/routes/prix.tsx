import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  OFFER,
  TIERS,
  formatTierPrice,
  previewCheckout,
  type CheckoutPreview,
  type Tier,
} from "@/lib/offer/catalog";
import { GATE_SKU, LICENCE, NEVER, RECEIPT } from "@/lib/offer/mission";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/prix")({ component: PrixPage });

const TONE: Record<string, "partiel" | "reprenable" | "default"> = {
  [RECEIPT.sku]: "partiel",
  [GATE_SKU.sku]: "reprenable",
  [LICENCE.sku]: "default",
};

const ASK: Record<string, string> = {
  [RECEIPT.sku]: "Demander le reçu",
  [GATE_SKU.sku]: "Demander la grille",
  [LICENCE.sku]: "Demander la licence",
};

function PrixPage() {
  const [preview, setPreview] = useState<CheckoutPreview | null>(null);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:py-12">
      <p className="text-xs font-medium uppercase tracking-[0.22em] text-subtle">
        Prix public · billing {OFFER.billing} · cap 2030
      </p>
      <h1 className="mt-2 font-display text-4xl tracking-tight sm:text-5xl">
        Trois paliers. Pas un checkout fantôme.
      </h1>
      <p className="mt-3 max-w-2xl text-base text-muted-foreground">
        Le reçu 1.0 n'est pas une grille. La grille 1.2 est le produit qui
        encaisse. La licence 48&nbsp;000 € n'est pas encore encaissée. Facturation{" "}
        <Badge tone="partiel">{OFFER.billing}</Badge> : on n'invente ni client
        payant, ni hash, ni succès.
      </p>

      <div className="mt-10 grid gap-4 lg:grid-cols-3">
        {TIERS.map((tier) => (
          <TierCard
            key={tier.sku}
            tier={tier}
            featured={tier.sku === GATE_SKU.sku}
            onAsk={() => setPreview(previewCheckout(tier.sku))}
          />
        ))}
      </div>

      <section className="mt-8 rounded-xl bg-card p-5 shadow-[var(--shadow-border)] sm:p-8">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-subtle">
          Checkout
        </p>
        <h2 className="mt-3 font-display text-2xl tracking-tight">
          Demander n'est pas payer
        </h2>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          <code className="font-mono text-xs">previewCheckout</code> renvoie
          toujours <span className="font-mono text-xs">success: false</span>,{" "}
          <span className="font-mono text-xs">charged: false</span>,{" "}
          <span className="font-mono text-xs">transaction: ""</span>. Un écran
          vert ici serait un mensonge.
        </p>
        {preview ? (
          <pre className="mt-5 overflow-x-auto rounded-lg bg-background/60 p-4 font-mono text-xs text-muted-foreground">
            {JSON.stringify(preview, null, 2)}
          </pre>
        ) : (
          <p className="mt-5 text-sm text-subtle">
            Choisissez un palier. La réponse restera un refus honnête.
          </p>
        )}
      </section>

      <div className="mt-8 overflow-hidden rounded-xl bg-card shadow-[var(--shadow-border)]">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-[0.16em] text-subtle">
              <th className="px-4 py-3 font-medium">Palier</th>
              <th className="px-4 py-3 font-medium">SKU</th>
              <th className="px-4 py-3 font-medium">Prix</th>
              <th className="hidden px-4 py-3 font-medium sm:table-cell">Servi</th>
            </tr>
          </thead>
          <tbody>
            {TIERS.map((tier) => (
              <tr key={tier.sku} className="border-b border-border last:border-0">
                <td className="px-4 py-3 font-medium">{tier.name}</td>
                <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                  {tier.sku}
                </td>
                <td className="px-4 py-3 font-display text-lg tracking-tight">
                  {formatTierPrice(tier)}
                </td>
                <td className="hidden px-4 py-3 sm:table-cell">
                  <Badge tone={tier.sold ? "partiel" : "default"}>
                    {tier.sold ? "prix public" : "pas encore encaissé"}
                  </Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-10 flex flex-wrap gap-3">
        <Button asChild>
          <Link to="/offre">Contrat API</Link>
        </Button>
        <Button asChild variant="outline">
          <Link to="/cap">Le cap</Link>
        </Button>
        <Button asChild variant="outline">
          <Link to="/verdict">Le gel reste rouge</Link>
        </Button>
      </div>

      <section className="mt-14 border-t border-border pt-10">
        <h2 className="font-display text-2xl tracking-tight">Ce qu'on ne fera jamais</h2>
        <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
          {NEVER.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function TierCard({
  tier,
  featured,
  onAsk,
}: {
  tier: Tier;
  featured: boolean;
  onAsk: () => void;
}) {
  const tone = TONE[tier.sku] ?? "default";
  const ruleset = "ruleset" in tier ? tier.ruleset : "piné";

  return (
    <article
      className={cn(
        "flex flex-col rounded-xl bg-card p-5 shadow-[var(--shadow-border)] sm:p-6",
        featured && "shadow-[var(--shadow-border-hover)]",
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={tone}>{tier.sku}</Badge>
        {featured ? <Badge tone="reprenable">grille</Badge> : null}
        {!tier.sold ? <Badge>objectif</Badge> : null}
      </div>
      <h2 className="mt-4 font-display text-2xl tracking-tight">{tier.name}</h2>
      <p className="mt-2 font-display text-4xl tracking-tight">
        {formatTierPrice(tier)}
      </p>
      <p className="mt-1 text-xs uppercase tracking-[0.16em] text-subtle">
        {tier.sold ? `ruleset ${ruleset}` : `ruleset ${ruleset} · pas vendu`}
      </p>
      <p className="mt-3 flex-1 text-sm text-muted-foreground">{tier.role}</p>
      <Button
        onClick={onAsk}
        variant={featured ? "default" : "outline"}
        className="mt-6"
      >
        {ASK[tier.sku] ?? "Demander"}
      </Button>
    </article>
  );
}
