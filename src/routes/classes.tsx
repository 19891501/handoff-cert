import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FAILURE_CLASSES, FAMILY_LABEL } from "@/lib/bench/classes";
import { KNOWN_FALSE } from "@/lib/bench/falsify";

export const Route = createFileRoute("/classes")({ component: ClassesPage });

function ClassesPage() {
  const [id, setId] = useState(FAILURE_CLASSES[0]!.id);
  const current = FAILURE_CLASSES.find((c) => c.id === id)!;
  const instance = KNOWN_FALSE.find((k) => k.classId === current.id);
  const occupied = useMemo(
    () => FAILURE_CLASSES.filter((c) => c.kfp).length,
    [],
  );

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:py-12">
      <p className="text-xs font-medium uppercase tracking-[0.22em] text-subtle">
        Taxonomie · {occupied} occupées · pas de KFP-005
      </p>
      <h1 className="mt-2 font-display text-4xl tracking-tight">Classes</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
        Une classe est un mécanisme, pas un cas. Les cases vides restent vides
        jusqu'à un paquet réel. On n'invente pas un cinquième faux
        positif pour remplir le tableau.
      </p>

      <div className="mt-6 flex flex-wrap gap-2">
        {FAILURE_CLASSES.map((c) => (
          <Button
            key={c.id}
            variant={id === c.id ? "default" : "outline"}
            onClick={() => setId(c.id)}
          >
            {c.kfp ? c.kfp : "vide"}
            <span className="ml-2 font-sans font-normal text-xs opacity-80">
              {c.title}
            </span>
          </Button>
        ))}
      </div>

      <article className="mt-8 rounded-xl bg-card p-5 shadow-[var(--shadow-border)]">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={current.kfp ? "corrompu" : "default"}>
            {FAMILY_LABEL[current.family]}
          </Badge>
          <span className="font-mono text-xs text-subtle">{current.id}</span>
        </div>
        <h2 className="mt-4 font-display text-2xl tracking-tight">{current.title}</h2>
        <p className="mt-3 text-sm text-muted-foreground">{current.mechanism}</p>
        {instance ? (
          <p className="mt-4 text-sm">
            Instance : {instance.tag} ({instance.id}).{" "}
            <Link to="/falsify" className="underline underline-offset-4">
              Dossier
            </Link>
          </p>
        ) : (
          <p className="mt-4 font-mono text-xs text-subtle">{current.emptyWhy}</p>
        )}
      </article>

      <div className="mt-8 overflow-hidden rounded-xl bg-card shadow-[var(--shadow-border)]">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border text-xs uppercase tracking-[0.14em] text-subtle">
              <th className="px-4 py-3 font-medium">Classe</th>
              <th className="px-4 py-3 font-medium">Famille</th>
              <th className="px-4 py-3 font-medium">Occupation</th>
            </tr>
          </thead>
          <tbody>
            {FAILURE_CLASSES.map((c) => (
              <tr
                key={c.id}
                className="cursor-pointer border-b border-border last:border-0"
                onClick={() => setId(c.id)}
              >
                <td className="px-4 py-3">
                  <span className="font-mono text-xs">{c.id}</span>
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {FAMILY_LABEL[c.family]}
                </td>
                <td className="px-4 py-3 font-mono text-xs">
                  {c.kfp ?? "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
