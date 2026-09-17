import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn, pretty } from "@/lib/utils";
import {
  PROPERTIES,
  runProperty,
  type PropertyResult,
} from "@/lib/invariants/properties";

export const Route = createFileRoute("/invariants")({ component: InvariantsPage });

function InvariantsPage() {
  const [rows, setRows] = useState<PropertyResult[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [cursor, setCursor] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setRows(null);
    const next: PropertyResult[] = [];
    for (const def of PROPERTIES) {
      setCursor(def.id);
      const result = await runProperty(def);
      next.push(result);
      setRows([...next]);
    }
    setCursor(null);
    setSelected(next.find((r) => r.failure)?.def.id ?? next[0]?.def.id ?? null);
    setBusy(false);
  }

  const stats = useMemo(() => {
    if (!rows || rows.length < PROPERTIES.length) return null;
    const n = rows.length;
    const broken = rows.filter((r) => r.failure).length;
    const falseSafe = rows.filter(
      (r) => r.failure?.note.toLowerCase().includes("false safe"),
    ).length;
    return { n, broken, falseSafe };
  }, [rows]);

  const selectedRow = rows?.find((r) => r.def.id === selected) ?? null;

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:py-12">
      <p className="text-xs font-medium uppercase tracking-[0.22em] text-subtle">
        Property-based testing · Hypothesis-style · HMAC prototype
      </p>
      <h1 className="mt-2 font-display text-4xl tracking-tight">Invariants</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
        Les résultats attendus sont écrits avant l'exécution. Un générateur
        produit des payloads, des mutations, des paquets. Si un invariant
        casse, on s'arrête sur le contre-exemple. HMAC est un prototype, pas
        Ed25519.
      </p>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <Button onClick={run} disabled={busy}>
          {busy ? `Attaque ${cursor ?? "…"}` : rows ? "Relancer la batterie" : "Attaquer les invariants"}
        </Button>
        {stats ? (
          <div className="flex flex-wrap gap-2 font-mono text-xs">
            <span className="rounded-md bg-muted px-2 py-1 text-muted-foreground">
              {stats.n - stats.broken}/{stats.n} tenus
            </span>
            <span
              className={cn(
                "rounded-md px-2 py-1",
                stats.falseSafe === 0
                  ? "bg-reprenable/15 text-reprenable"
                  : "bg-corrompu/15 text-corrompu",
              )}
            >
              False Safe {stats.falseSafe}
            </span>
          </div>
        ) : null}
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_0.95fr]">
        <div className="overflow-hidden rounded-xl bg-card shadow-[var(--shadow-border)]">
          <ul>
            {PROPERTIES.map((def) => {
              const row = rows?.find((r) => r.def.id === def.id);
              const active = selected === def.id;
              const running = busy && cursor === def.id;
              return (
                <li key={def.id} className="border-b border-border last:border-0">
                  <button
                    type="button"
                    onClick={() => setSelected(def.id)}
                    className={cn(
                      "flex w-full min-h-14 items-center gap-3 px-4 py-3 text-left",
                      active ? "bg-muted/70" : "hover:bg-muted/40",
                    )}
                  >
                    <span className="w-8 font-mono text-xs text-subtle">{def.id}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm">{def.title}</p>
                      <p className="truncate text-xs text-subtle">
                        {def.layer} · {def.expected}
                      </p>
                    </div>
                    {row ? (
                      <Badge tone={row.failure ? "corrompu" : "reprenable"}>
                        {row.failure ? "cassé" : `${row.passed}/${def.trials}`}
                      </Badge>
                    ) : running ? (
                      <span className="font-mono text-xs text-subtle">en cours</span>
                    ) : (
                      <span className="font-mono text-xs text-subtle">{def.trials}</span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="space-y-4">
          {selectedRow ? (
            <>
              <article className="rounded-xl bg-card p-5 shadow-[var(--shadow-border)]">
                <p className="text-xs font-medium uppercase tracking-[0.16em] text-subtle">
                  Attendu, avant exécution
                </p>
                <h2 className="mt-2 font-display text-2xl tracking-tight">
                  {selectedRow.def.title}
                </h2>
                <p className="mt-2 text-sm text-muted-foreground">{selectedRow.def.expected}</p>
                {selectedRow.failure ? (
                  <p className="mt-4 text-sm text-corrompu">{selectedRow.failure.note}</p>
                ) : (
                  <p className="mt-4 text-sm text-reprenable">
                    {selectedRow.passed} essais. Aucun contre-exemple.
                  </p>
                )}
              </article>
              {selectedRow.failure ? (
                <div className="rounded-xl bg-card p-5 shadow-[var(--shadow-border)]">
                  <p className="text-xs font-medium uppercase tracking-[0.16em] text-subtle">
                    Contre-exemple · seed {selectedRow.failure.seed}
                  </p>
                  <pre className="mt-3 max-h-72 overflow-auto font-mono text-xs leading-relaxed text-muted-foreground">
                    {pretty({
                      before: selectedRow.failure.before,
                      after: selectedRow.failure.after,
                      note: selectedRow.failure.note,
                    })}
                  </pre>
                </div>
              ) : null}
            </>
          ) : (
            <div className="rounded-xl bg-card p-6 text-sm text-muted-foreground shadow-[var(--shadow-border)]">
              La batterie n'invente pas INTACT. Elle cherche le False Safe :
              une divergence classée sûre.
            </div>
          )}
        </div>
      </div>

      <section className="mt-12 max-w-2xl">
        <h2 className="font-display text-2xl tracking-tight">Deux couches, jamais mélangées</h2>
        <p className="mt-3 text-sm text-muted-foreground">
          I1–I6 attaquent l'engagement : canonicalize → HMAC → verify. Un
          mensonge signé et reçu tel quel est INTACT. C'est un succès.
        </p>
        <p className="mt-3 text-sm text-muted-foreground">
          C1–C4 attaquent le juge de continuation, gelé. Retirer les preuves ou
          lier un FAIL à un succès ne doit jamais produire REPRENABLE.
        </p>
      </section>
    </div>
  );
}
