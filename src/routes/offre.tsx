import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { OFFER } from "@/lib/offer/catalog";
import { getCase } from "@/lib/handoff/cases";

export const Route = createFileRoute("/offre")({ component: OffrePage });

const SAMPLE = JSON.stringify(
  { paquet: getCase("clean_validation")!.payload },
  null,
  2,
);

const CURL = `curl -sS ${OFFER.endpoint} \\
  -H 'content-type: application/json' \\
  -d '{"paquet":{...}}'`;

function OffrePage() {
  const [out, setOut] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function callApi() {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(OFFER.endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: SAMPLE,
      });
      const json: unknown = await res.json();
      setOut(JSON.stringify(json, null, 2));
    } catch (e) {
      setErr(e instanceof Error ? e.message : "appel impossible");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:py-12">
      <p className="text-xs font-medium uppercase tracking-[0.22em] text-subtle">
        SKU {OFFER.sku} · ruleset {OFFER.ruleset}
      </p>
      <h1 className="mt-2 font-display text-4xl tracking-tight sm:text-5xl">
        {OFFER.name}
      </h1>
      <p className="mt-3 max-w-2xl text-base text-muted-foreground">{OFFER.what}</p>

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        <article className="rounded-xl bg-card p-5 shadow-[var(--shadow-border)]">
          <p className="text-xs uppercase tracking-[0.16em] text-subtle">Prix</p>
          <p className="mt-2 font-display text-4xl tracking-tight">
            {OFFER.price_eur.toFixed(3)}&nbsp;€
          </p>
          <p className="mt-1 text-sm text-muted-foreground">par {OFFER.unit}</p>
        </article>
        <article className="rounded-xl bg-card p-5 shadow-[var(--shadow-border)]">
          <p className="text-xs uppercase tracking-[0.16em] text-subtle">Contrat</p>
          <p className="mt-2 font-mono text-sm">{OFFER.endpoint}</p>
          <p className="mt-2 text-sm text-muted-foreground">
            POST JSON → certificat. Intégrité et verdict restent séparés.
          </p>
        </article>
        <article className="rounded-xl bg-card p-5 shadow-[var(--shadow-border)]">
          <p className="text-xs uppercase tracking-[0.16em] text-subtle">Facturation</p>
          <p className="mt-2">
            <Badge tone="partiel">{OFFER.billing}</Badge>
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            Prix public. Facilitateur x402 :{" "}
            <span className="font-mono text-xs">/api/x402</span> (Base
            Sepolia). POST sans <span className="font-mono text-xs">X-PAYMENT</span>{" "}
            → 402 seulement si <span className="font-mono text-xs">X402_PAY_TO</span>{" "}
            est configuré. Pas de hash inventé.
          </p>
        </article>
      </div>

      <div className="mt-10 flex flex-wrap gap-3">
        <Button onClick={callApi} disabled={busy}>
          {busy ? "Appel…" : "Appeler l'API"}
        </Button>
        <Button asChild variant="outline">
          <Link to="/adopt">Brancher wrapNode</Link>
        </Button>
        <Button asChild variant="outline">
          <Link to="/falsify">Lire les 4 KFP</Link>
        </Button>
      </div>
      {err ? <p className="mt-3 text-sm text-corrompu">{err}</p> : null}

      <pre className="mt-8 overflow-x-auto rounded-xl bg-card p-4 font-mono text-xs text-muted-foreground shadow-[var(--shadow-border)]">
        {CURL}
      </pre>

      {out ? (
        <pre className="mt-4 max-h-80 overflow-auto rounded-xl bg-card p-4 font-mono text-xs shadow-[var(--shadow-border)]">
          {out}
        </pre>
      ) : null}

      <section className="mt-14 border-t border-border pt-10">
        <h2 className="font-display text-2xl tracking-tight">Ce que vous n'achetez pas</h2>
        <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
          {OFFER.not.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        <p className="mt-6 max-w-2xl text-sm text-muted-foreground">
          V0 est gelé. Quatre faux REPRENABLE sont publics. Les vendre comme un
          juge infaillible serait un autre produit — faux.
        </p>
      </section>
    </div>
  );
}
