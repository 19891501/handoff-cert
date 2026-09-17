import { useMemo, useState, type ReactNode } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { CertificateView, ProofChain } from "@/components/cert/certificate-view";
import { BENCH_CASES, certify, verify, type Certificate } from "@/lib/handoff";
import { proofFromPayload } from "@/lib/handoff/proof";
import { pretty, cn } from "@/lib/utils";

export const Route = createFileRoute("/certify")({ component: CertifyPage });

const DEFAULT = pretty(BENCH_CASES[0]?.payload ?? {});

function CertifyPage() {
  const [tab, setTab] = useState<"certify" | "verify">("certify");
  const [sampleId, setSampleId] = useState(BENCH_CASES[0]?.id ?? "");
  const [text, setText] = useState(DEFAULT);
  const [cert, setCert] = useState<Certificate | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [verifyText, setVerifyText] = useState("");
  const [verifyNote, setVerifyNote] = useState<string | null>(null);

  const parsed = useMemo(() => {
    try {
      return { ok: true as const, value: JSON.parse(text) as unknown };
    } catch (e) {
      return { ok: false as const, error: e instanceof Error ? e.message : "JSON invalide" };
    }
  }, [text]);

  const chain = parsed.ok ? proofFromPayload(parsed.value) : [];

  async function runCertify() {
    if (!parsed.ok) {
      setError(parsed.error);
      setCert(null);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await certify(parsed.value);
      setCert(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Certification impossible");
    } finally {
      setBusy(false);
    }
  }

  async function runVerify() {
    if (!parsed.ok) {
      setVerifyNote(parsed.error);
      return;
    }
    let offered: Certificate;
    try {
      offered = JSON.parse(verifyText) as Certificate;
    } catch {
      setVerifyNote("Le certificat n'est pas un JSON valide.");
      return;
    }
    const result = await verify(parsed.value, offered);
    if (result.valid) {
      setVerifyNote("Valide. Empreinte, verdict et ruleset correspondent.");
    } else {
      const parts = [
        result.input_match ? null : "empreinte d'entrée divergente",
        result.verdict_match ? null : "verdict divergente",
        result.ruleset_match ? null : "ruleset divergent",
      ].filter(Boolean);
      setVerifyNote(`Invalidé : ${parts.join(", ")}.`);
    }
    setCert(result.recomputed);
  }

  function loadSample(id: string) {
    const c = BENCH_CASES.find((x) => x.id === id);
    if (!c) return;
    setSampleId(id);
    setText(pretty(c.payload));
    setCert(null);
    setError(null);
  }

  function formatJson() {
    if (!parsed.ok) return;
    setText(pretty(parsed.value));
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:py-12">
      <p className="text-xs font-medium uppercase tracking-[0.22em] text-subtle">
        POST /v1/certify
      </p>
      <h1 className="mt-2 font-display text-4xl tracking-tight">Certifier</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
        Collez un paquet de transfert. Le moteur normalise, relie les
        affirmations aux preuves, et rend un verdict fail-closed.
      </p>

      <div className="mt-6 inline-flex rounded-lg bg-muted p-1">
        <TabButton active={tab === "certify"} onClick={() => setTab("certify")}>
          Certifier
        </TabButton>
        <TabButton active={tab === "verify"} onClick={() => setTab("verify")}>
          Vérifier
        </TabButton>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <label className="sr-only" htmlFor="sample">
              Exemple
            </label>
            <select
              id="sample"
              value={sampleId}
              onChange={(e) => loadSample(e.target.value)}
              className="h-11 min-w-0 flex-1 rounded-md bg-card px-3 text-sm shadow-[var(--shadow-border)] outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
            >
              {BENCH_CASES.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title} · {c.expected}
                </option>
              ))}
            </select>
            <Button variant="outline" onClick={formatJson}>
              Formater
            </Button>
          </div>
          <textarea
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setError(null);
            }}
            spellCheck={false}
            className="min-h-[28rem] w-full rounded-xl bg-card p-4 font-mono text-xs leading-relaxed text-foreground shadow-[var(--shadow-border)] outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
            aria-label="Paquet JSON"
          />
          {!parsed.ok ? (
            <p className="mt-2 text-sm text-corrompu">{parsed.error}</p>
          ) : null}
          <div className="mt-3 flex flex-wrap gap-2">
            <Button onClick={tab === "certify" ? runCertify : runVerify} disabled={busy}>
              {busy ? "Calcul…" : tab === "certify" ? "Émettre le certificat" : "Vérifier le certificat"}
            </Button>
            {error ? <p className="self-center text-sm text-corrompu">{error}</p> : null}
          </div>

          {tab === "verify" ? (
            <div className="mt-4">
              <label htmlFor="cert-json" className="text-xs uppercase tracking-[0.16em] text-subtle">
                Certificat à vérifier
              </label>
              <textarea
                id="cert-json"
                value={verifyText}
                onChange={(e) => setVerifyText(e.target.value)}
                spellCheck={false}
                placeholder='{"verdict":"REPRENABLE","certificate_id":"hc_…"}'
                className="mt-2 min-h-40 w-full rounded-xl bg-card p-4 font-mono text-xs leading-relaxed shadow-[var(--shadow-border)] outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
              />
              {verifyNote ? (
                <p className="mt-2 text-sm text-muted-foreground">{verifyNote}</p>
              ) : null}
            </div>
          ) : null}

          {parsed.ok ? (
            <div className="mt-6">
              <h2 className="text-xs font-medium uppercase tracking-[0.18em] text-subtle">
                Chaîne de preuve
              </h2>
              <div className="mt-3">
                <ProofChain claims={chain} />
              </div>
            </div>
          ) : null}
        </section>

        <section className="lg:sticky lg:top-20 lg:self-start">
          {cert ? (
            <CertificateView certificate={cert} />
          ) : (
            <div className="flex min-h-80 items-center rounded-xl bg-card p-6 shadow-[var(--shadow-border)]">
              <p className="max-w-sm text-sm text-muted-foreground">
                Le certificat apparaîtra ici. Trois résultats publics :
                REPRENABLE, PARTIEL, CORROMPU.
              </p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "h-10 rounded-md px-4 text-sm transition-colors duration-150",
        active ? "bg-background text-foreground" : "text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}
