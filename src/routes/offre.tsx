import { useEffect, useState } from "react";
import { createFileRoute, Link, useRouterState } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LangToggle } from "@/components/layout/lang-toggle";
import { offreCopy } from "@/lib/i18n/copy";
import { localeFromPath } from "@/lib/i18n/locale";
import { OFFER } from "@/lib/offer/catalog";
import { GATE_SKU, RECEIPT } from "@/lib/offer/mission";
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

type LedgerInfo = {
  table: string;
  backend: "memory" | "sql";
  key: string[];
  settle_replay: string;
  verify_consumed: string;
  verify_consumes: boolean;
};

type FacilitatorInfo = {
  enforced: boolean;
  payTo: string | null;
  amount: string;
  network: string;
  ledger: LedgerInfo;
};

export function OffrePage() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const locale = localeFromPath(pathname);
  const copy = offreCopy(locale);
  const [out, setOut] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [x402, setX402] = useState<FacilitatorInfo | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/x402")
      .then((res) => (res.ok ? res.json() : null))
      .then((json: FacilitatorInfo | null) => {
        if (!cancelled && json?.ledger) setX402(json);
      })
      .catch(() => {
        /* contrat statique ci-dessous */
      });
    return () => {
      cancelled = true;
    };
  }, []);

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
      setErr(e instanceof Error ? e.message : copy.callFailed);
    } finally {
      setBusy(false);
    }
  }

  const ledger = x402?.ledger;

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:py-12">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="text-xs font-medium uppercase tracking-[0.22em] text-subtle">
          SKU {OFFER.sku} · ruleset {OFFER.ruleset}
        </p>
        <LangToggle page="offre" locale={locale} />
      </div>
      <h1 className="mt-2 font-display text-4xl tracking-tight sm:text-5xl">
        {copy.offerName}
      </h1>
      <p className="mt-3 max-w-2xl text-base text-muted-foreground">{copy.offerWhat}</p>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{copy.twoSkus}</p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <article className="rounded-xl bg-card p-5 shadow-[var(--shadow-border)]">
          <Badge tone="partiel">{RECEIPT.sku}</Badge>
          <h2 className="mt-3 font-display text-2xl tracking-tight">{copy.receiptName}</h2>
          <p className="mt-2 font-display text-3xl tracking-tight">{RECEIPT.price_eur} €</p>
          <p className="mt-2 text-sm text-muted-foreground">{copy.receiptRole}</p>
        </article>
        <article className="rounded-xl bg-card p-5 shadow-[var(--shadow-border)]">
          <Badge tone="reprenable">{GATE_SKU.sku}</Badge>
          <h2 className="mt-3 font-display text-2xl tracking-tight">{copy.gateName}</h2>
          <p className="mt-2 font-display text-3xl tracking-tight">
            {GATE_SKU.price_eur.toFixed(2)} €
          </p>
          <p className="mt-2 text-sm text-muted-foreground">{copy.gateRole}</p>
        </article>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        <article className="rounded-xl bg-card p-5 shadow-[var(--shadow-border)]">
          <p className="text-xs uppercase tracking-[0.16em] text-subtle">{copy.price}</p>
          <p className="mt-2 font-display text-4xl tracking-tight">
            {OFFER.price_eur.toFixed(3)}&nbsp;€
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {copy.per} {copy.unit}
          </p>
        </article>
        <article className="rounded-xl bg-card p-5 shadow-[var(--shadow-border)]">
          <p className="text-xs uppercase tracking-[0.16em] text-subtle">{copy.contract}</p>
          <p className="mt-2 font-mono text-sm">{OFFER.endpoint}</p>
          <p className="mt-2 text-sm text-muted-foreground">{copy.contractBody}</p>
        </article>
        <article className="rounded-xl bg-card p-5 shadow-[var(--shadow-border)]">
          <p className="text-xs uppercase tracking-[0.16em] text-subtle">{copy.billing}</p>
          <p className="mt-2">
            <Badge tone="partiel">{OFFER.billing}</Badge>
          </p>
          <p className="mt-2 text-sm text-muted-foreground">{copy.billingBody}</p>
        </article>
      </div>

      <section className="mt-6 rounded-xl bg-card p-5 shadow-[var(--shadow-border)] sm:p-8">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-subtle">
          {copy.ledgerKicker}
        </p>
        <h2 className="mt-3 font-display text-2xl tracking-tight">{copy.ledgerTitle}</h2>
        <p className="mt-3 max-w-2xl text-sm text-muted-foreground">{copy.ledgerBody}</p>
        <div className="mt-6 overflow-hidden rounded-lg bg-background/60">
          <table className="w-full text-sm">
            <tbody>
              {[
                [copy.table, ledger?.table ?? "x402_nonces"],
                [
                  copy.backend,
                  ledger?.backend === "sql" ? copy.backendSql : copy.backendMemory,
                ],
                [copy.settleReplay, copy.settleReplayValue],
                [copy.verifyConsumed, "nonce_replay"],
                [copy.verifyConsumes, copy.no],
              ].map(([k, v]) => (
                <tr key={k} className="border-b border-border last:border-0">
                  <td className="px-4 py-3 font-medium">{k}</td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                    {v}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="mt-10 flex flex-wrap gap-3">
        <Button onClick={callApi} disabled={busy}>
          {busy ? copy.calling : copy.callApi}
        </Button>
        <Button asChild variant="outline">
          <Link to="/adopt">{copy.wireWrap}</Link>
        </Button>
        <Button asChild variant="outline">
          <Link to="/falsify">{copy.readKfp}</Link>
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
        <h2 className="font-display text-2xl tracking-tight">{copy.notBuying}</h2>
        <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
          {copy.not.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        <p className="mt-6 max-w-2xl text-sm text-muted-foreground">{copy.frozenNote}</p>
      </section>
    </div>
  );
}
