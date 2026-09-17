import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CertificateView } from "@/components/cert/certificate-view";
import { VerdictDot } from "@/components/cert/stamp";
import {
  PROPERTY_STEPS,
  certify,
  orderedBlindCases,
  scanLeaks,
  type BlindCase,
  type Certificate,
  type Verdict,
} from "@/lib/handoff";
import { cn, pretty } from "@/lib/utils";

export const Route = createFileRoute("/blind")({ component: BlindPage });

type BlindRow = {
  caze: BlindCase;
  actual: Verdict;
  certificate: Certificate;
  leaks: string[];
  ok: boolean;
  falseReprenant: boolean;
};

function BlindPage() {
  const envelopes = useMemo(() => orderedBlindCases(), []);
  const [stepId, setStepId] = useState(PROPERTY_STEPS[0]!.id);
  const [stepCert, setStepCert] = useState<Certificate | null>(null);
  const [rows, setRows] = useState<BlindRow[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [unsealed, setUnsealed] = useState(false);
  const [selected, setSelected] = useState<string>(envelopes[0]!.id);

  const step = PROPERTY_STEPS.find((s) => s.id === stepId) ?? PROPERTY_STEPS[0]!;

  useEffect(() => {
    let cancelled = false;
    certify(step.payload).then((cert) => {
      if (!cancelled) setStepCert(cert);
    });
    return () => {
      cancelled = true;
    };
  }, [step]);

  async function runBlind() {
    setBusy(true);
    setUnsealed(false);
    const next: BlindRow[] = [];
    for (const caze of envelopes) {
      const certificate = await certify(caze.payload);
      next.push({
        caze,
        actual: certificate.verdict,
        certificate,
        leaks: scanLeaks(caze.payload),
        ok: certificate.verdict === caze.expected,
        falseReprenant:
          certificate.verdict === "REPRENABLE" && caze.expected !== "REPRENABLE",
      });
    }
    setRows(next);
    setSelected(next[0]?.caze.id ?? envelopes[0]!.id);
    setBusy(false);
  }

  const stats = useMemo(() => {
    if (!rows) return null;
    const n = rows.length;
    const correct = rows.filter((r) => r.ok).length;
    const leaks = rows.reduce((acc, r) => acc + r.leaks.length, 0);
    const falseReprenant = rows.filter((r) => r.falseReprenant).length;
    const falseCorrompu = rows.filter(
      (r) => r.actual === "CORROMPU" && r.caze.expected !== "CORROMPU",
    ).length;
    const go = correct >= 15 && falseReprenant === 0 && leaks === 0;
    return {
      n,
      correct,
      accuracy: Math.round((correct / n) * 1000) / 10,
      leaks,
      falseReprenant,
      falseCorrompu,
      go,
    };
  }, [rows]);

  const selectedRow = rows?.find((r) => r.caze.id === selected);
  const selectedCase = envelopes.find((c) => c.id === selected) ?? envelopes[0]!;

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:py-12">
      <p className="text-xs font-medium uppercase tracking-[0.22em] text-subtle">
        V0.1 · banc réel aveugle · moteur gelé
      </p>
      <h1 className="mt-2 font-display text-4xl tracking-tight">Aveugle</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
        24/24 sur le banc de contrat ne valide rien. Ici, les paquets ne
        portent que des faits. Pas de diagnostic. La vérité terrain reste
        scellée jusqu'après la certification.
      </p>

      <section className="mt-10">
        <h2 className="font-display text-2xl tracking-tight">La propriété</h2>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Trois paquets. Même moteur. Le score n'est pas le produit : le
          verdict l'est.
        </p>
        <div className="mt-4 inline-flex flex-wrap gap-1 rounded-lg bg-muted p-1">
          {PROPERTY_STEPS.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setStepId(s.id)}
              className={cn(
                "h-11 rounded-md px-4 text-sm",
                stepId === s.id
                  ? "bg-background text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {s.id}. {s.title}
            </button>
          ))}
        </div>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <div className="rounded-xl bg-card p-4 shadow-[var(--shadow-border)] sm:p-5">
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-subtle">
              Paquet
            </p>
            <pre className="mt-3 max-h-72 overflow-auto font-mono text-xs leading-relaxed text-muted-foreground">
              {pretty(step.payload)}
            </pre>
            <p className="mt-3 text-sm text-muted-foreground">{step.note}</p>
          </div>
          {stepCert ? (
            <div>
              <div className="mb-3 flex items-center gap-2 text-sm text-muted-foreground">
                <span>Moteur</span>
                <Badge
                  tone={
                    stepCert.verdict === "REPRENABLE"
                      ? "reprenable"
                      : stepCert.verdict === "PARTIEL"
                        ? "partiel"
                        : "corrompu"
                  }
                >
                  {stepCert.verdict}
                </Badge>
                <span>vérité</span>
                <Badge
                  tone={
                    step.expected === "REPRENABLE"
                      ? "reprenable"
                      : step.expected === "PARTIEL"
                        ? "partiel"
                        : "corrompu"
                  }
                >
                  {step.expected}
                </Badge>
              </div>
              <CertificateView certificate={stepCert} />
            </div>
          ) : (
            <div className="h-64 animate-pulse rounded-xl bg-card shadow-[var(--shadow-border)]" />
          )}
        </div>
      </section>

      <section className="mt-14 border-t border-border pt-10">
        <h2 className="font-display text-2xl tracking-tight">22 enveloppes</h2>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Sources indépendantes du banc de contrat. Zéro fuite sémantique
          exigée. Le faux REPRENABLE reste l'erreur critique. Seuil
          d'intérêt : au moins 15/22, et zéro faux REPRENABLE.
        </p>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <Button onClick={runBlind} disabled={busy}>
            {busy ? "Certification…" : rows ? "Relancer en aveugle" : "Certifier en aveugle"}
          </Button>
          {rows ? (
            <Button variant="outline" onClick={() => setUnsealed(true)} disabled={unsealed}>
              {unsealed ? "Vérité ouverte" : "Ouvrir la vérité terrain"}
            </Button>
          ) : null}
        </div>

        {stats ? (
          <div className="mt-5 flex flex-wrap gap-2 font-mono text-xs">
            <span className="rounded-md bg-muted px-2 py-1 text-muted-foreground">
              {stats.accuracy}% · {stats.correct}/{stats.n}
            </span>
            <span
              className={cn(
                "rounded-md px-2 py-1",
                stats.falseReprenant === 0
                  ? "bg-reprenable/15 text-reprenable"
                  : "bg-corrompu/15 text-corrompu",
              )}
            >
              faux REPRENABLE {stats.falseReprenant}
            </span>
            <span className="rounded-md bg-muted px-2 py-1 text-muted-foreground">
              faux CORROMPU {stats.falseCorrompu}
            </span>
            <span
              className={cn(
                "rounded-md px-2 py-1",
                stats.leaks === 0
                  ? "bg-reprenable/15 text-reprenable"
                  : "bg-corrompu/15 text-corrompu",
              )}
            >
              fuites {stats.leaks}
            </span>
            <span
              className={cn(
                "rounded-md px-2 py-1",
                stats.go ? "bg-reprenable/15 text-reprenable" : "bg-muted text-muted-foreground",
              )}
            >
              {stats.go ? "seuil d'intégration atteint" : "seuil d'intégration non atteint"}
            </span>
          </div>
        ) : null}

        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_0.95fr]">
          <div className="overflow-hidden rounded-xl bg-card shadow-[var(--shadow-border)]">
            <ul>
              {envelopes.map((caze, i) => {
                const row = rows?.find((r) => r.caze.id === caze.id);
                const active = selected === caze.id;
                return (
                  <li key={caze.id} className="border-b border-border last:border-0">
                    <button
                      type="button"
                      onClick={() => setSelected(caze.id)}
                      className={cn(
                        "flex w-full min-h-14 items-center gap-3 px-4 py-3 text-left",
                        active ? "bg-muted/70" : "hover:bg-muted/40",
                      )}
                    >
                      {row ? (
                        <VerdictDot verdict={row.actual} />
                      ) : (
                        <span className="inline-block size-2 rounded-full bg-border" />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm">
                          Enveloppe {String(i + 1).padStart(2, "0")} · {caze.domain}
                        </p>
                        <p className="truncate text-xs text-subtle">{caze.source}</p>
                      </div>
                      {row ? (
                        unsealed ? (
                          <Badge
                            tone={
                              row.ok
                                ? "reprenable"
                                : row.falseReprenant
                                  ? "corrompu"
                                  : "partiel"
                            }
                          >
                            {row.ok ? "accord" : row.falseReprenant ? "faux R" : "écart"}
                          </Badge>
                        ) : (
                          <span className="font-mono text-xs text-subtle">{row.actual}</span>
                        )
                      ) : (
                        <span className="font-mono text-xs text-subtle">scellé</span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="space-y-4">
            <div className="rounded-xl bg-card p-4 shadow-[var(--shadow-border)] sm:p-5">
              <p className="text-xs font-medium uppercase tracking-[0.16em] text-subtle">
                Faits disponibles
              </p>
              <pre className="mt-3 max-h-56 overflow-auto font-mono text-xs leading-relaxed text-muted-foreground">
                {pretty(selectedCase.payload)}
              </pre>
              {unsealed ? (
                <p className="mt-3 text-sm text-foreground">
                  Vérité : {selectedCase.expected}. {selectedCase.rationale}
                </p>
              ) : (
                <p className="mt-3 text-sm text-muted-foreground">
                  La vérité terrain est scellée. Le certificateur ne voit que
                  le JSON.
                </p>
              )}
            </div>
            {selectedRow ? <CertificateView certificate={selectedRow.certificate} /> : null}
          </div>
        </div>
      </section>
    </div>
  );
}
