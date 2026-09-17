import { useState } from "react";
import type { Certificate, Verdict } from "@/lib/handoff";
import { toPublicCertificate } from "@/lib/handoff";
import { cn, pretty, truncateHash } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { VerdictStamp } from "./stamp";
import { Check, Copy } from "lucide-react";

const TONE: Record<Verdict, "reprenable" | "partiel" | "corrompu"> = {
  REPRENABLE: "reprenable",
  PARTIEL: "partiel",
  CORROMPU: "corrompu",
};

export function CertificateView({ certificate }: { certificate: Certificate }) {
  const [copied, setCopied] = useState(false);
  const pub = toPublicCertificate(certificate);

  async function copy() {
    await navigator.clipboard.writeText(pretty(pub));
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  }

  return (
    <article className="rounded-xl bg-card p-4 shadow-[var(--shadow-border)] sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-subtle">
            Certificat {certificate.ruleset}
          </p>
          <h2 className="mt-1 font-display text-2xl tracking-tight">{certificate.verdict}</h2>
        </div>
        <Badge tone={TONE[certificate.verdict]}>{certificate.verdict}</Badge>
      </div>

      <div className="mt-6 flex flex-col items-center gap-5 sm:flex-row sm:items-start sm:gap-8">
        <VerdictStamp verdict={certificate.verdict} />
        <dl className="grid flex-1 grid-cols-1 gap-3 text-sm sm:grid-cols-2">
          <Meta label="Identifiant" value={certificate.certificate_id} mono />
          <Meta
            label="Mesure interne"
            value={certificate.confidence.toFixed(2)}
            hint="Le produit vend le verdict, pas le score."
            mono
          />
          <Meta label="Entrée" value={truncateHash(certificate.input_hash, 14)} mono />
          <Meta label="Émis" value={new Date(certificate.issued_at).toLocaleString("fr-FR")} />
          {certificate.from ? <Meta label="De" value={certificate.from} mono /> : null}
          {certificate.to ? <Meta label="Vers" value={certificate.to} mono /> : null}
        </dl>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <ListBlock title="Manques" items={certificate.missing} empty="Aucun" />
        <ListBlock title="Conflits" items={certificate.conflicts} empty="Aucun" tone="corrompu" />
        <ListBlock title="Avertissements" items={certificate.warnings} empty="Aucun" />
      </div>

      {certificate.findings.length > 0 ? (
        <div className="mt-6">
          <h3 className="text-[11px] font-medium uppercase tracking-[0.18em] text-subtle">
            Constatations
          </h3>
          <ul className="mt-2 divide-y divide-border">
            {certificate.findings.map((f, i) => (
              <li key={`${f.code}-${i}`} className="flex gap-3 py-2.5 text-sm">
                <Badge
                  tone={
                    f.severity === "critical"
                      ? "corrompu"
                      : f.severity === "error"
                        ? "partiel"
                        : "default"
                  }
                  className="mt-0.5 h-5 shrink-0"
                >
                  {f.severity}
                </Badge>
                <span className="text-foreground/90">{f.message}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="mt-6 text-sm text-muted-foreground">
          Aucune constatation. Le paquet est reprenable selon le ruleset 1.0.
        </p>
      )}

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
        <p className="font-mono text-[11px] text-subtle">
          {certificate.issuer} · {certificate.ruleset_hash.slice(0, 19)}…
        </p>
        <Button variant="outline" size="sm" onClick={copy}>
          {copied ? <Check /> : <Copy />}
          {copied ? "Copié" : "Copier le JSON"}
        </Button>
      </div>
    </article>
  );
}

function Meta({
  label,
  value,
  mono,
  hint,
}: {
  label: string;
  value: string;
  mono?: boolean;
  hint?: string;
}) {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-[0.16em] text-subtle">{label}</dt>
      <dd className={cn("mt-0.5 text-foreground", mono && "font-mono text-[13px]")}>{value}</dd>
      {hint ? <p className="mt-0.5 text-[11px] text-subtle">{hint}</p> : null}
    </div>
  );
}

function ListBlock({
  title,
  items,
  empty,
  tone,
}: {
  title: string;
  items: string[];
  empty: string;
  tone?: "corrompu";
}) {
  return (
    <div className="rounded-lg bg-muted/60 p-3">
      <h3 className="text-[11px] font-medium uppercase tracking-[0.16em] text-subtle">{title}</h3>
      {items.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ul className="mt-2 space-y-1.5">
          {items.map((item) => (
            <li
              key={item}
              className={cn(
                "text-sm leading-snug",
                tone === "corrompu" ? "text-corrompu" : "text-foreground/90",
              )}
            >
              {item}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function ProofChain({
  claims,
}: {
  claims: Array<{
    claim: string;
    evidenceId?: string;
    source?: string;
    timestamp?: string;
    linked: boolean;
  }>;
}) {
  if (claims.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Aucune affirmation. Un démarrage honnête n'est pas une corruption.
      </p>
    );
  }
  return (
    <ol className="space-y-3">
      {claims.map((c, i) => (
        <li key={`${c.claim}-${i}`} className="rounded-lg bg-muted/60 p-3">
          <p className="text-sm text-foreground">{c.claim}</p>
          <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px] font-mono text-muted-foreground">
            <ChainNode ok={c.linked} label="preuve" value={c.evidenceId ?? "—"} />
            <span className="text-subtle">→</span>
            <ChainNode ok={Boolean(c.source)} label="source" value={c.source ?? "—"} />
            <span className="text-subtle">→</span>
            <ChainNode ok={Boolean(c.timestamp)} label="horodatage" value={c.timestamp ?? "—"} />
          </div>
        </li>
      ))}
    </ol>
  );
}

function ChainNode({ ok, label, value }: { ok: boolean; label: string; value: string }) {
  return (
    <span className={cn("rounded-sm px-1.5 py-0.5", ok ? "bg-reprenable/10 text-reprenable" : "bg-background text-subtle")}>
      <span className="mr-1 uppercase tracking-wider opacity-70">{label}</span>
      {value}
    </span>
  );
}
