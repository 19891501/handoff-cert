# Arrêter `goto` sur CORROMPU

Starter LangGraph. **Ruleset 1.2.** `gateNode` est la grille. `wrapNode` n'en
est pas une.

Cap 2030 : chaque `Command.goto` A→B exige un certificat. V0 (`1.0`) est le
**reçu gelé** — B part encore à tort sur KFP-001. **1.2** (`handoff-gate-v12`,
0,05 €) est la **grille payée** : B ne part que si le notaire dit REPRENABLE.

> **English.** How to stop `goto` on CORROMPU: wrap the node with
> `gateNode(..., { ruleset: "1.2" })`. A non-REPRENABLE verdict rewrites
> `Command.goto` to `__end__`. `wrapNode` only observes. Ruleset 1.0 is the
> frozen receipt, not a safety gate.

## Une ligne

```ts
graph.addNode(
  "planner",
  gateNode("planner", planner, { graph: "support", ruleset: "1.2" }),
)
```

Pas ça :

```ts
graph.addNode(
  "planner",
  wrapNode("planner", planner, { graph: "support" }),
)
```

`wrapNode` scelle le handoff et **laisse le `goto`**. `gateNode` certifie, puis
**coupe**.

## Ce que fait STOP

Le nœud rend encore `{ goto: "executor", update: { … } }`. La grille réécrit :

```ts
{
  goto: "__end__",          // LANGGRAPH_END — B ne part pas
  update: {
    continuation_gate: "STOP",
    continuation_verdict: "CORROMPU",
  },
}
```

LangGraph traite `__end__` comme `END`. L'exécuteur n'est pas invoqué.
`continuation_gate: "PASS"` seulement si le verdict est **REPRENABLE**.

Fail-closed : paquet absent → STOP (`paquet_absent`). Module 1.2 manquant →
STOP (`ruleset_1.2_unavailable`). On n'invente pas un juge.

## Pourquoi 1.2, pas 1.0

| Paquet | Monde | wrapNode | gate 1.0 | gate **1.2** |
|---|---|---|---|---|
| CTL-CLEAN | REPRENABLE | `executor` | PASS `executor` | PASS `executor` |
| KFP-001 | CORROMPU | `executor` | PASS `executor` | **STOP `__end__`** |
| KFP-002 | CORROMPU | `executor` | PASS `executor` | **STOP `__end__`** |
| CTL-FAIL-TOKEN | CORROMPU | `executor` | STOP `__end__` | STOP `__end__` |

V0 ne voit pas les booléens, les specs, les chemins sans empreinte, les
ledgers de chat. Un token FAIL arrête encore 1.0 — insuffisant. 1.2 hérite
1.1 (booléens) et refuse `expected_output`, un path sans digest, un chat
pris pour `tool_result`.

CORROMPU = une affirmation est contredite ; continuer propagerait l'erreur.
PARTIEL = il manque une pièce — STOP aussi. Seul REPRENABLE laisse le `goto`.

## Brancher

Le nœud rend un objet `{ goto, update }` (Command LangGraph). L'état porte le
paquet à certifier (`state.packet` ou `packetOf`).

```ts
import { gateNode } from "../../src/lib/adopt/langgraph.ts";

async function planner(state) {
  return {
    update: { handed: true },
    goto: "executor",
  };
}

const node = gateNode("planner", planner, {
  graph: "support",
  ruleset: "1.2",
  packetOf: (state) => state.packet,
});
```

Dans `@langchain/langgraph` :

```ts
import { StateGraph, START } from "@langchain/langgraph";
import { gateNode } from "../../src/lib/adopt/langgraph.ts";

const graph = new StateGraph(State)
  .addNode(
    "planner",
    gateNode("planner", planner, { graph: "support", ruleset: "1.2" }),
  )
  .addNode("executor", executor)
  .addEdge(START, "planner")
  .compile();
```

`gateNode` ne dépend pas de la classe `Command`. Un `{ goto, update }` suffit.
`goto: "__end__"` est déjà le sentinelle officiel.

## Lancer

À la racine du dépôt :

```bash
npx tsx examples/langgraph/index.ts
npx tsx --test examples/langgraph/graph.test.ts
```

Le graphe de démo : `planner` → `executor`. Sur CORROMPU, une seule étape,
`goto === "__end__"`, `executed` absent.

Skill observateur / juge : [`skills/handoff-cert.md`](../../skills/handoff-cert.md).

## Ce que ce starter n'est pas

- Pas un patch silencieux de V0. 1.0 reste le reçu rouge (0,001 €).
- Pas `wrapNode`. L'observateur ne juge pas.
- Pas un standard. MIT. Facturation `preview`. Aucun client payant.
- Pas « B ne part pas à tort » sur 1.0. Ce claim est **tué** (KFP-001).

SKU `handoff-gate-v12` · ruleset `1.2` · 0,05 € / certificat.
