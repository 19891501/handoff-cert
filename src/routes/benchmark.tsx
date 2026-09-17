import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CertificateView } from "@/components/cert/certificate-view";
import { VerdictDot } from "@/components/cert/stamp";
import {
  BENCH_CASES,
  certify,
  type BenchCase,
  type Certificate,
  type CaseCategory,
  type Verdict,
} from "@/lib/handoff";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/benchmark")({ component: BenchmarkPage });

type Row = {
  caze: BenchCase;
  actual: Verdict;
  certificate: Certificate;
  ok: boolean;
  falseReprenant: boolean;
};

const FILTERS: Array<{ id: "all" | CaseCategory; label: string }> = [
  { id: "all", label: "Tous" },
  { id: "positif", label: "Positifs" },
  { id: "partiel", label: "Partiels" },
  { id: "corrompu", label: "Corrompus" },
  { id: "adversarial", label: "Adversariaux" },
];

function BenchmarkPage() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["id"]>("all");
  const [selected, setSelected] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    const next: Row[] = [];
    for (const caze of BENCH_CASES) {
      const certificate = await certify(caze.payload);
      next.push({
        caze,
        actual: certificate.verdict,
        certificate,
        ok: certificate.verdict === caze.expected,
        falseReprenant:
          certificate.verdict === "REPRENABLE" && caze.expected !== "REPRENABLE",
      });
    }
    setRows(next);
    setSelected(next[0]?.caze.id ?? null);
    setBusy(false);
  }

  const visible = useMemo(() => {
    if (!rows) return [];
    if (filter === "all") return rows;
    return rows.filter((r) => r.caze.category === filter);
  }, [rows, filter]);

  const stats = useMemo(() => {
    if (!rows) return null;
    const n = rows.length;
    const correct = rows.filter((r) => r.ok).length;
    const falseReprenant = rows.filter((r) => r.falseReprenant).length;
    const falseCorrompu = rows.filter(
      (r) => r.actual === "CORROMPU" && r.caze.expected !== "CORROMPU",
    ).length;
    return {
      n,
      correct,
      accuracy: Math.round((correct / n) * 1000) / 10,
      falseReprenant,
      falseCorrompu,
    };
  }, [rows]);

  const selectedRow = rows?.find((r) => r.caze.id === selected) ?? null;

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:py-12">
      <p className="text-xs font-medium uppercase tracking-[0.22em] text-subtle">
        Banc de contrat · 24 cas · ruleset 1.0
      </p>
      <h1 className="mt-2 font-display text-4xl tracking-tight">Contrat</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
        Ces 24 cas définissent le contrat du moteur. Un 24/24 ici n'est pas
        une validation scientifique : le banc a été écrit autour des règles.
        Le faux REPRENABLE reste l'erreur critique.
      </p>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <Button onClick={run} disabled={busy}>
          {busy ? "Exécution…" : rows ? "Relancer" : "Exécuter les 24 cas"}
        </Button>
        {stats ? (
          <div className="flex flex-wrap gap-2 font-mono text-xs text-muted-foreground">
            <span className="rounded-md bg-muted px-2 py-1">
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
            <span className="rounded-md bg-muted px-2 py-1">
              faux CORROMPU {stats.falseCorrompu}
            </span>
          </div>
        ) : null}
      </div>

      {rows ? (
        <div className="mt-6 inline-flex flex-wrap gap-1 rounded-lg bg-muted p-1">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              className={cn(
                "h-10 rounded-md px-3 text-sm",
                filter === f.id
                  ? "bg-background text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      ) : null}

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_0.9fr]">
        <div className="overflow-hidden rounded-xl bg-card shadow-[var(--shadow-border)]">
          <ul>
            {(rows ? visible : BENCH_CASES.map((c) => ({ caze: c }))).map((item) => {
              const caze = item.caze;
              const row = "actual" in item ? (item as Row) : null;
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
                    <VerdictDot verdict={row?.actual ?? caze.expected} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm">{caze.title}</p>
                      <p className="truncate text-xs text-subtle">
                        {caze.framework} · {caze.category}
                      </p>
                    </div>
                    {row ? (
                      <Badge tone={row.ok ? "reprenable" : "corrompu"}>
                        {row.ok ? "OK" : row.falseReprenant ? "faux R" : "écart"}
                      </Badge>
                    ) : (
                      <span className="font-mono text-xs text-subtle">{caze.expected}</span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        <div>
          {selectedRow ? (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">{selectedRow.caze.description}</p>
              <CertificateView certificate={selectedRow.certificate} />
            </div>
          ) : (
            <div className="rounded-xl bg-card p-6 text-sm text-muted-foreground shadow-[var(--shadow-border)]">
              Lancez le banc pour certifier chaque cas avec le moteur réel — pas des
              verdicts figés.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
