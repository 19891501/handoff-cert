import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { GATE_SKU, RECEIPT } from "@/lib/offer/mission";

export const Route = createFileRoute("/sdk")({ component: SdkPage });

const KFP001 = {
  from: "planner",
  to: "executor",
  task: "Passer en mode exécuteur après le plan",
  state: { known: { issue: "311420" }, version: "1" },
  work_done: [{ claim: "Le mode exécuteur a été confirmé.", evidence_refs: ["sess1"] }],
  work_remaining: ["Exécuter le plan"],
  evidence: [
    {
      id: "sess1",
      type: "document",
      source: "vscode-session",
      timestamp: "2026-04-20T12:00:00Z",
      status: "",
      content: {
        switchAgentObservedInSessionLog: false,
        executorModeObservedAfterHandoff: false,
        sourcePlannerModeStillPresentAfterHandoff: true,
      },
    },
  ],
};

const RUST = `use handoff_cert::{gate_resume, Client};

// Grille 1.2 — B ne part que si REPRENABLE. 0,05 €. Preview.
let gate = gate_resume(&paquet)?;
if !gate.ok() { /* STOP */ }

// Reçu 1.0 — gelé, pas une grille. 0,001 €. KFP-001 passe encore.
let receipt = Client::new().certify(&paquet, None)?;`;

type CertOut = { certificate?: { verdict?: string; ruleset?: string } };

function SdkPage() {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [kfp, setKfp] = useState<{ v10: string; v12: string } | null>(null);

  async function runKfp() {
    setBusy(true);
    setErr(null);
    try {
      const [r10, r12] = await Promise.all([
        fetch("/api/v1/certify", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ paquet: KFP001 }),
        }).then((r) => r.json() as Promise<CertOut>),
        fetch("/api/v1/certify", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ paquet: KFP001, ruleset: "1.2" }),
        }).then((r) => r.json() as Promise<CertOut>),
      ]);
      setKfp({
        v10: `${r10.certificate?.ruleset ?? "?"} ${r10.certificate?.verdict ?? "?"}`,
        v12: `${r12.certificate?.ruleset ?? "?"} ${r12.certificate?.verdict ?? "?"}`,
      });
    } catch (e) {
      setErr(e instanceof Error ? e.message : "appel impossible");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:py-12">
      <p className="text-xs font-medium uppercase tracking-[0.22em] text-subtle">
        SDK Rust · certify + gate_resume
      </p>
      <h1 className="mt-2 font-display text-4xl tracking-tight sm:text-5xl">
        La grille dans le graphe
      </h1>
      <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
        Crate <span className="font-mono text-xs">handoff-cert</span> — pas
        crates.io. <span className="font-mono text-xs">certify</span> = reçu
        1.0. <span className="font-mono text-xs">gate_resume</span> = grille
        1.2. Facturation preview. Aucun client payant.
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <article className="rounded-xl bg-card p-5 shadow-[var(--shadow-border)]">
          <Badge tone="partiel">{RECEIPT.sku}</Badge>
          <h2 className="mt-3 font-display text-2xl tracking-tight">{RECEIPT.name}</h2>
          <p className="mt-2 font-display text-3xl tracking-tight">{RECEIPT.price_eur} €</p>
          <p className="mt-2 text-sm text-muted-foreground">
            certify() défaut. Gelé. KFP-001 reste REPRENABLE.
          </p>
        </article>
        <article className="rounded-xl bg-card p-5 shadow-[var(--shadow-border)]">
          <Badge tone="reprenable">{GATE_SKU.sku}</Badge>
          <h2 className="mt-3 font-display text-2xl tracking-tight">{GATE_SKU.name}</h2>
          <p className="mt-2 font-display text-3xl tracking-tight">
            {GATE_SKU.price_eur.toFixed(2)} €
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            gate_resume() défaut. KFP-001 → STOP. C'est le produit.
          </p>
        </article>
      </div>

      <div className="mt-8 flex flex-wrap gap-3">
        <Button onClick={runKfp} disabled={busy}>
          {busy ? "KFP-001…" : "KFP-001 · 1.0 vs 1.2"}
        </Button>
        <Button asChild variant="outline">
          <Link to="/offre">Les SKU</Link>
        </Button>
        <Button asChild variant="outline">
          <Link to="/falsify">Les 4 KFP</Link>
        </Button>
      </div>
      {err ? <p className="mt-3 text-sm text-corrompu">{err}</p> : null}

      {kfp ? (
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <article className="rounded-xl bg-card p-5 shadow-[var(--shadow-border)]">
            <Badge tone="partiel">1.0 reçu</Badge>
            <p className="mt-3 font-mono text-sm">{kfp.v10}</p>
            <p className="mt-2 text-sm text-muted-foreground">
              gate_resume(1.0) PASS — V0 n'est pas une grille.
            </p>
          </article>
          <article className="rounded-xl bg-card p-5 shadow-[var(--shadow-border)]">
            <Badge tone="reprenable">1.2 grille</Badge>
            <p className="mt-3 font-mono text-sm">{kfp.v12}</p>
            <p className="mt-2 text-sm text-muted-foreground">
              gate_resume() STOP. On vend ça.
            </p>
          </article>
        </div>
      ) : null}

      <pre className="mt-8 overflow-x-auto rounded-xl bg-card p-4 font-mono text-xs leading-relaxed text-muted-foreground shadow-[var(--shadow-border)]">
        {RUST}
      </pre>
    </div>
  );
}
