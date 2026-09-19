---
name: handoff-cert
description: >
  Insert and distinguish LangGraph wrapNode (silent observer on Command.goto)
  versus gateNode ruleset 1.2 (paid CERT+GATE grille that STOPs unless REPRENABLE).
  Use when wrapping nodes, choosing ruleset 1.0/1.1/1.2, sealing a handoff,
  adopting checkout graphs, or explaining why V0 PASSes KFP-001/002 while 1.2
  STOPs. Never treat wrapNode as a safety gate, never retune frozen V0, never
  sell 1.0 as a safe resume.
license: MIT
metadata:
  author: handoff-cert
  version: "1.2"
  sku: handoff-gate-v12
  horizon: "2030"
---

# HANDOFF CERT — wrapNode vs gateNode 1.2

Horizon 2030: TLS of agent handoffs. wrapNode observes. gateNode bills.
Source of truth: `src/lib/adopt/langgraph.ts`, `src/lib/bench/gate.ts`,
`src/lib/handoff/ruleset12.ts`. Tests: `src/lib/tests/gate-graph.test.ts`.

## The split (never conflate)

| | `wrapNode` | `gateNode` |
|---|---|---|
| Role | Observer | Judge — the attacked CERT+GATE couple |
| Seals `Command.goto` | Yes | Yes |
| Judges the packet | **Never** | `gateResume(packet, ruleset)` |
| Stops B | **Never** | STOP → `goto: "__end__"` if not REPRENABLE |
| `continuation_gate` | unset | `"PASS"` or `"STOP"` |
| Default ruleset | n/a | **`"1.0"`** (frozen receipt, known false REPRENABLE) |
| Paid grille | n/a | `{ ruleset: "1.2" }` — SKU `handoff-gate-v12`, €0.05 |
| SKU | — | 1.0 = `handoff-cert-v1` €0.001 · 1.2 = `handoff-gate-v12` €0.05 |

**Sell 1.2 as the grille. Do not sell wrapNode, and do not sell V0, as safety.**

## When the wrap/gate even runs

Both are silent unless `isHandoffCommand(result)` is true:

| Return | Handoff? | Seal? |
|---|---|---|
| `{ goto: "other_node" }` | yes | yes |
| `{ goto: { node: "worker" } }` (Send) | yes | yes |
| `{ goto: ["a","b"] }` (fan-out) | yes | yes |
| `{ goto, graph: "PARENT" }` | yes | yes |
| `{ goto: "__end__" }` | **no** | no |
| `{ resume: "yes" }` without goto | **no** | no |
| plain state `{ x: 1 }` | **no** | no |
| static `addEdge` | **no** | wrap never sees a Command |

LangGraph has no after-node callback. The handoff **is** `Command.goto`.
Without a live successor, stay silent.

## Insert

```ts
import { wrapNode, gateNode } from "@/lib/adopt/langgraph"

// Observer — checkout demo, traces, MATCH/MISMATCH. Never a gate.
.addNode("payment_agent", wrapNode("payment_agent", paymentAgent, { graph: "checkout" }))

// Paid grille — B does not start unless 1.2 says REPRENABLE.
.addNode("planner", gateNode("planner", planner, {
  graph: "checkout",
  ruleset: "1.2",
  // optional: default reads state.packet then state.handoff
  packetOf: (state) => state.packet,
}))
```

`gateNode` default **is 1.0**. Passing `"1.2"` is opt-in. Do not silently
flip the default — that would pretend V0 was patched.

## gateNode 1.2 behaviour

1. Run the node. If not a handoff Command, return as-is (same as wrapNode).
2. Seal (`adopt` → `continuation_proof`, or `continuation_error`).
3. Read the packet (`packetOf` / `state.packet` / `state.handoff`).
   Missing → STOP, `continuation_error: "paquet_absent"`.
4. `await gateResume(packet, "1.2")`. Import of `certify12` missing → STOP,
   `continuation_error: "ruleset_1.2_unavailable"` (**fail closed**, do not
   invent a 1.2 judge, do not fall back to 1.0).
5. Verdict not `REPRENABLE` → `goto: "__end__"`, `continuation_gate: "STOP"`.
6. Else keep the original goto, `continuation_gate: "PASS"`.

wrapNode stops at step 2. It never sets `continuation_gate`.

## Rulesets (three notaries, V0 frozen)

| Ruleset | What it is | KFP-001 | KFP-002 spec | KFP-003 path | KFP-004 chat | CTL-FAIL-TOKEN |
|---|---|---|---|---|---|---|
| **1.0** V0 | Frozen receipt. FAIL **token** only. | PASS (kill) | PASS | PASS | PASS | STOP |
| **1.1** | Separate notary. Booleans + `terminated` ≠ `termine`. Not sold. | STOP | PASS | PASS | PASS | STOP |
| **1.2** | Paid grille. Inherits 1.1 + evidence quality. | STOP | STOP | STOP | STOP | STOP |

1.2 critical codes (only if a **success claim** links that evidence, and the
evidence has no actual FAIL/OK run status):

- `SPEC_NOT_EVIDENCE` — `expected_output` / `spec` is not execution proof
- `PATH_NOT_DIGEST` — file path without hash/digest/sha
- `CHAT_NOT_TOOL` — ledger/chat/message is not a `tool_result`

A clean packet stays `REPRENABLE` on 1.2. Do not fire these codes on a real
run status.

## Agent checklist

When asked to wrap, gate, or adopt LangGraph:

1. Classify the return value. No live `goto` → do nothing. Do not seal resume, `__end__`, or state.
2. Need a receipt / MATCH-MISMATCH only? **`wrapNode`**.
3. Need B not to start on a bad packet? **`gateNode(..., { ruleset: "1.2" })`**.
4. Never write `gateNode` without an explicit `ruleset` if the caller wants 1.2 — default is 1.0 and **PASSes KFP-001 and KFP-002**.
5. Keep V0 tests red: a PR that makes a KFP vanish on ruleset `"1.0"` without changing the ruleset id is a regression.
6. Do not claim paying customers. Billing is `preview` until `X402_PAY_TO` is set.
7. Do not kill port 8080.

## Never

- Treat wrapNode as a safety product
- Sell V0 / `handoff-cert-v1` as “B will not start wrongly”
- Patch FAIL_TOKENS / V0 to close KFP-001–004
- Fall back 1.2 → 1.0 when `certify12` is missing
- Seal a static edge, a resume, or `goto: "__end__"`
- Invent a 1.2 finding that V0 already covers with a FAIL token

## Pointers

- Observer + gate: `src/lib/adopt/langgraph.ts` (`wrapNode`, `gateNode`, `isHandoffCommand`)
- Grille: `src/lib/bench/gate.ts` (`gateResume`, `RulesetId`)
- 1.2 judge: `src/lib/handoff/ruleset12.ts` (`analyze12`, `certify12`)
- 1.1 judge: `src/lib/handoff/ruleset11.ts`
- Frozen V0: `src/lib/handoff/engine.ts` — do not edit to “fix” KFP
- Known false REPRENABLE: `falsification/` (KFP-001–004 locked)
- Prices / cap 2030: `src/lib/offer/mission.ts`
