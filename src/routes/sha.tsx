import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  MUTATIONS,
  SAMPLE_STATE,
  SHA_ALGOS,
  bytesOf,
  canonOf,
  hammingBits,
  shaAll,
  type ShaId,
} from "@/lib/format/sha";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/sha")({ component: ShaPage });

function ShaPage() {
  const [mutation, setMutation] = useState("same");
  const [base, setBase] = useState<Record<ShaId, string> | null>(null);
  const [next, setNext] = useState<Record<ShaId, string> | null>(null);
  const [canon, setCanon] = useState("");

  const payload = MUTATIONS.find((m) => m.id === mutation)!.apply(SAMPLE_STATE);
  const encoded = canonOf(mutation, payload);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const original = canonOf("same", SAMPLE_STATE).text;
      const a = await shaAll(original);
      const b = mutation === "same" ? a : await shaAll(encoded.text);
      if (cancelled) return;
      setBase(a);
      setNext(b);
      setCanon(encoded.text);
    })();
    return () => {
      cancelled = true;
    };
  }, [mutation, encoded.text]);

  const sha256 = next?.["SHA-256"] ?? "";
  const base256 = base?.["SHA-256"] ?? "";
  const ham = sha256 && base256 ? hammingBits(base256, sha256) : null;
  const match = sha256 !== "" && sha256 === base256;

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:py-12">
      <p className="text-xs font-medium uppercase tracking-[0.22em] text-subtle">
        Digest · JCS → SHA · cp.v1
      </p>
      <h1 className="mt-2 font-display text-4xl tracking-tight">SHA</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
        Le sceau hache des octets, pas une intention. Un seul algorithme est le
        contrat : SHA-256. Plus long n'est pas plus vrai. SHA-1 est cassé.
      </p>

      <div className="mt-6 flex flex-wrap gap-2">
        {MUTATIONS.map((m) => (
          <Button
            key={m.id}
            variant={mutation === m.id ? "default" : "outline"}
            onClick={() => setMutation(m.id)}
          >
            {m.title}
          </Button>
        ))}
      </div>

      <article className="mt-8 min-w-0 overflow-hidden rounded-xl bg-card shadow-[var(--shadow-border)]">
        <div className="border-b border-border px-4 py-3 text-xs font-medium uppercase tracking-[0.16em] text-subtle">
          Octets hachés · {encoded.kind} · {new TextEncoder().encode(canon).length} octets
        </div>
        <pre className="max-h-48 overflow-auto p-4 font-mono text-xs leading-relaxed break-all text-muted-foreground sm:break-normal">
          {canon}
        </pre>
      </article>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        {ham ? (
          <>
            <Badge tone={match ? "reprenable" : "corrompu"}>
              {match ? "même SHA-256" : "avalanche"}
            </Badge>
            <span className="font-mono text-xs text-subtle">
              {ham.flipped}/{ham.total} bits ({Math.round(ham.ratio * 100)} %)
            </span>
          </>
        ) : null}
      </div>

      <div className="mt-8 overflow-hidden rounded-xl bg-card shadow-[var(--shadow-border)]">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border text-xs uppercase tracking-[0.14em] text-subtle">
              <th className="px-4 py-3 font-medium">Algo</th>
              <th className="px-4 py-3 font-medium">Bits</th>
              <th className="px-4 py-3 font-medium">Digest</th>
            </tr>
          </thead>
          <tbody>
            {SHA_ALGOS.map((algo) => {
              const hex = next?.[algo.id] ?? "";
              const changed = Boolean(base && next && base[algo.id] !== next[algo.id]);
              return (
                <tr key={algo.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs">{algo.id}</span>
                      {algo.used ? (
                        <Badge tone="reprenable">contrat</Badge>
                      ) : (
                        <Badge tone="default">hors contrat</Badge>
                      )}
                    </div>
                    <p className="mt-1 max-w-xs text-xs text-muted-foreground">{algo.why}</p>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-subtle">
                    {algo.bits}
                    {hex ? ` · ${bytesOf(hex)} o` : ""}
                  </td>
                  <td className="min-w-0 px-4 py-3">
                    <p
                      className={cn(
                        "break-all font-mono text-[11px] leading-relaxed",
                        changed ? "text-corrompu" : "text-muted-foreground",
                      )}
                    >
                      {hex ? `sha${algo.bits}:${hex}` : "…"}
                    </p>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <section className="mt-12 max-w-2xl">
        <h2 className="font-display text-2xl tracking-tight">Ce que SHA ne dit pas</h2>
        <p className="mt-3 text-sm text-muted-foreground">
          SHA-256(mensonge) est un hash valide. Integrity ≠ Truth. Un digest plus
          long ne reconstitue pas l'état. HMAC signerait l'enveloppe ; ce
          n'est pas le contrat du jour un. SHA-3 n'est pas exposé par
          Web Crypto ici — on ne l'invente pas.
        </p>
      </section>
    </div>
  );
}
