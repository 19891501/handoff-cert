import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  FAIL_TOKENS,
  MARKER_FIXTURES,
  SUCCESS_TOKENS,
  langOf,
  scanText,
  scanValue,
} from "@/lib/bench/markers";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/marqueurs")({ component: MarqueursPage });

function MarqueursPage() {
  const [fixture, setFixture] = useState(MARKER_FIXTURES[0]!.id);
  const current = MARKER_FIXTURES.find((f) => f.id === fixture)!;
  const scan = useMemo(() => {
    if (typeof current.value === "string") return scanText(current.value);
    return scanValue(current.value);
  }, [current]);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:py-12">
      <p className="text-xs font-medium uppercase tracking-[0.22em] text-subtle">
        V0 gelé · tokens EN+FR · pas de retune
      </p>
      <h1 className="mt-2 font-display text-4xl tracking-tight">Marqueurs</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
        V0 lit des mots, pas des types. EN et FR sont dans la même liste. Un
        repli « absentes » n'est pas un paquet. Ajouter un token serait
        dégeler le juge.
      </p>

      <div className="mt-6 flex flex-wrap gap-2">
        {MARKER_FIXTURES.map((f) => (
          <Button
            key={f.id}
            variant={fixture === f.id ? "default" : "outline"}
            onClick={() => setFixture(f.id)}
          >
            {f.title}
          </Button>
        ))}
      </div>

      <article className="mt-6 rounded-xl bg-card p-5 shadow-[var(--shadow-border)]">
        <p className="font-mono text-xs text-subtle">{scan.folded || "(vide)"}</p>
        <p className="mt-2 text-sm">{typeof current.value === "string" ? current.value : "objet"}</p>
        <p className="mt-2 font-mono text-xs text-subtle">
          visible: {scan.visible.length ? scan.visible.join(" · ") : "rien — booléens ignorés"}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Badge
            tone={
              scan.polarity === "fail"
                ? "corrompu"
                : scan.polarity === "success"
                  ? "reprenable"
                  : "default"
            }
          >
            {scan.polarity}
          </Badge>
          {scan.success.map((t) => (
            <span key={`s-${t}`} className="font-mono text-xs text-reprenable">
              +{t} ({langOf(t)})
            </span>
          ))}
          {scan.fail.map((t) => (
            <span key={`f-${t}`} className="font-mono text-xs text-corrompu">
              −{t} ({langOf(t)})
            </span>
          ))}
        </div>
      </article>

      <div className="mt-8 grid gap-4 lg:grid-cols-2">
        <TokenList title="Succès" tokens={SUCCESS_TOKENS} active={scan.success} />
        <TokenList title="Échec" tokens={FAIL_TOKENS} active={scan.fail} />
      </div>

      <p className="mt-8 max-w-2xl text-sm text-muted-foreground">
        Préfixe : un mot de ≥4 lettres matche s'il commence par le token.
        « successful » touche success. « succeeded » ne touche rien. « false »
        ne touche pas fail — ni comme mot, ni comme booléen (invisible). Ajouter
        ces formes dégelerait V0.
      </p>
    </div>
  );
}

function TokenList({
  title,
  tokens,
  active,
}: {
  title: string;
  tokens: readonly string[];
  active: string[];
}) {
  return (
    <article className="rounded-xl bg-card p-5 shadow-[var(--shadow-border)]">
      <p className="text-xs font-medium uppercase tracking-[0.16em] text-subtle">{title}</p>
      <ul className="mt-3 flex flex-wrap gap-2">
        {tokens.map((t) => (
          <li
            key={t}
            className={cn(
              "font-mono text-xs",
              active.includes(t) ? "text-foreground" : "text-subtle",
            )}
          >
            {t}
            <span className="ml-1 text-[10px] uppercase">{langOf(t)}</span>
          </li>
        ))}
      </ul>
    </article>
  );
}
