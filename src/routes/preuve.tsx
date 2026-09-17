import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Mountain } from "@/components/merkle/mountain";
import {
  CONTRAT,
  DEMO_BATCH,
  appendLeaf,
  emptyMmr,
  hashesNaive,
  prove,
  verifyProof,
  type InclusionProof,
  type Mmr,
} from "@/lib/merkle/mmr";
import { hashLeaf, hashRuleset, makeLeaf, type UsageLeaf } from "@/lib/merkle/leaf";
import { sha256Hex } from "@/lib/handoff/hash";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/preuve")({ component: PreuvePage });

type Probe = {
  index: number;
  ok: boolean;
  proof: InclusionProof;
  note: string;
};

function randomNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

function PreuvePage() {
  const [nonce, setNonce] = useState<string | null>(null);
  const [rulesetHash, setRulesetHash] = useState<string | null>(null);
  const [mmr, setMmr] = useState<Mmr>(emptyMmr);
  const [leaves, setLeaves] = useState<UsageLeaf[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [probe, setProbe] = useState<Probe | null>(null);
  const [busy, setBusy] = useState(false);
  const [tampered, setTampered] = useState(false);

  const full = mmr.leaves.length >= DEMO_BATCH;

  async function openLot() {
    setBusy(true);
    setNonce(randomNonce());
    setRulesetHash(await hashRuleset());
    setMmr(emptyMmr());
    setLeaves([]);
    setSelected(null);
    setProbe(null);
    setTampered(false);
    setBusy(false);
  }

  async function appendOne() {
    if (!nonce || !rulesetHash || full || busy) return;
    setBusy(true);
    const sequence = leaves.length;
    const inputSeed = await sha256Hex(`demo:input:${nonce}:${sequence}`);
    const leaf = makeLeaf(sequence, nonce, rulesetHash, inputSeed, new Date().toISOString());
    const leafHash = await hashLeaf(leaf);
    const next = await appendLeaf(mmr, leafHash);
    setLeaves((prev) => [...prev, leaf]);
    setMmr(next);
    setSelected(sequence);
    setProbe(null);
    setTampered(false);
    setBusy(false);
  }

  async function appendMany(count: number) {
    if (!nonce || !rulesetHash) return;
    setBusy(true);
    let tree = mmr;
    const added: UsageLeaf[] = [];
    let start = leaves.length;
    const target = Math.min(DEMO_BATCH, start + count);
    for (let sequence = start; sequence < target; sequence++) {
      const inputSeed = await sha256Hex(`demo:input:${nonce}:${sequence}`);
      const leaf = makeLeaf(sequence, nonce, rulesetHash, inputSeed, new Date().toISOString());
      const leafHash = await hashLeaf(leaf);
      tree = await appendLeaf(tree, leafHash);
      added.push(leaf);
    }
    setLeaves((prev) => [...prev, ...added]);
    setMmr(tree);
    setSelected(tree.leaves.length ? tree.leaves.length - 1 : null);
    setProbe(null);
    setTampered(false);
    setBusy(false);
  }

  async function sonder(index: number, mutate: boolean) {
    const proof = prove(mmr, index);
    if (!proof) return;
    let working = proof;
    let note = "Sondage honnête. La feuille rejoint la racine publiée.";
    if (mutate) {
      const dirty = { ...working, leafHash: await sha256Hex(`tamper:${working.leafHash}`) };
      working = dirty;
      note = "Une feuille a été altérée après coup. La racine ne suit plus.";
    }
    const ok = await verifyProof(working, mmr.root);
    setSelected(index);
    setTampered(mutate);
    setProbe({ index, ok, proof: working, note });
  }

  const selectedLeaf = selected != null ? leaves[selected] : null;
  const naive = hashesNaive(mmr.leaves.length || 1);

  const peaksLabel = useMemo(
    () => mmr.peaks.map((p) => `${p.size}`).join(" + ") || "∅",
    [mmr.peaks],
  );

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:py-12">
      <p className="text-xs font-medium uppercase tracking-[0.22em] text-subtle">
        Preuve d'usage · MMR incrémental · noyau intact
      </p>
      <h1 className="mt-2 font-display text-4xl tracking-tight">Montagne</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
        Un certificat est une feuille. Ajouter une feuille ne reconstruit pas
        l'arbre : on ne touche qu'à la frontière — les pics. Mentir sur
        une feuille casse la racine. Le juge n'est pas dans cette page.
      </p>

      <dl className="mt-8 grid gap-3 sm:grid-cols-4">
        {[
          ["contrat", CONTRAT.id],
          ["lot démo", `${mmr.leaves.length} / ${DEMO_BATCH}`],
          ["lot réel", String(CONTRAT.batch_size)],
          ["pics", peaksLabel],
        ].map(([k, v]) => (
          <div key={k} className="rounded-xl bg-card px-4 py-3 shadow-[var(--shadow-border)]">
            <dt className="text-xs uppercase tracking-[0.16em] text-subtle">{k}</dt>
            <dd className="mt-1 truncate font-mono text-sm">{v}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-6 flex flex-wrap gap-3">
        <Button onClick={openLot} disabled={busy}>
          {nonce ? "Nouveau lot" : "Ouvrir le lot"}
        </Button>
        <Button variant="outline" onClick={appendOne} disabled={!nonce || full || busy}>
          Ajouter une feuille
        </Button>
        <Button variant="outline" onClick={() => appendMany(4)} disabled={!nonce || full || busy}>
          Ajouter 4
        </Button>
        <Button
          variant="outline"
          onClick={() => {
            const i = Math.floor(Math.random() * mmr.leaves.length);
            void sonder(i, false);
          }}
          disabled={mmr.leaves.length === 0 || busy}
        >
          Sonder un index
        </Button>
        <Button
          variant="outline"
          onClick={() => {
            const i = selected ?? mmr.leaves.length - 1;
            void sonder(i, true);
          }}
          disabled={mmr.leaves.length === 0 || busy}
        >
          Tricher sur la feuille
        </Button>
      </div>

      {nonce ? (
        <p className="mt-4 font-mono text-xs text-subtle">
          nonce serveur {nonce.slice(0, 16)}… · émis au début du lot, pas à la clôture
        </p>
      ) : null}

      <div className="mt-8">
        <Mountain mmr={mmr} selected={selected} onSelect={setSelected} />
      </div>

      <section className="mt-8 grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl bg-card p-5 shadow-[var(--shadow-border)]">
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-subtle">
            Coût d'un ajout
          </p>
          <table className="mt-3 w-full text-sm">
            <tbody>
              <tr className="border-b border-border">
                <td className="py-2">Incrémental (cette feuille)</td>
                <td className="py-2 text-right font-mono">{mmr.hashesThisStep} hash</td>
              </tr>
              <tr className="border-b border-border">
                <td className="py-2">Incrémental (cumul)</td>
                <td className="py-2 text-right font-mono">{mmr.hashesCumulative}</td>
              </tr>
              <tr>
                <td className="py-2">Naïf, tout reconstruire</td>
                <td className="py-2 text-right font-mono">{naive}</td>
              </tr>
            </tbody>
          </table>
          <p className="mt-3 text-sm text-muted-foreground">
            La frontière tient dans {mmr.peaks.length} pic{mmr.peaks.length > 1 ? "s" : ""}.
            Un ajout fusionne les pics de même hauteur. Pour n = 2^k, un seul pic.
          </p>
        </div>

        <div className="rounded-xl bg-card p-5 shadow-[var(--shadow-border)]">
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-subtle">
            Racine publiable
          </p>
          <p className="mt-3 break-all font-mono text-xs leading-relaxed">{mmr.root}</p>
          {selectedLeaf ? (
            <dl className="mt-4 space-y-1 font-mono text-xs text-muted-foreground">
              <div>seq {selectedLeaf.sequence}</div>
              <div>id {selectedLeaf.id}</div>
              <div>input {selectedLeaf.input_hash.slice(0, 16)}…</div>
              <div>ruleset {selectedLeaf.ruleset_hash.slice(0, 16)}…</div>
            </dl>
          ) : (
            <p className="mt-4 text-sm text-muted-foreground">
              Choisissez une feuille dans la montagne.
            </p>
          )}
        </div>
      </section>

      {probe ? (
        <section className="mt-4 rounded-xl bg-card p-5 shadow-[var(--shadow-border)]">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-subtle">
              Sondage · index {probe.index}
            </p>
            <Badge tone={probe.ok ? "reprenable" : "corrompu"}>
              {probe.ok ? "preuve tenue" : "preuve rompue"}
            </Badge>
            {tampered ? <Badge tone="corrompu">feuille altérée</Badge> : null}
          </div>
          <p className="mt-3 text-sm text-muted-foreground">{probe.note}</p>
          <ol className="mt-4 space-y-1 font-mono text-xs text-muted-foreground">
            {probe.proof.siblings.map((s, i) => (
              <li key={`${s.hash}-${i}`}>
                {s.side === "right" ? "frère à droite" : "frère à gauche"} · {s.hash.slice(0, 16)}…
              </li>
            ))}
            {probe.proof.siblings.length === 0 ? <li>Feuille = pic. Pas de frère.</li> : null}
          </ol>
        </section>
      ) : null}

      <section className="mt-12 max-w-2xl">
        <h2 className="font-display text-2xl tracking-tight">Pourquoi incrémental</h2>
        <p className="mt-3 text-sm text-muted-foreground">
          Un arbre classique recalcule ~n nœuds à chaque clôture. Une montagne
          de Merkle ne garde que les pics — la décomposition binaire de n.
          Ajouter le certificat 13 (n passe de 12 = 8+4 à 13 = 8+4+1) crée une
          feuille. Ajouter le 8e fusionne tout en un pic unique.
        </p>
        <p className="mt-3 text-sm text-muted-foreground">
          Le nonce est émis <em>avant</em> la première feuille. Sans ça, un
          intégrateur précalcule 500 certificats hors ligne. La séquence est
          monotone. Le ruleset_hash verrouille le juge utilisé. Le sondage
          choisit l'index après coup : une seule feuille menteuse casse la
          racine, mais un sondage unique ne la trouve qu'avec proba 1/n.
        </p>
        <p className={cn("mt-3 text-sm text-muted-foreground")}>
          Cette page ne paie rien. x402 reste un stub. Le certificateur, lui,
          n'a pas changé.
        </p>
      </section>
    </div>
  );
}
