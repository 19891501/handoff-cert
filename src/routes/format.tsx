import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { sha256Hex, canonicalize } from "@/lib/handoff/hash";
import { jcs, shuffleKeys, sortKeysLocale, utf8Len } from "@/lib/format/jcs";
import {
  LOCALE_TRAP,
  SAMPLE_PAYLOAD,
  sampleCorrompu,
  samplePartiel,
  sampleReprenable,
  seal,
  mutateMissing,
  mutateUnicodeNote,
  WIRE_MAP,
  type ContinuationProof,
} from "@/lib/format/proof";
import { cn, pretty } from "@/lib/utils";

export const Route = createFileRoute("/format")({ component: FormatPage });

type Fixture = "partiel" | "reprenable" | "corrompu";
type View = "pretty" | "jcs";

function fixtureOf(id: Fixture): ContinuationProof {
  if (id === "reprenable") return sampleReprenable();
  if (id === "corrompu") return sampleCorrompu();
  return samplePartiel();
}

function FormatPage() {
  const [fixture, setFixture] = useState<Fixture>("partiel");
  const [sealed, setSealed] = useState(true);
  const [view, setView] = useState<View>("pretty");
  const [proof, setProof] = useState<ContinuationProof>(() => seal(samplePartiel()));
  const [baseline, setBaseline] = useState<string>("");
  const [digest, setDigest] = useState<string>("");
  const [trap, setTrap] = useState<{ jcs: string; locale: string; old: string } | null>(null);
  const [note, setNote] = useState("Scellé par défaut : le payload reste chez l'émetteur.");

  const displayed = useMemo(() => {
    const obj = sealed ? seal(proof) : proof;
    return view === "jcs" ? jcs(obj) : pretty(obj);
  }, [proof, sealed, view]);

  useEffect(() => {
    const obj = sealed ? seal(proof) : proof;
    void sha256Hex(jcs(obj)).then((h) => {
      setDigest(h);
      if (!baseline) setBaseline(h);
    });
  }, [proof, sealed, baseline]);

  useEffect(() => {
    const localeSorted = sortKeysLocale(LOCALE_TRAP, "es");
    void Promise.all([
      sha256Hex(jcs(LOCALE_TRAP)),
      sha256Hex(JSON.stringify(localeSorted)),
      sha256Hex(canonicalize(LOCALE_TRAP)),
    ]).then(([a, b, c]) => setTrap({ jcs: a, locale: b, old: c }));
  }, []);

  function load(id: Fixture) {
    setFixture(id);
    const next = sealed ? seal(fixtureOf(id)) : fixtureOf(id);
    setProof(next);
    setBaseline("");
    setNote(
      id === "partiel"
        ? "Il manque e_verify. next_evidence pointe dessus."
        : id === "reprenable"
          ? "Reconstructible. stop = true : plus rien à chercher."
          : "Contradiction engagée. reconstructible = false.",
    );
  }

  function applySeal(on: boolean) {
    setSealed(on);
    setProof(on ? seal(fixtureOf(fixture)) : fixtureOf(fixture));
    setBaseline("");
    setNote(
      on
        ? "Scellé : payload retiré. L'empreinte ne porte plus le contenu."
        : "Ouvert : payload inclus. Ne pas exporter ainsi hors de l'entreprise.",
    );
  }

  function reorder() {
    setProof(shuffleKeys(proof, Date.now() & 0xffff) as ContinuationProof);
    setNote("Clés mélangées. JCS doit produire la même empreinte.");
  }

  function unicode() {
    if (sealed) {
      setNote(
        "Scellé : le payload n'est pas dans l'objet. NFD ne peut pas casser l'empreinte exportée. Ouvre le sceau pour voir la divergence.",
      );
      return;
    }
    const next = mutateUnicodeNote(proof);
    setProof(next);
    setNote("café NFC → NFD. JCS ne normalise pas Unicode. L'empreinte doit changer.");
  }

  function missing() {
    const next = mutateMissing(proof);
    setProof(next);
    setNote("Champ missing muté. L'empreinte doit changer.");
  }

  const same = baseline && digest && baseline === digest;
  const bytesPretty = utf8Len(pretty(sealed ? seal(proof) : proof));
  const bytesJcs = utf8Len(jcs(sealed ? seal(proof) : proof));
  const bytesSealed = utf8Len(jcs(seal(proof)));

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:py-12">
      <p className="text-xs font-medium uppercase tracking-[0.22em] text-subtle">
        cp.v1 · JSON + JCS · RFC 8785
      </p>
      <h1 className="mt-2 font-display text-4xl tracking-tight">Format</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
        Un objet portable, vérifiable localement. Pas un protocole réseau. Pas un
        dashboard. Le payload reste chez l'émetteur ; le certificat n'en
        porte que l'empreinte.
      </p>

      <div className="mt-6 flex flex-wrap gap-2">
        {(["partiel", "reprenable", "corrompu"] as const).map((id) => (
          <Button
            key={id}
            variant={fixture === id ? "default" : "outline"}
            onClick={() => load(id)}
          >
            {id}
          </Button>
        ))}
        <Button variant={sealed ? "default" : "outline"} onClick={() => applySeal(!sealed)}>
          {sealed ? "scellé" : "ouvert"}
        </Button>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button variant="outline" onClick={reorder}>
          Réordonner les clés
        </Button>
        <Button variant="outline" onClick={unicode}>
          Unicode NFD
        </Button>
        <Button variant="outline" onClick={missing}>
          Muter missing
        </Button>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3 font-mono text-xs">
        <span
          className={cn(
            "rounded-md px-2 py-1",
            same ? "bg-reprenable/15 text-reprenable" : "bg-partiel/15 text-partiel",
          )}
        >
          {same ? "empreinte stable" : "empreinte rompue"}
        </span>
        <span className="text-muted-foreground">sha256:{digest.slice(0, 16)}…</span>
        <span className="text-subtle">
          pretty {bytesPretty} o · jcs {bytesJcs} o · scellé {bytesSealed} o
        </span>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">{note}</p>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_0.9fr]">
        <div className="overflow-hidden rounded-xl bg-card shadow-[var(--shadow-border)]">
          <div className="flex border-b border-border">
            {(["pretty", "jcs"] as const).map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => setView(id)}
                className={cn(
                  "h-11 flex-1 px-4 text-sm",
                  view === id ? "bg-muted text-foreground" : "text-muted-foreground",
                )}
              >
                {id === "pretty" ? "Lecture" : "Canonique"}
              </button>
            ))}
          </div>
          <pre className="max-h-[28rem] overflow-auto p-4 font-mono text-xs leading-relaxed text-muted-foreground">
            {displayed}
          </pre>
        </div>

        <div className="space-y-4">
          <article className="rounded-xl bg-card p-5 shadow-[var(--shadow-border)]">
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-subtle">
              Concept → fil
            </p>
            <ul className="mt-3 space-y-2">
              {WIRE_MAP.map((row) => (
                <li key={row.wire} className="flex items-center justify-between gap-3 text-sm">
                  <span className="font-mono text-xs text-subtle">{row.concept}</span>
                  <span className="font-mono text-xs">{row.wire}</span>
                  {row.sealed ? (
                    <Badge tone="reprenable">export</Badge>
                  ) : (
                    <Badge tone="corrompu">jamais exporté</Badge>
                  )}
                </li>
              ))}
            </ul>
          </article>

          <article className="rounded-xl bg-card p-5 shadow-[var(--shadow-border)]">
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-subtle">
              Piège localeCompare
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              Clés {"{ n, o, ñ }"}. UTF-16 : n, o, ñ. Espagnol : n, ñ, o. Un hash
              sur JSON.stringify trié par locale n'est pas JCS.
            </p>
            {trap ? (
              <ul className="mt-3 space-y-1 font-mono text-xs text-muted-foreground">
                <li>JCS {trap.jcs.slice(0, 16)}…</li>
                <li>es-locale {trap.locale.slice(0, 16)}…</li>
                <li>canonicalize() actuel {trap.old.slice(0, 16)}…</li>
              </ul>
            ) : null}
            <p className="mt-3 text-xs text-subtle">
              Le V0 utilise encore localeCompare. Ce format ne le reprend pas.
            </p>
          </article>
        </div>
      </div>

      <section className="mt-12 max-w-2xl">
        <h2 className="font-display text-2xl tracking-tight">Ce que le format refuse</h2>
        <p className="mt-3 text-sm text-muted-foreground">
          Pas de protobuf. Pas de CBOR pour le MVP. JSON + JCS : inspectable par
          une autre machine sans décodeur propriétaire. Les tableaux gardent
          l'ordre. Les objets, non. Unicode n'est pas normalisé : café
          NFC et café NFD sont deux payloads.
        </p>
        <p className="mt-3 text-sm text-muted-foreground">
          payload de démo : {pretty(SAMPLE_PAYLOAD)}. Il n'entre dans
          l'empreinte exportée que si on casse le sceau.
        </p>
      </section>
    </div>
  );
}
