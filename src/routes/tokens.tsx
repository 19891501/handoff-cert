import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CLAIM_ONLY_OK, FAMILIES, STATUS_ONLY, TOKEN_TYPES, type TokenFamily } from "@/lib/bench/tokens";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/tokens")({ component: TokensPage });

function TokensPage() {
  const [family, setFamily] = useState<TokenFamily>("claim-success");
  const current = FAMILIES.find((f) => f.id === family)!;
  const list = TOKEN_TYPES.filter((t) => t.family === family);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:py-12">
      <p className="text-xs font-medium uppercase tracking-[0.22em] text-subtle">
        V0 gelé · quatre familles · pas de retune
      </p>
      <h1 className="mt-2 font-display text-4xl tracking-tight">Tokens</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
        Le juge n'a pas de types de pièces. Il a des familles de mots.
        Claim scanne avec préfixe. Status matche exact et court-circuite le
        contenu.
      </p>

      <div className="mt-6 flex flex-wrap gap-2">
        {FAMILIES.map((f) => (
          <Button
            key={f.id}
            variant={family === f.id ? "default" : "outline"}
            onClick={() => setFamily(f.id)}
          >
            {f.title}
          </Button>
        ))}
      </div>

      <article className="mt-6 rounded-xl bg-card p-5 shadow-[var(--shadow-border)]">
        <Badge tone="default">{current.match}</Badge>
        <h2 className="mt-3 font-display text-2xl tracking-tight">{current.title}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{current.body}</p>
        <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-2">
          {list.map((t) => (
            <li
              key={`${t.family}-${t.token}`}
              className={cn("font-mono text-xs", t.lang === "fr" ? "text-foreground" : "text-subtle")}
            >
              {t.token}
              <span className="ml-1 text-[10px] uppercase">{t.lang}</span>
            </li>
          ))}
        </ul>
      </article>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <article className="rounded-xl bg-card p-5 shadow-[var(--shadow-border)]">
          <p className="text-xs uppercase tracking-[0.16em] text-subtle">Status seulement</p>
          <p className="mt-2 font-mono text-xs">{STATUS_ONLY.join(" · ") || "—"}</p>
          <p className="mt-2 text-sm text-muted-foreground">
            <span className="font-mono text-xs">status: true</span> est OK.
            La claim « true » n'a pas de polarité.
          </p>
        </article>
        <article className="rounded-xl bg-card p-5 shadow-[var(--shadow-border)]">
          <p className="text-xs uppercase tracking-[0.16em] text-subtle">Claim seulement</p>
          <p className="mt-2 font-mono text-xs">{CLAIM_ONLY_OK.join(" · ")}</p>
          <p className="mt-2 text-sm text-muted-foreground">
            « confirmé » polarise la claim. Un status{" "}
            <span className="font-mono text-xs">confirme</span> n'est pas
            dans OK_STATUS.
          </p>
        </article>
      </div>
    </div>
  );
}
