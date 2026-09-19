import type { ReactNode } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/", label: "Accueil" },
  { to: "/cap", label: "Cap" },
  { to: "/prix", label: "Prix" },
  { to: "/offre", label: "Offre" },
  { to: "/verdict", label: "Verdict" },
  { to: "/attaque", label: "Attaque" },
] as const;

export function Shell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-20 border-b border-border/80 bg-background/85 backdrop-blur-sm">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-4 py-3 sm:h-16 sm:flex-row sm:items-center sm:justify-between sm:gap-6 sm:py-0">
          <Link to="/" className="flex min-h-11 items-center gap-2.5">
            <span className="font-display text-xl leading-none tracking-tight">
              HANDOFF
            </span>
            <span className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
              Cert
            </span>
          </Link>
          <nav className="flex flex-wrap items-center gap-1 pb-1 sm:pb-0">
            {NAV.map((item) => {
              const active =
                item.to === "/"
                  ? pathname === "/"
                  : pathname === item.to || pathname.startsWith(`${item.to}/`);
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={cn(
                    "inline-flex h-11 items-center px-3 text-sm transition-colors duration-150",
                    active
                      ? "text-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="border-t border-border/80">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-1 px-4 py-5 text-xs text-subtle sm:flex-row sm:items-center sm:justify-between">
          <p>Verdict final · V0 gelé · 4 KFP</p>
          <p className="flex flex-wrap gap-x-3 gap-y-1">
            <Link to="/verdict" className="hover:text-foreground">
              Verdict
            </Link>
            <Link to="/prix" className="hover:text-foreground">
              Prix
            </Link>
            <Link to="/tests" className="hover:text-foreground">
              Tests
            </Link>
            <Link to="/corpus" className="hover:text-foreground">
              Corpus
            </Link>
            <Link to="/classes" className="hover:text-foreground">
              Classes
            </Link>
            <Link to="/marqueurs" className="hover:text-foreground">
              Marqueurs
            </Link>
            <Link to="/tokens" className="hover:text-foreground">
              Tokens
            </Link>
            <Link to="/attaque" className="hover:text-foreground">
              Attaque
            </Link>
            <Link to="/goto" className="hover:text-foreground">
              Goto
            </Link>
            <Link to="/patterns" className="hover:text-foreground">
              Motifs
            </Link>
            <Link to="/format" className="hover:text-foreground">
              Format
            </Link>
            <Link to="/sha" className="hover:text-foreground">
              SHA
            </Link>
            <Link to="/rules" className="hover:text-foreground">
              Moteur
            </Link>
          </p>
        </div>
      </footer>
    </div>
  );
}
