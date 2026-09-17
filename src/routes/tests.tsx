import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { runSuite, tally, type CheckResult } from "@/lib/tests/suite";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/tests")({ component: TestsPage });

function TestsPage() {
  const [rows, setRows] = useState<CheckResult[] | null>(null);
  const [busy, setBusy] = useState(false);

  async function run() {
    setBusy(true);
    const next = await runSuite();
    setRows(next);
    setBusy(false);
  }

  useEffect(() => {
    void run();
  }, []);

  const t = rows ? tally(rows) : null;
  const groups = rows
    ? [...new Set(rows.map((r) => r.group))]
    : [];

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:py-12">
      <p className="text-xs font-medium uppercase tracking-[0.22em] text-subtle">
        Suite · fail-closed · faux REPRENABLE = critique
      </p>
      <h1 className="mt-2 font-display text-4xl tracking-tight">Tests</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
        Même suite que le banc machine. Un échec critique est un faux
        REPRENABLE : la machine continuerait.
      </p>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <Button onClick={() => void run()} disabled={busy}>
          Relancer
        </Button>
        {t ? (
          <>
            <Badge tone={t.fail === 0 ? "reprenable" : "corrompu"}>
              {t.ok}/{t.n}
            </Badge>
            <span className="text-sm text-muted-foreground">
              Faux REPRENABLE : {t.falseSafe}
            </span>
          </>
        ) : (
          <span className="text-sm text-muted-foreground">Exécution…</span>
        )}
      </div>

      {groups.map((g) => (
        <section key={g} className="mt-8">
          <h2 className="font-display text-xl tracking-tight">{g}</h2>
          <div className="mt-3 overflow-hidden rounded-xl bg-card shadow-[var(--shadow-border)]">
            <table className="w-full text-left text-sm">
              <tbody>
                {rows
                  ?.filter((r) => r.group === g)
                  .map((r) => (
                    <tr key={r.id} className="border-b border-border last:border-0">
                      <td className="px-4 py-3">{r.name}</td>
                      <td className="px-4 py-3 text-right">
                        <span
                          className={cn(
                            "font-mono text-xs",
                            r.ok ? "text-reprenable" : "text-corrompu",
                          )}
                        >
                          {r.ok ? "PASS" : r.critical ? "FAUX R" : "FAIL"}
                        </span>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
          {rows?.some((r) => r.group === g && r.error) ? (
            <p className="mt-2 font-mono text-xs text-corrompu">
              {rows.find((r) => r.group === g && r.error)?.error}
            </p>
          ) : null}
        </section>
      ))}
    </div>
  );
}
