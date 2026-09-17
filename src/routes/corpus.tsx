import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CertificateView } from "@/components/cert/certificate-view";
import { VerdictDot } from "@/components/cert/stamp";
import {
  certify,
  orderedCorpus,
  scanLeaks,
  type Certificate,
  type CorpusCase,
  type Verdict,
} from "@/lib/handoff";
import { cn, pretty } from "@/lib/utils";

export const Route = createFileRoute("/corpus")({ component: CorpusPage });

type Row = {
  caze: CorpusCase;
  actual: Verdict;
  certificate: Certificate;
  leaks: string[];
  ok: boolean;
  falseReprenant: boolean;
};

const PIPE = [
  "Source réelle",
  "Faits observables",
  "Enveloppe",
  "HANDOFF CERT V0",
  "Verdict",
  "Vérité, après",
];

function CorpusPage() {
  const envelopes = useMemo(() => orderedCorpus(), []);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [unsealed, setUnsealed] = useState(false);
  const [selected, setSelected] = useState<string>(envelopes[0]!.id);

  async function run() {
    setBusy(true);
    setUnsealed(false);
    const next: Row[] = [];
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
    return {
      n,
      correct,
      accuracy: Math.round((correct / n) * 1000) / 10,
      leaks,
      falseReprenant,
      falseCorrompu,
      go: correct >= 15 && falseReprenant === 0 && leaks === 0,
    };
  }, [rows]);

  const selectedCase = envelopes.find((c) => c.id === selected) ?? envelopes[0]!;
  const selectedRow = rows?.find((r) => r.caze.id === selected);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:py-12">
      <p className="text-xs font-medium uppercase tracking-[0.22em] text-subtle">
        V0.2 · corpus externe · moteur gelé
      </p>
      <h1 className="mt-2 font-display text-4xl tracking-tight">Corpus</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
        GitHub, CrewAI, LangGraph, Microsoft Agent Framework, Stripe. Extraire
        des faits, envelopper, certifier — puis seulement comparer. Le V0 ne
        bouge pas. S'il se trompe, c'est le résultat.
      </p>

      <ol className="mt-8 grid gap-2 sm:grid-cols-6">
        {PIPE.map((step, i) => (
          <li
            key={step}
            className="rounded-xl bg-card px-3 py-3 shadow-[var(--shadow-border)]"
          >
            <p className="font-mono text-xs text-subtle">{String(i + 1).padStart(2, "0")}</p>
            <p className="mt-1 text-sm">{step}</p>
          </li>
        ))}
      </ol>

      <div className="mt-8 flex flex-wrap items-center gap-3">
        <Button onClick={run} disabled={busy}>
          {busy ? "Certification…" : rows ? "Relancer le corpus" : "Certifier le corpus"}
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

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_1fr]">
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
                        {String(i + 1).padStart(2, "0")} · {caze.framework}
                      </p>
                      <p className="truncate text-xs text-subtle">{caze.title}</p>
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
          <article className="rounded-xl bg-card p-4 shadow-[var(--shadow-border)] sm:p-5">
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-subtle">
              Source
            </p>
            <a
              href={selectedCase.url}
              target="_blank"
              rel="noreferrer"
              className="mt-2 block text-sm underline-offset-4 hover:underline"
            >
              {selectedCase.url.replace(/^https?:\/\//, "")}
            </a>
            <pre className="mt-3 max-h-40 overflow-auto font-mono text-xs leading-relaxed text-muted-foreground">
              {selectedCase.excerpt}
            </pre>
            <p className="mt-3 text-xs font-medium uppercase tracking-[0.16em] text-subtle">
              Faits extraits
            </p>
            <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
              {selectedCase.facts.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-subtle">{selectedCase.adapter}</p>
          </article>

          <div className="rounded-xl bg-card p-4 shadow-[var(--shadow-border)] sm:p-5">
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-subtle">
              Enveloppe
            </p>
            <pre className="mt-3 max-h-48 overflow-auto font-mono text-xs leading-relaxed text-muted-foreground">
              {pretty(selectedCase.payload)}
            </pre>
            {unsealed ? (
              <p className="mt-3 text-sm text-foreground">
                Vérité : {selectedCase.expected}. {selectedCase.rationale}
              </p>
            ) : (
              <p className="mt-3 text-sm text-muted-foreground">
                La vérité terrain est scellée. Le certificateur ne voit que
                l'enveloppe.
              </p>
            )}
          </div>

          {selectedRow ? <CertificateView certificate={selectedRow.certificate} /> : null}
        </div>
      </div>
    </div>
  );
}
